import express from 'express';
import redis from '../redis.js';
import { seedScooters, getScootersNearby } from '../utils/seedData.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. POST /api/seed - Reset i generowanie danych
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/seed', async (req, res) => {
  try {
    await seedScooters();
    res.json({ success: true, message: 'Dane załadowane' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. GET /api/scooters - Pobierz hulajnogi w promieniu
// Query: ?lat=50.0647&lon=19.9450&dist=500&minBattery=50
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/scooters', async (req, res) => {
  try {
    const { lat, lon, dist = 500, minBattery = 0 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Brakuje lat i lon' });
    }

    // Pobierz hulajnogi w promieniu
    const scooterIds = await redis.geosearch(
      'scooters:locations',
      'FROMLONLAT',
      parseFloat(lon),
      parseFloat(lat),
      'BYRADIUS',
      parseInt(dist),
      'm'
    );

    if (!scooterIds || scooterIds.length === 0) {
      return res.json({ scooters: [] });
    }

    // Pobierz szczegóły każdej hulajnogi
    const scooters = await Promise.all(
      scooterIds.map(async (scooterId) => {
        const data = await redis.hgetall(scooterId);
        const reserved = await redis.exists(`reservation:${scooterId}`);

        return {
          id: scooterId,
          ...data,
          battery: parseInt(data.battery),
          reserved: reserved === 1,
        };
      })
    );

    // Filtrowanie po baterii
    const filtered = scooters.filter(
      (s) => parseInt(s.battery) >= parseInt(minBattery)
    );

    res.json({ scooters: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. GET /api/scooters/:id - Pobierz szczegóły hulajnogi
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/scooters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await redis.hgetall(`scooter:${id}`);

    if (!data || Object.keys(data).length === 0) {
      return res.status(404).json({ error: 'Hulajnoga nie znaleziona' });
    }

    const reserved = await redis.exists(`reservation:scooter:${id}`);

    res.json({
      id: `scooter:${id}`,
      ...data,
      battery: parseInt(data.battery),
      reserved: reserved === 1,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. POST /api/reserve - Zarezerwuj hulajnogę na 5 minut
// Body: { scooterId: "scooter:1", userId: "user_123" }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/reserve', async (req, res) => {
  try {
    const { scooterId, userId } = req.body;

    if (!scooterId || !userId) {
      return res.status(400).json({ error: 'Brakuje scooterId lub userId' });
    }

    // SET NX EX - Atomowa operacja: ustaw klucz jeśli nie istnieje, TTL 300s (5 min)
    const result = await redis.set(
      `reservation:${scooterId}`,
      userId,
      'NX',
      'EX',
      300
    );

    if (result === 'OK') {
      res.json({
        success: true,
        message: 'Hulajnoga zarezerwowana na 5 minut',
        scooterId,
        expiresIn: 300,
      });
    } else {
      res.status(409).json({
        success: false,
        error: 'Hulajnoga już zarezerwowana',
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. POST /api/unreserve - Anuluj rezerwację
// Body: { scooterId: "scooter:1" }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/unreserve', async (req, res) => {
  try {
    const { scooterId } = req.body;
    await redis.del(`reservation:${scooterId}`);
    res.json({ success: true, message: 'Rezerwacja anulowana' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. GET /api/stats - Statystyki bazy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/stats', async (req, res) => {
  try {
    const keys = await redis.keys('scooter:*');
    const reservations = await redis.keys('reservation:*');

    res.json({
      total_scooters: keys.length,
      reserved: reservations.length,
      available: keys.length - reservations.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
