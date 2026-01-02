import { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import docClient, { TABLES } from '../dynamodb.js';
import redis from '../redis.js';
import { getPricing } from './pricingService.js';
import { deductFromWallet, getUserById } from './userService.js';
import { updateScooterStatus } from './scooterService.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz aktywną jazdę użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getActiveRideByUser(userId) {
  try {
    // Sprawdź Redis
    const rideId = await redis.get(`ride:user:${userId}`);
    if (rideId) {
      const ride = await getRideById(rideId);
      if (ride && ride.status === 'active') {
        return ride;
      }
    }

    // Sprawdź DynamoDB
    const command = new QueryCommand({
      TableName: TABLES.RIDES,
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
    console.error('Błąd pobierania aktywnej jazdy użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz jazdę po ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getRideById(rideId) {
  try {
    const command = new GetCommand({
      TableName: TABLES.RIDES,
      Key: { rideId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item;
  } catch (error) {
    console.error('Błąd pobierania jazdy:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Zakończ jazdę
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function endRide(rideId, userId) {
  try {
    // Pobierz jazdę
    const ride = await getRideById(rideId);

    if (!ride) {
      throw new Error('Jazda nie została znaleziona');
    }

    // Sprawdź czy użytkownik jest właścicielem jazdy
    if (ride.userId !== userId) {
      throw new Error('Nie masz uprawnień do zakończenia tej jazdy');
    }

    if (ride.status !== 'active') {
      throw new Error('Jazda nie jest aktywna');
    }

    const now = new Date();
    const startedAt = new Date(ride.startedAt);
    const durationMinutes = Math.ceil((now - startedAt) / (1000 * 60)); // Zaokrąglenie w górę

    // Oblicz końcową cenę - pobierz opłatę za minuty, które jeszcze nie zostały pobrane
    const pricing = await getPricing();
    const lastChargedMinutes = ride.lastChargedMinutes || 0;
    const minutesToCharge = durationMinutes - lastChargedMinutes;
    
    let totalPrice = ride.totalCharged || 0;
    
    // Jeśli są minuty do pobrania, pobierz opłatę
    if (minutesToCharge > 0) {
      const chargeAmount = minutesToCharge * pricing.ridePerMinute;
      
      // Sprawdź czy użytkownik ma wystarczające środki
      const user = await getUserById(ride.userId);
      const currentBalance = user.walletBalance || 0;
      
      if (currentBalance >= chargeAmount) {
        // Pobierz opłatę
        await deductFromWallet(ride.userId, chargeAmount);
        totalPrice += chargeAmount;
      } else {
        // Jeśli brak środków, pobierz tyle ile jest dostępne
        if (currentBalance > 0) {
          await deductFromWallet(ride.userId, currentBalance);
          totalPrice += currentBalance;
        }
      }
    }

    // Aktualizuj status jazdy
    const command = new UpdateCommand({
      TableName: TABLES.RIDES,
      Key: { rideId },
      UpdateExpression: 'SET #status = :status, #endedAt = :endedAt, #durationMinutes = :durationMinutes, #totalPrice = :totalPrice, #lastChargedMinutes = :lastChargedMinutes',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#endedAt': 'endedAt',
        '#durationMinutes': 'durationMinutes',
        '#totalPrice': 'totalPrice',
        '#lastChargedMinutes': 'lastChargedMinutes',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':endedAt': now.toISOString(),
        ':durationMinutes': durationMinutes,
        ':totalPrice': totalPrice,
        ':lastChargedMinutes': durationMinutes,
      },
      ReturnValues: 'ALL_NEW',
    });

    await docClient.send(command);

    // Usuń z Redis
    await redis.del(`ride:user:${userId}`);
    await redis.del(`ride:scooter:${ride.scooterId}`);
    await redis.del(`ride:charge:${rideId}`);

    // Zmień status hulajnogi na dostępną
    await updateScooterStatus(ride.scooterId, 'available');

    return {
      success: true,
      message: 'Jazda zakończona',
      ride: {
        ...ride,
        status: 'completed',
        endedAt: now.toISOString(),
        durationMinutes,
        totalPrice,
      },
    };
  } catch (error) {
    console.error('Błąd zakończenia jazdy:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz opłatę za minutę
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getRidePerMinutePrice() {
  const pricing = await getPricing();
  return pricing.ridePerMinute;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz opłatę za aktywną jazdę (co minutę)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function chargeForActiveRides() {
  try {
    // Pobierz wszystkie aktywne jazdy
    const command = new ScanCommand({
      TableName: TABLES.RIDES,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'active',
      },
    });

    const response = await docClient.send(command);
    const activeRides = response.Items || [];

    if (activeRides.length === 0) {
      return { charged: 0, ended: 0 };
    }

    const pricing = await getPricing();
    const pricePerMinute = pricing.ridePerMinute;
    let charged = 0;
    let ended = 0;

    // Przetwórz każdą aktywną jazdę
    for (const ride of activeRides) {
      try {
        const now = new Date();
        const startedAt = new Date(ride.startedAt);
        const elapsedMinutes = Math.ceil((now - startedAt) / (1000 * 60)); // Zaokrąglenie w górę - każda rozpoczęta minuta jest płatna
        const lastChargedMinutes = ride.lastChargedMinutes || 0;

        // Jeśli minęła nowa minuta, pobierz opłatę
        if (elapsedMinutes > lastChargedMinutes) {
          const minutesToCharge = elapsedMinutes - lastChargedMinutes;
          const chargeAmount = minutesToCharge * pricePerMinute;

          // Sprawdź czy użytkownik ma wystarczające środki
          const user = await getUserById(ride.userId);
          const currentBalance = user.walletBalance || 0;

          if (currentBalance < chargeAmount) {
            // Zakończ jazdę - brak środków
            console.log(`Brak środków dla jazdy ${ride.rideId}, kończenie jazdy...`);
            await endRide(ride.rideId, ride.userId);
            ended++;
            continue;
          }

          // Pobierz opłatę
          await deductFromWallet(ride.userId, chargeAmount);

          // Zaktualizuj jazdę
          const updateCommand = new UpdateCommand({
            TableName: TABLES.RIDES,
            Key: { rideId: ride.rideId },
            UpdateExpression: 'SET #lastChargedMinutes = :lastChargedMinutes, #totalCharged = if_not_exists(#totalCharged, :zero) + :chargeAmount, #lastChargedAt = :lastChargedAt',
            ExpressionAttributeNames: {
              '#lastChargedMinutes': 'lastChargedMinutes',
              '#totalCharged': 'totalCharged',
              '#lastChargedAt': 'lastChargedAt',
            },
            ExpressionAttributeValues: {
              ':lastChargedMinutes': elapsedMinutes,
              ':chargeAmount': chargeAmount,
              ':zero': 0,
              ':lastChargedAt': now.toISOString(),
            },
          });

          await docClient.send(updateCommand);
          charged++;
        }
      } catch (error) {
        console.error(`Błąd pobierania opłaty za jazdę ${ride.rideId}:`, error);
        // Jeśli błąd to brak środków, zakończ jazdę
        if (error.message.includes('Niewystarczające środki')) {
          try {
            await endRide(ride.rideId, ride.userId);
            ended++;
          } catch (endError) {
            console.error(`Błąd zakończenia jazdy ${ride.rideId}:`, endError);
          }
        }
      }
    }

    return { charged, ended };
  } catch (error) {
    console.error('Błąd pobierania opłat za aktywne jazdy:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz wszystkie jazdy użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getUserRides(userId, limit = 20) {
  try {
    const command = new QueryCommand({
      TableName: TABLES.RIDES,
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
      rides: response.Items || [],
      lastKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('Błąd pobierania jazd użytkownika:', error);
    throw error;
  }
}

