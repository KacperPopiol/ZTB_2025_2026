import express from 'express';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.js';
import {
  createScooter,
  getScooterById,
  getAllScooters,
  getScootersByStatus,
  getScootersNearby,
  getScootersInBounds,
  updateScooter,
  deleteScooter,
  updateScooterStatus,
  updateScooterBattery,
  getScooterStats,
  getAvailableModels,
} from '../services/scooterService.js';
import { isScooterReserved } from '../services/reservationService.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC / USER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/scooters - Pobierz hulajnogi w promieniu (opcjonalna autentykacja)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { lat, lon, radius, minBattery, status, model, sortBy } = req.query;

    // Jeśli podano współrzędne, wyszukaj w promieniu
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const radiusMeters = parseInt(radius) || 500;
      const minBatt = parseInt(minBattery) || 0;
      // Jeśli status jest pustym stringiem, oznacza "wszystkie" - przekaż null
      const statusFilter = status === '' ? null : (status || 'available');
      const modelFilter = model || null;

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: 'Nieprawidłowe współrzędne' });
      }

      let scooters = await getScootersNearby(
        latitude,
        longitude,
        radiusMeters,
        minBatt,
        statusFilter,
        modelFilter
      );

      // Sortowanie
      if (sortBy === 'battery') {
        scooters.sort((a, b) => b.battery - a.battery);
      } else if (sortBy === 'battery-asc') {
        scooters.sort((a, b) => a.battery - b.battery);
      } else if (sortBy === 'model') {
        scooters.sort((a, b) => (a.model || '').localeCompare(b.model || ''));
      }

      return res.json({
        success: true,
        count: scooters.length,
        scooters,
      });
    }

    // W przeciwnym razie pobierz wszystkie (tylko dla adminów)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(400).json({
        error: 'Wymagane parametry: lat, lon (lub uprawnienia administratora)',
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const result = await getAllScooters(limit);

    res.json({
      success: true,
      count: result.scooters.length,
      scooters: result.scooters,
      lastKey: result.lastKey,
    });
  } catch (error) {
    console.error('Błąd pobierania hulajnóg:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOWY ENDPOINT: GET /api/scooters/all - Pobierz wszystkie hulajnogi Z PAGINACJĄ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const lastEvaluatedKey = req.query.lastEvaluatedKey 
      ? JSON.parse(req.query.lastEvaluatedKey)
      : null;

    const result = await getAllScooters(limit, lastEvaluatedKey);

    res.json({
      success: true,
      scooters: result.scooters,
      lastEvaluatedKey: result.lastEvaluatedKey,
      hasMore: result.hasMore,
      count: result.count,
    });
  } catch (error) {
    console.error('Błąd pobierania hulajnóg:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania hulajnóg',
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOWY ENDPOINT: POST /api/scooters/bounds - Pobierz hulajnogi w granicach mapy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/bounds', async (req, res) => {
  try {
    const { bounds, limit = 500, status = null } = req.body;

    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return res.status(400).json({
        success: false,
        error: 'Nieprawidłowe granice mapy',
      });
    }

    const result = await getScootersInBounds(bounds, limit, status);

    res.json({
      success: true,
      scooters: result.scooters,
      count: result.count,
    });
  } catch (error) {
    console.error('Błąd pobierania hulajnóg w granicach:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania hulajnóg',
    });
  }
});

// GET /api/scooters/stats - Statystyki hulajnóg
router.get('/stats', async (req, res) => {
  try {
    const stats = await getScooterStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/scooters/models - Pobierz listę dostępnych modeli
router.get('/models', async (req, res) => {
  try {
    const models = await getAvailableModels();

    res.json({
      success: true,
      models,
    });
  } catch (error) {
    console.error('Błąd pobierania modeli:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/scooters/:scooterId - Pobierz szczegóły hulajnogi
router.get('/:scooterId', async (req, res) => {
  try {
    const { scooterId } = req.params;
    const scooter = await getScooterById(scooterId);

    if (!scooter) {
      return res.status(404).json({ error: 'Hulajnoga nie znaleziona' });
    }

    // Sprawdź czy zarezerwowana
    const reserved = await isScooterReserved(scooterId);

    res.json({
      success: true,
      scooter: {
        ...scooter,
        reserved,
      },
    });
  } catch (error) {
    console.error('Błąd pobierania hulajnogi:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/scooters - Utwórz nową hulajnogę (tylko admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { model, latitude, longitude, battery, identifier } = req.body;

    // Walidacja
    if (!model || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Wymagane pola: model, latitude, longitude',
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const batt = battery !== undefined ? parseInt(battery) : 100;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Nieprawidłowe współrzędne' });
    }

    if (batt < 0 || batt > 100) {
      return res.status(400).json({ error: 'Poziom baterii musi być między 0 a 100' });
    }

    // Walidacja identyfikatora (opcjonalny, ale jeśli podany, musi być unikalny)
    if (identifier && typeof identifier !== 'string') {
      return res.status(400).json({ error: 'Identyfikator musi być tekstem' });
    }

    const scooter = await createScooter({
      model,
      latitude: lat,
      longitude: lon,
      battery: batt,
      identifier: identifier || null,
    });

    res.status(201).json({
      success: true,
      message: 'Hulajnoga utworzona',
      scooter,
    });
  } catch (error) {
    console.error('Błąd tworzenia hulajnogi:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/scooters/status/:status - Pobierz hulajnogi po statusie (tylko admin)
router.get('/status/:status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const validStatuses = ['available', 'reserved', 'in_use', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Nieprawidłowy status. Dostępne: ${validStatuses.join(', ')}`,
      });
    }

    const result = await getScootersByStatus(status, limit);

    res.json({
      success: true,
      count: result.scooters.length,
      scooters: result.scooters,
      lastKey: result.lastKey,
    });
  } catch (error) {
    console.error('Błąd pobierania hulajnóg po statusie:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/scooters/:scooterId - Aktualizuj hulajnogę (tylko admin)
router.put('/:scooterId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { scooterId } = req.params;
    const { model, latitude, longitude, battery, status, identifier } = req.body;

    const updates = {};
    if (identifier !== undefined) {
      if (typeof identifier !== 'string' || identifier.trim() === '') {
        return res.status(400).json({ error: 'Identyfikator musi być niepustym tekstem' });
      }
      updates.identifier = identifier;
    }
    if (model !== undefined) updates.model = model;
    if (latitude !== undefined) updates.latitude = parseFloat(latitude);
    if (longitude !== undefined) updates.longitude = parseFloat(longitude);
    if (battery !== undefined) {
      const batt = parseInt(battery);
      if (batt < 0 || batt > 100) {
        return res.status(400).json({ error: 'Poziom baterii musi być między 0 a 100' });
      }
      updates.battery = batt;
    }
    if (status !== undefined) {
      const validStatuses = ['available', 'reserved', 'in_use', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Nieprawidłowy status. Dostępne: ${validStatuses.join(', ')}`,
        });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Podaj co najmniej jedno pole do aktualizacji',
      });
    }

    const updatedScooter = await updateScooter(scooterId, updates);

    res.json({
      success: true,
      message: 'Hulajnoga zaktualizowana',
      scooter: updatedScooter,
    });
  } catch (error) {
    console.error('Błąd aktualizacji hulajnogi:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PATCH /api/scooters/:scooterId/status - Zmień status hulajnogi (tylko admin)
router.patch('/:scooterId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { scooterId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status jest wymagany' });
    }

    const updatedScooter = await updateScooterStatus(scooterId, status);

    res.json({
      success: true,
      message: 'Status hulajnogi zaktualizowany',
      scooter: updatedScooter,
    });
  } catch (error) {
    console.error('Błąd zmiany statusu hulajnogi:', error);

    if (error.message.includes('Nieprawidłowy status')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PATCH /api/scooters/:scooterId/battery - Aktualizuj poziom baterii (tylko admin)
router.patch('/:scooterId/battery', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { scooterId } = req.params;
    const { battery } = req.body;

    if (battery === undefined) {
      return res.status(400).json({ error: 'Poziom baterii jest wymagany' });
    }

    const batt = parseInt(battery);
    const updatedScooter = await updateScooterBattery(scooterId, batt);

    res.json({
      success: true,
      message: 'Poziom baterii zaktualizowany',
      scooter: updatedScooter,
    });
  } catch (error) {
    console.error('Błąd aktualizacji baterii hulajnogi:', error);

    if (error.message.includes('musi być między')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/scooters/:scooterId - Usuń hulajnogę (tylko admin)
router.delete('/:scooterId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { scooterId } = req.params;

    // Sprawdź czy hulajnoga istnieje
    const scooter = await getScooterById(scooterId);
    if (!scooter) {
      return res.status(404).json({ error: 'Hulajnoga nie znaleziona' });
    }

    // Nie pozwól usunąć hulajnogi w użyciu lub zarezerwowanej
    if (scooter.status === 'in_use' || scooter.status === 'reserved') {
      return res.status(400).json({
        error: 'Nie można usunąć hulajnogi w użyciu lub zarezerwowanej',
      });
    }

    await deleteScooter(scooterId);

    res.json({
      success: true,
      message: 'Hulajnoga została usunięta',
    });
  } catch (error) {
    console.error('Błąd usuwania hulajnogi:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;