import express from 'express';
import { createUser, getUserByEmail, verifyPassword } from '../services/userService.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/register - Rejestracja nowego użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'user' } = req.body;

    // Walidacja
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Wszystkie pola są wymagane: email, password, firstName, lastName',
      });
    }

    // Walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Nieprawidłowy format adresu email' });
    }

    // Walidacja hasła
    if (password.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć co najmniej 6 znaków' });
    }

    // Tylko admin może tworzyć innych adminów
    const userRole = role === 'admin' ? 'user' : role;

    // Utwórz użytkownika
    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      role: userRole,
    });

    // Wygeneruj token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      message: 'Użytkownik został utworzony',
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Błąd rejestracji:', error);

    if (error.message.includes('już istnieje')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Błąd serwera podczas rejestracji' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/login - Logowanie użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Walidacja
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email i hasło są wymagane',
      });
    }

    // Pobierz użytkownika
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Sprawdź czy konto jest aktywne
    if (!user.isActive) {
      return res.status(403).json({ error: 'Konto zostało dezaktywowane' });
    }

    // Weryfikuj hasło
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Wygeneruj token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: 'Zalogowano pomyślnie',
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Błąd logowania:', error);
    res.status(500).json({ error: 'Błąd serwera podczas logowania' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/verify - Weryfikacja tokenu (opcjonalne)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token jest wymagany' });
    }

    const { verifyToken } = await import('../middleware/auth.js');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Nieprawidłowy token', valid: false });
    }

    res.json({
      valid: true,
      user: {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    console.error('Błąd weryfikacji tokenu:', error);
    res.status(500).json({ error: 'Błąd serwera podczas weryfikacji' });
  }
});

export default router;
