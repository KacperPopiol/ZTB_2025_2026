import express from 'express';
import { authenticateToken, requireAdmin, requireUser } from '../middleware/auth.js';
import {
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
  getAllUsers,
} from '../services/userService.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/users/me - Pobierz dane zalogowanego użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/me', authenticateToken, requireUser, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Błąd pobierania danych użytkownika:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/users/me - Aktualizuj dane zalogowanego użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/me', authenticateToken, requireUser, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName && !lastName) {
      return res.status(400).json({
        error: 'Podaj co najmniej jedno pole do aktualizacji',
      });
    }

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;

    const updatedUser = await updateUser(req.user.userId, updates);

    res.json({
      success: true,
      message: 'Dane użytkownika zaktualizowane',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Błąd aktualizacji użytkownika:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/users/me/change-password - Zmień hasło
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/me/change-password', authenticateToken, requireUser, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Stare i nowe hasło są wymagane',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Nowe hasło musi mieć co najmniej 6 znaków',
      });
    }

    await changePassword(req.user.userId, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Hasło zostało zmienione',
    });
  } catch (error) {
    console.error('Błąd zmiany hasła:', error);

    if (error.message.includes('Nieprawidłowe stare hasło')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/users/me - Usuń swoje konto
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/me', authenticateToken, requireUser, async (req, res) => {
  try {
    await deleteUser(req.user.userId);

    res.json({
      success: true,
      message: 'Konto zostało usunięte',
    });
  } catch (error) {
    console.error('Błąd usuwania konta:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/users - Pobierz wszystkich użytkowników (tylko admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await getAllUsers(limit);

    res.json({
      success: true,
      users: result.users,
      count: result.users.length,
      lastKey: result.lastKey,
    });
  } catch (error) {
    console.error('Błąd pobierania użytkowników:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/users/:userId - Pobierz użytkownika po ID (tylko admin)
router.get('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/users/:userId - Aktualizuj użytkownika (tylko admin)
router.put('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, isActive } = req.body;

    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Podaj co najmniej jedno pole do aktualizacji',
      });
    }

    const updatedUser = await updateUser(userId, updates);

    res.json({
      success: true,
      message: 'Użytkownik zaktualizowany',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Błąd aktualizacji użytkownika:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/users/:userId - Usuń użytkownika (tylko admin)
router.delete('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Nie pozwól adminowi usunąć samego siebie
    if (userId === req.user.userId) {
      return res.status(400).json({
        error: 'Nie możesz usunąć własnego konta jako admin',
      });
    }

    await deleteUser(userId);

    res.json({
      success: true,
      message: 'Użytkownik został usunięty',
    });
  } catch (error) {
    console.error('Błąd usuwania użytkownika:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;
