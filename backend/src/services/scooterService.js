import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import docClient, { TABLES } from '../dynamodb.js';
import redis from '../redisWrapper.js'; // ← Zmiana importu

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generuj skrót modelu dla identyfikatora
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateModelPrefix(model) {
  if (!model) return 'SC';
  
  const words = model.toUpperCase().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).replace(/[^A-Z0-9]/g, '');
  } else {
    return words.map(w => w[0]).join('').substring(0, 4).replace(/[^A-Z0-9]/g, '');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sprawdź czy identyfikator jest unikalny
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function isIdentifierUnique(identifier, excludeScooterId = null) {
  try {
    const command = new ScanCommand({
      TableName: TABLES.SCOOTERS,
      FilterExpression: '#identifier = :identifier',
      ExpressionAttributeNames: {
        '#identifier': 'identifier',
      },
      ExpressionAttributeValues: {
        ':identifier': identifier,
      },
    });

    const response = await docClient.send(command);
    const scooters = response.Items || [];
    
    if (excludeScooterId) {
      return !scooters.some(s => s.scooterId !== excludeScooterId);
    }
    
    return scooters.length === 0;
  } catch (error) {
    console.error('Błąd sprawdzania unikalności identyfikatora:', error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generuj unikalny identyfikator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateUniqueIdentifier(model, excludeScooterId = null) {
  const prefix = generateModelPrefix(model);
  let counter = 1;
  let identifier = `${prefix}-${String(counter).padStart(3, '0')}`;
  
  while (!(await isIdentifierUnique(identifier, excludeScooterId))) {
    counter++;
    identifier = `${prefix}-${String(counter).padStart(3, '0')}`;
    
    if (counter > 9999) {
      identifier = `${prefix}-${uuidv4().substring(0, 8).toUpperCase()}`;
      break;
    }
  }
  
  return identifier;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pomocnicza funkcja do czyszczenia cache
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function clearScooterCaches(scooterId = null) {
  try {
    if (scooterId) {
      await redis.del(`scooter:${scooterId}`);
    }
    
    const cacheKeys = await redis.keys('scooters:all:*');
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }
    await redis.del('scooters:stats');
    await redis.del('scooters:models');
  } catch (error) {
    console.warn('Błąd czyszczenia cache hulajnóg:', error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utwórz nową hulajnogę
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function createScooter({ model, latitude, longitude, battery = 100, identifier = null }) {
  try {
    const scooterId = uuidv4();
    const now = new Date().toISOString();

    let finalIdentifier = identifier;
    if (!finalIdentifier || finalIdentifier.trim() === '') {
      finalIdentifier = await generateUniqueIdentifier(model);
    } else {
      finalIdentifier = finalIdentifier.trim().toUpperCase();
      const isUnique = await isIdentifierUnique(finalIdentifier);
      if (!isUnique) {
        throw new Error(`Identyfikator "${finalIdentifier}" już istnieje. Musi być unikalny.`);
      }
    }

    const scooter = {
      scooterId,
      identifier: finalIdentifier,
      model,
      latitude,
      longitude,
      battery,
      status: 'available',
      createdAt: now,
      updatedAt: now,
      totalRides: 0,
      totalDistance: 0,
    };

    const command = new PutCommand({
      TableName: TABLES.SCOOTERS,
      Item: scooter,
    });

    await docClient.send(command);

    // Dodaj do Redis GEO (jeśli włączony)
    await redis.geoadd('scooters:locations', longitude, latitude, scooterId);

    // Zapisz w cache
    await redis.setex(`scooter:${scooterId}`, 300, JSON.stringify(scooter));

    // Wyczyść cache listy
    await clearScooterCaches();

    return scooter;
  } catch (error) {
    console.error('Błąd tworzenia hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz hulajnogę po ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getScooterById(scooterId) {
  try {
    // Sprawdź cache
    const cached = await redis.get(`scooter:${scooterId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const command = new GetCommand({
      TableName: TABLES.SCOOTERS,
      Key: { scooterId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    // Zapisz w cache na 5 minut
    await redis.setex(`scooter:${scooterId}`, 300, JSON.stringify(response.Item));

    return response.Item;
  } catch (error) {
    console.error('Błąd pobierania hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz wszystkie hulajnogi
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getAllScooters(limit = 100) {
  try {
    // Sprawdź cache
    const cacheKey = `scooters:all:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const command = new ScanCommand({
      TableName: TABLES.SCOOTERS,
      Limit: limit,
    });

    const response = await docClient.send(command);

    const result = {
      scooters: response.Items || [],
      lastKey: response.LastEvaluatedKey,
    };

    // Zapisz w cache na 2 minuty
    await redis.setex(cacheKey, 120, JSON.stringify(result));

    return result;
  } catch (error) {
    console.error('Błąd pobierania hulajnóg:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz hulajnogi po statusie
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getScootersByStatus(status, limit = 100) {
  try {
    const command = new QueryCommand({
      TableName: TABLES.SCOOTERS,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
    });

    const response = await docClient.send(command);

    return {
      scooters: response.Items || [],
      lastKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('Błąd pobierania hulajnóg po statusie:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz hulajnogi w promieniu (z fallbackiem na DynamoDB)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getScootersNearby(
  latitude,
  longitude,
  radius = 500,
  minBattery = 0,
  status = 'available',
  model = null
) {
  try {
    let scooterIds = [];
    
    // Próbuj użyć Redis GEOSEARCH jeśli włączony
    if (redis.isEnabled()) {
      scooterIds = await redis.geosearch(
        'scooters:locations',
        'FROMLONLAT',
        longitude,
        latitude,
        'BYRADIUS',
        radius,
        'm',
        'ASC'
      );
    }

    // Jeśli Redis wyłączony lub brak wyników, użyj DynamoDB (bez filtrowania geograficznego)
    if (!scooterIds || scooterIds.length === 0) {
      console.log('[ScooterService] Redis GEO niedostępny, używam DynamoDB fallback');
      
      // Pobierz wszystkie hulajnogi i filtruj po stronie aplikacji
      const allScooters = await getAllScooters(500);
      
      // Filtruj według odległości (Haversine formula)
      const filtered = (allScooters.scooters || []).filter(scooter => {
        const distance = calculateDistance(
          latitude, longitude,
          scooter.latitude, scooter.longitude
        );
        
        if (distance > radius) return false;
        if (scooter.battery < minBattery) return false;
        if (status !== null && status !== undefined && scooter.status !== status) return false;
        if (model && scooter.model !== model) return false;
        return true;
      });
      
      return filtered;
    }

    // Pobierz szczegóły każdej hulajnogi
    const scooters = await Promise.all(
      scooterIds.map(async (scooterId) => {
        const scooter = await getScooterById(scooterId);
        return scooter;
      })
    );

    // Filtruj po baterii, statusie i modelu
    const filtered = scooters.filter((s) => {
      if (!s) return false;
      if (s.battery < minBattery) return false;
      if (status !== null && status !== undefined && s.status !== status) return false;
      if (model && s.model !== model) return false;
      return true;
    });

    return filtered;
  } catch (error) {
    console.error('Błąd wyszukiwania hulajnóg w pobliżu:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pomocnicza funkcja do obliczania odległości (Haversine)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Promień Ziemi w metrach
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aktualizuj hulajnogę
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function updateScooter(scooterId, updates) {
  try {
    const allowedUpdates = ['identifier', 'model', 'latitude', 'longitude', 'battery', 'status'];
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (updates.identifier !== undefined) {
      const newIdentifier = updates.identifier.trim().toUpperCase();
      const isUnique = await isIdentifierUnique(newIdentifier, scooterId);
      if (!isUnique) {
        throw new Error(`Identyfikator "${newIdentifier}" już istnieje. Musi być unikalny.`);
      }
      updates.identifier = newIdentifier;
    }

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    if (updateExpressions.length === 0) {
      throw new Error('Brak prawidłowych pól do aktualizacji');
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: TABLES.SCOOTERS,
      Key: { scooterId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);

    // Aktualizuj pozycję w Redis GEO jeśli zmieniono współrzędne
    if (updates.latitude && updates.longitude) {
      await redis.geoadd(
        'scooters:locations',
        updates.longitude,
        updates.latitude,
        scooterId
      );
    }

    // Wyczyść cache
    await clearScooterCaches(scooterId);

    return response.Attributes;
  } catch (error) {
    console.error('Błąd aktualizacji hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Usuń hulajnogę
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function deleteScooter(scooterId) {
  try {
    const command = new DeleteCommand({
      TableName: TABLES.SCOOTERS,
      Key: { scooterId },
    });

    await docClient.send(command);

    // Usuń z Redis GEO i cache
    await redis.zrem('scooters:locations', scooterId);
    await clearScooterCaches(scooterId);

    return { success: true };
  } catch (error) {
    console.error('Błąd usuwania hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Zmień status hulajnogi
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function updateScooterStatus(scooterId, status) {
  try {
    const validStatuses = ['available', 'reserved', 'in_use', 'maintenance'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Nieprawidłowy status. Dostępne: ${validStatuses.join(', ')}`);
    }

    return await updateScooter(scooterId, { status });
  } catch (error) {
    console.error('Błąd zmiany statusu hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aktualizuj poziom baterii
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function updateScooterBattery(scooterId, battery) {
  try {
    if (battery < 0 || battery > 100) {
      throw new Error('Poziom baterii musi być między 0 a 100');
    }

    return await updateScooter(scooterId, { battery });
  } catch (error) {
    console.error('Błąd aktualizacji baterii hulajnogi:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz listę dostępnych modeli
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getAvailableModels() {
  try {
    const cacheKey = 'scooters:models';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const command = new ScanCommand({
      TableName: TABLES.SCOOTERS,
      ProjectionExpression: 'model',
    });

    const response = await docClient.send(command);
    const scooters = response.Items || [];

    const models = [...new Set(scooters.map((s) => s.model).filter(Boolean))].sort();

    // Zapisz w cache na 5 minut
    await redis.setex(cacheKey, 300, JSON.stringify(models));

    return models;
  } catch (error) {
    console.error('Błąd pobierania modeli:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz statystyki hulajnóg
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getScooterStats() {
  try {
    const cacheKey = 'scooters:stats';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const command = new ScanCommand({
      TableName: TABLES.SCOOTERS,
    });

    const response = await docClient.send(command);
    const scooters = response.Items || [];

    const stats = {
      total: scooters.length,
      available: scooters.filter((s) => s.status === 'available').length,
      reserved: scooters.filter((s) => s.status === 'reserved').length,
      in_use: scooters.filter((s) => s.status === 'in_use').length,
      maintenance: scooters.filter((s) => s.status === 'maintenance').length,
      lowBattery: scooters.filter((s) => s.battery < 20).length,
      avgBattery:
        scooters.length > 0
          ? Math.round(scooters.reduce((sum, s) => sum + s.battery, 0) / scooters.length)
          : 0,
    };

    // Zapisz w cache na 1 minutę
    await redis.setex(cacheKey, 60, JSON.stringify(stats));

    return stats;
  } catch (error) {
    console.error('Błąd pobierania statystyk hulajnóg:', error);
    throw error;
  }
}