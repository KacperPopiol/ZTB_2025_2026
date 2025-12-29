import express from 'express';
import { authenticateToken, requireUser } from '../middleware/auth.js';
import {
  getActiveRideByUser,
  endRide,
  getUserRides,
  getRideById,
} from '../services/rideService.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/rides/me - Pobierz aktywną jazdę użytkownika
router.get('/me', authenticateToken, requireUser, async (req, res) => {
  try {
    const ride = await getActiveRideByUser(req.user.userId);

    if (!ride) {
      return res.json({
        success: true,
        ride: null,
        message: 'Brak aktywnej jazdy',
      });
    }

    res.json({
      success: true,
      ride,
    });
  } catch (error) {
    console.error('Błąd pobierania aktywnej jazdy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/rides/history - Historia jazd użytkownika
router.get('/history', authenticateToken, requireUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await getUserRides(req.user.userId, limit);

    res.json({
      success: true,
      count: result.rides.length,
      rides: result.rides,
      lastKey: result.lastKey,
    });
  } catch (error) {
    console.error('Błąd pobierania historii jazd:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/rides/:rideId - Pobierz szczegóły jazdy
router.get('/:rideId', authenticateToken, requireUser, async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await getRideById(rideId);

    if (!ride) {
      return res.status(404).json({ error: 'Jazda nie znaleziona' });
    }

    // Sprawdź czy użytkownik jest właścicielem (lub adminem)
    if (ride.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak dostępu do tej jazdy' });
    }

    res.json({
      success: true,
      ride,
    });
  } catch (error) {
    console.error('Błąd pobierania jazdy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/rides/:rideId/end - Zakończ jazdę
router.post('/:rideId/end', authenticateToken, requireUser, async (req, res) => {
  try {
    const { rideId } = req.params;

    const result = await endRide(rideId, req.user.userId);

    res.json({
      success: true,
      message: result.message,
      ride: result.ride,
    });
  } catch (error) {
    console.error('Błąd zakończenia jazdy:', error);

    if (
      error.message.includes('nie została znaleziona') ||
      error.message.includes('Nie masz uprawnień') ||
      error.message.includes('nie jest aktywna')
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;

