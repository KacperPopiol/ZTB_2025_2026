import redis from '../redis.js';
import { faker } from '@faker-js/faker';

// Współrzędne: Kraków (centrum)
const CITY_CENTER = { lat: 50.0647, lon: 19.9450 };
const CITY_RADIUS_KM = 2;

function generateRandomCoordinates() {
  const latOffset = (Math.random() - 0.5) * (CITY_RADIUS_KM / 111);
  const lonOffset = (Math.random() - 0.5) * (CITY_RADIUS_KM / 111);
  
  return {
    lat: CITY_CENTER.lat + latOffset,
    lon: CITY_CENTER.lon + lonOffset,
  };
}

export async function seedScooters() {
  try {
    // Czyszczenie bazy
    await redis.flushdb();
    console.log('🗑️ Baza czyszczona');

    // Tworzenie 50 hulajnóg
    for (let i = 1; i <= 50; i++) {
      const scooterId = `scooter:${i}`;
      const { lat, lon } = generateRandomCoordinates();
      const battery = Math.floor(Math.random() * 100) + 1; // 1-100%
      const models = ['Xiaomi 3', 'Ninebot Max', 'Segway', 'Dualtron'];
      const model = models[Math.floor(Math.random() * models.length)];

      // 1. Dodaj do GEO (mapy)
      await redis.geoadd('scooters:locations', lon, lat, scooterId);

      // 2. Dodaj szczegóły (HASH)
      await redis.hset(scooterId, {
        model,
        battery,
        status: 'available',
        created_at: new Date().toISOString(),
      });
    }

    console.log('✅ 50 hulajnóg wygenerowanych');
  } catch (error) {
    console.error('❌ Błąd seedowania:', error);
  }
}

export async function getScootersNearby(lat, lon, distance = 500) {
  try {
    // GEOSEARCH - pobiera hulajnogi w promieniu distance metrów
    const scooters = await redis.geosearch(
      'scooters:locations',
      'FROMMEMBER',
      'scooter:1', // dummy
      'BYRADIUS',
      distance,
      'm',
      'WITHDIST',
      'WITHCOORD'
    );

    // Alternatywa z użyciem FROMLONLAT (dokładniej)
    const result = await redis.geosearch(
      'scooters:locations',
      'FROMLONLAT',
      lon,
      lat,
      'BYRADIUS',
      distance,
      'm'
    );

    return result;
  } catch (error) {
    console.error('❌ Błąd wyszukiwania:', error);
    return [];
  }
}
