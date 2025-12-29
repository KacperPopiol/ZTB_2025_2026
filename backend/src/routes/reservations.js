import express from 'express';
import { authenticateToken, requireUser, requireAdmin } from '../middleware/auth.js';
import {
  createReservation,
  getReservationById,
  getActiveReservationByUser,
  getUserReservations,
  cancelReservation,
  startRide,
} from '../services/reservationService.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/reservations - Utwórz rezerwację
router.post('/', authenticateToken, requireUser, async (req, res) => {
  try {
    const { scooterId } = req.body;

    if (!scooterId) {
      return res.status(400).json({ error: 'scooterId jest wymagany' });
    }

    const reservation = await createReservation(req.user.userId, scooterId);

    res.status(201).json({
      success: true,
      message: 'Rezerwacja utworzona',
      reservation,
    });
  } catch (error) {
    console.error('Błąd tworzenia rezerwacji:', error);

    if (
      error.message.includes('nie została znaleziona') ||
      error.message.includes('nie jest dostępna') ||
      error.message.includes('już aktywną rezerwację') ||
      error.message.includes('już zarezerwowana') ||
      error.message.includes('Niewystarczające środki')
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/reservations/me - Pobierz aktywną rezerwację użytkownika
router.get('/me', authenticateToken, requireUser, async (req, res) => {
  try {
    const reservation = await getActiveReservationByUser(req.user.userId);

    if (!reservation) {
      return res.json({
        success: true,
        reservation: null,
        message: 'Brak aktywnej rezerwacji',
      });
    }

    res.json({
      success: true,
      reservation,
    });
  } catch (error) {
    console.error('Błąd pobierania aktywnej rezerwacji:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/reservations/history - Historia rezerwacji użytkownika
router.get('/history', authenticateToken, requireUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await getUserReservations(req.user.userId, limit);

    res.json({
      success: true,
      count: result.reservations.length,
      reservations: result.reservations,
      lastKey: result.lastKey,
    });
  } catch (error) {
    console.error('Błąd pobierania historii rezerwacji:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/reservations/:reservationId - Pobierz szczegóły rezerwacji
router.get('/:reservationId', authenticateToken, requireUser, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = await getReservationById(reservationId);

    if (!reservation) {
      return res.status(404).json({ error: 'Rezerwacja nie znaleziona' });
    }

    // Sprawdź czy użytkownik jest właścicielem (lub adminem)
    if (reservation.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak dostępu do tej rezerwacji' });
    }

    res.json({
      success: true,
      reservation,
    });
  } catch (error) {
    console.error('Błąd pobierania rezerwacji:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/reservations/:reservationId - Anuluj rezerwację
router.delete('/:reservationId', authenticateToken, requireUser, async (req, res) => {
  try {
    const { reservationId } = req.params;

    const result = await cancelReservation(reservationId, req.user.userId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Błąd anulowania rezerwacji:', error);

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

// POST /api/reservations/:reservationId/start - Rozpocznij jazdę
router.post('/:reservationId/start', authenticateToken, requireUser, async (req, res) => {
  try {
    const { reservationId } = req.params;

    const ride = await startRide(reservationId, req.user.userId);

    res.json({
      success: true,
      message: 'Jazda rozpoczęta',
      ride,
    });
  } catch (error) {
    console.error('Błąd rozpoczynania jazdy:', error);

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
