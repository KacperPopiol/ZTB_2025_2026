import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import docClient, { TABLES } from '../dynamodb.js';
import redis from '../redisWrapper.js'; // ← Zmiana importu
import { getScooterById, updateScooterStatus } from './scooterService.js';
import { getActivationFee } from './pricingService.js';
import { deductFromWallet } from './userService.js';

const RESERVATION_TTL = 300;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sprawdź czy hulajnoga jest zarezerwowana (z DynamoDB jako fallback)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function isScooterReservedInDB(scooterId) {
  try {
    const scooter = await getScooterById(scooterId);
    return scooter && scooter.status === 'reserved';
  } catch (error) {
    console.error('Błąd sprawdzania rezerwacji w DB:', error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utwórz rezerwację
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function createReservation(userId, scooterId) {
  try {
    const scooter = await getScooterById(scooterId);

    if (!scooter) {
      throw new Error('Hulajnoga nie została znaleziona');
    }

    if (scooter.status !== 'available') {
      throw new Error('Hulajnoga nie jest dostępna');
    }

    const existingReservation = await getActiveReservationByUser(userId);
    if (existingReservation) {
      throw new Error('Masz już aktywną rezerwację');
    }

    // Sprawdź czy hulajnoga nie jest już zarezerwowana
    const redisKey = `reservation:scooter:${scooterId}`;
    const existsInRedis = await redis.exists(redisKey);
    
    // Jeśli Redis wyłączony, sprawdź w DynamoDB
    if (!redis.isEnabled()) {
      const isReservedInDB = await isScooterReservedInDB(scooterId);
      if (isReservedInDB) {
        throw new Error('Hulajnoga jest już zarezerwowana');
      }
    } else if (existsInRedis) {
      throw new Error('Hulajnoga jest już zarezerwowana');
    }

    const reservationId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESERVATION_TTL * 1000).toISOString();

    const reservation = {
      reservationId,
      userId,
      scooterId,
      status: 'active',
      price: 0,
      createdAt: now,
      expiresAt,
    };

    const command = new PutCommand({
      TableName: TABLES.RESERVATIONS,
      Item: reservation,
    });

    await docClient.send(command);

    // Zapisz w Redis z TTL (jeśli włączony)
    await redis.set(redisKey, userId, 'EX', RESERVATION_TTL);
    await redis.set(`reservation:user:${userId}`, reservationId, 'EX', RESERVATION_TTL);

    await updateScooterStatus(scooterId, 'reserved');

    return {
      ...reservation,
      expiresIn: RESERVATION_TTL,
      price: 0,
    };
  } catch (error) {
    console.error('Błąd tworzenia rezerwacji:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz rezerwację po ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getReservationById(reservationId) {
  try {
    const command = new GetCommand({
      TableName: TABLES.RESERVATIONS,
      Key: { reservationId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item;
  } catch (error) {
    console.error('Błąd pobierania rezerwacji:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz aktywną rezerwację użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getActiveReservationByUser(userId) {
  try {
    // Sprawdź Redis
    const reservationId = await redis.get(`reservation:user:${userId}`);
    if (reservationId) {
      return await getReservationById(reservationId);
    }

    // Sprawdź DynamoDB (zawsze jako fallback)
    const command = new QueryCommand({
      TableName: TABLES.RESERVATIONS,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'active',
      },
      Limit: 1,
    });

    const response = await docClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return response.Items[0];
  } catch (error) {
    console.error('Błąd pobierania aktywnej rezerwacji użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz wszystkie rezerwacje użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getUserReservations(userId, limit = 20) {
  try {
    const command = new QueryCommand({
      TableName: TABLES.RESERVATIONS,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      Limit: limit,
      ScanIndexForward: false,
    });

    const response = await docClient.send(command);

    return {
      reservations: response.Items || [],
      lastKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('Błąd pobierania rezerwacji użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Anuluj rezerwację
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function cancelReservation(reservationId, userId) {
  try {
    const reservation = await getReservationById(reservationId);

    if (!reservation) {
      throw new Error('Rezerwacja nie została znaleziona');
    }

    if (reservation.userId !== userId) {
      throw new Error('Nie masz uprawnień do anulowania tej rezerwacji');
    }

    if (reservation.status !== 'active') {
      throw new Error('Rezerwacja nie jest aktywna');
    }

    const command = new UpdateCommand({
      TableName: TABLES.RESERVATIONS,
      Key: { reservationId },
      UpdateExpression: 'SET #status = :status, #cancelledAt = :cancelledAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#cancelledAt': 'cancelledAt',
      },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':cancelledAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    await docClient.send(command);

    // Usuń z Redis
    await redis.del(`reservation:scooter:${reservation.scooterId}`);
    await redis.del(`reservation:user:${userId}`);

    await updateScooterStatus(reservation.scooterId, 'available');

    return { success: true, message: 'Rezerwacja anulowana' };
  } catch (error) {
    console.error('Błąd anulowania rezerwacji:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rozpocznij jazdę (konwertuj rezerwację na jazdę)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function startRide(reservationId, userId) {
  try {
    const reservation = await getReservationById(reservationId);

    if (!reservation) {
      throw new Error('Rezerwacja nie została znaleziona');
    }

    if (reservation.userId !== userId) {
      throw new Error('Nie masz uprawnień do tej rezerwacji');
    }

    if (reservation.status !== 'active') {
      throw new Error('Rezerwacja nie jest aktywna');
    }

    const activationFee = await getActivationFee();
    await deductFromWallet(userId, activationFee);

    const updateReservationCommand = new UpdateCommand({
      TableName: TABLES.RESERVATIONS,
      Key: { reservationId },
      UpdateExpression: 'SET #status = :status, #completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#completedAt': 'completedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':completedAt': new Date().toISOString(),
      },
    });

    await docClient.send(updateReservationCommand);

    const rideId = uuidv4();
    const now = new Date().toISOString();

    const ride = {
      rideId,
      userId,
      scooterId: reservation.scooterId,
      reservationId,
      status: 'active',
      startedAt: now,
      startBattery: 0,
      activationFee,
      lastChargedMinutes: 0,
      totalCharged: activationFee,
    };

    const createRideCommand = new PutCommand({
      TableName: TABLES.RIDES,
      Item: ride,
    });

    await docClient.send(createRideCommand);

    // Usuń z Redis
    await redis.del(`reservation:scooter:${reservation.scooterId}`);
    await redis.del(`reservation:user:${userId}`);

    // Zapisz aktywną jazdę w Redis
    await redis.set(`ride:user:${userId}`, rideId);
    await redis.set(`ride:scooter:${reservation.scooterId}`, rideId);

    await updateScooterStatus(reservation.scooterId, 'in_use');

    return ride;
  } catch (error) {
    console.error('Błąd rozpoczynania jazdy:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sprawdź czy hulajnoga jest zarezerwowana
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function isScooterReserved(scooterId) {
  try {
    // Sprawdź Redis
    const exists = await redis.exists(`reservation:scooter:${scooterId}`);
    if (exists === 1) return true;
    
    // Jeśli Redis wyłączony, sprawdź w DynamoDB
    if (!redis.isEnabled()) {
      return await isScooterReservedInDB(scooterId);
    }
    
    return false;
  } catch (error) {
    console.error('Błąd sprawdzania rezerwacji hulajnogi:', error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Wygaś przeterminowane rezerwacje (cronjob)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function expireOldReservations() {
  try {
    const command = new QueryCommand({
      TableName: TABLES.RESERVATIONS,
      FilterExpression: '#status = :status AND #expiresAt < :now',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#expiresAt': 'expiresAt',
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':now': new Date().toISOString(),
      },
    });

    const response = await docClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      return { expired: 0 };
    }

    const updatePromises = response.Items.map(async (reservation) => {
      const updateCommand = new UpdateCommand({
        TableName: TABLES.RESERVATIONS,
        Key: { reservationId: reservation.reservationId },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'expired',
        },
      });

      await docClient.send(updateCommand);
      await updateScooterStatus(reservation.scooterId, 'available');
    });

    await Promise.all(updatePromises);

    return { expired: response.Items.length };
  } catch (error) {
    console.error('Błąd wygaszania rezerwacji:', error);
    throw error;
  }
}