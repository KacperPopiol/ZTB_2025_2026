import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import docClient, { TABLES } from '../dynamodb.js';
import redis from '../redis.js';
import { getScooterById, updateScooterStatus } from './scooterService.js';
import { getActivationFee } from './pricingService.js';
import { deductFromWallet } from './userService.js';

// Czas rezerwacji w sekundach (domyślnie 5 minut)
const RESERVATION_TTL = 300;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utwórz rezerwację
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function createReservation(userId, scooterId) {
  try {
    // Sprawdź czy hulajnoga istnieje i jest dostępna
    const scooter = await getScooterById(scooterId);

    if (!scooter) {
      throw new Error('Hulajnoga nie została znaleziona');
    }

    if (scooter.status !== 'available') {
      throw new Error('Hulajnoga nie jest dostępna');
    }

    // Sprawdź czy użytkownik nie ma już aktywnej rezerwacji
    const existingReservation = await getActiveReservationByUser(userId);
    if (existingReservation) {
      throw new Error('Masz już aktywną rezerwację');
    }

    // Sprawdź czy hulajnoga nie jest już zarezerwowana (Redis)
    const redisKey = `reservation:scooter:${scooterId}`;
    const exists = await redis.exists(redisKey);
    if (exists) {
      throw new Error('Hulajnoga jest już zarezerwowana');
    }

    // Rezerwacja blokuje hulajnogę na 5 minut
    const reservationId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESERVATION_TTL * 1000).toISOString();

    const reservation = {
      reservationId,
      userId,
      scooterId,
      status: 'active', // active, completed, cancelled, expired
      price: 0,
      createdAt: now,
      expiresAt,
    };

    // Zapisz w DynamoDB
    const command = new PutCommand({
      TableName: TABLES.RESERVATIONS,
      Item: reservation,
    });

    await docClient.send(command);

    // Zapisz w Redis z TTL (atomowa operacja)
    await redis.set(redisKey, userId, 'EX', RESERVATION_TTL);
    await redis.set(`reservation:user:${userId}`, reservationId, 'EX', RESERVATION_TTL);

    // Zmień status hulajnogi
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

    // Sprawdź DynamoDB
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
    // Pobierz rezerwację
    const reservation = await getReservationById(reservationId);

    if (!reservation) {
      throw new Error('Rezerwacja nie została znaleziona');
    }

    // Sprawdź czy użytkownik jest właścicielem rezerwacji
    if (reservation.userId !== userId) {
      throw new Error('Nie masz uprawnień do anulowania tej rezerwacji');
    }

    if (reservation.status !== 'active') {
      throw new Error('Rezerwacja nie jest aktywna');
    }

    // Aktualizuj status w DynamoDB
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

    // Zmień status hulajnogi na dostępną
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
    // Pobierz rezerwację
    const reservation = await getReservationById(reservationId);

    if (!reservation) {
      throw new Error('Rezerwacja nie została znaleziona');
    }

    // Sprawdź czy użytkownik jest właścicielem rezerwacji
    if (reservation.userId !== userId) {
      throw new Error('Nie masz uprawnień do tej rezerwacji');
    }

    if (reservation.status !== 'active') {
      throw new Error('Rezerwacja nie jest aktywna');
    }

    // Pobierz opłatę aktywacyjną i sprawdź portfel
    const activationFee = await getActivationFee();
    await deductFromWallet(userId, activationFee);

    // Aktualizuj status rezerwacji
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

    // Utwórz nową jazdę
    const rideId = uuidv4();
    const now = new Date().toISOString();

    const ride = {
      rideId,
      userId,
      scooterId: reservation.scooterId,
      reservationId,
      status: 'active', // active, completed
      startedAt: now,
      startBattery: 0, // Zostanie zaktualizowane
      activationFee, // Opłata aktywacyjna
      lastChargedMinutes: 0, // Ostatnia minuta za którą pobrano opłatę
      totalCharged: activationFee, // Całkowita pobrana opłata (włącznie z opłatą aktywacyjną)
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

    // Zmień status hulajnogi
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
    const exists = await redis.exists(`reservation:scooter:${scooterId}`);
    return exists === 1;
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
    // Redis automatycznie usuwa klucze z TTL
    // Tutaj aktualizujemy status w DynamoDB dla rezerwacji, które wygasły

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

    // Aktualizuj każdą wygasłą rezerwację
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

      // Zmień status hulajnogi na dostępną
      await updateScooterStatus(reservation.scooterId, 'available');
    });

    await Promise.all(updatePromises);

    return { expired: response.Items.length };
  } catch (error) {
    console.error('Błąd wygaszania rezerwacji:', error);
    throw error;
  }
}
