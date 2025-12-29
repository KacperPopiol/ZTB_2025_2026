import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getPricing, setPricing } from '../services/pricingService.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/pricing - Pobierz aktualne ceny (publiczne)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', async (req, res) => {
  try {
    const pricing = await getPricing();
    res.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error('Błąd pobierania cen:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/pricing - Aktualizuj ceny (tylko admin)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { activationFee, reservationPrice, ridePerMinute, minimumRidePrice } = req.body;

    // Backward compatibility - jeśli podano reservationPrice, użyj jako activationFee
    const fee = activationFee !== undefined ? activationFee : reservationPrice;

    // Walidacja
    if (
      fee !== undefined &&
      (typeof fee !== 'number' || fee < 0)
    ) {
      return res.status(400).json({
        error: 'Opłata aktywacyjna musi być liczbą nieujemną',
      });
    }

    if (
      ridePerMinute !== undefined &&
      (typeof ridePerMinute !== 'number' || ridePerMinute < 0)
    ) {
      return res.status(400).json({
        error: 'Cena za minutę musi być liczbą nieujemną',
      });
    }

    if (
      minimumRidePrice !== undefined &&
      (typeof minimumRidePrice !== 'number' || minimumRidePrice < 0)
    ) {
      return res.status(400).json({
        error: 'Minimalna cena jazdy musi być liczbą nieujemną',
      });
    }

    // Pobierz aktualne ceny
    const currentPricing = await getPricing();

    // Zaktualizuj tylko podane pola
    const updatedPricing = {
      activationFee:
        fee !== undefined
          ? fee
          : (currentPricing.activationFee || currentPricing.reservationPrice || 2.0),
      ridePerMinute:
        ridePerMinute !== undefined ? ridePerMinute : currentPricing.ridePerMinute,
      minimumRidePrice:
        minimumRidePrice !== undefined
          ? minimumRidePrice
          : currentPricing.minimumRidePrice,
    };

    const pricing = await setPricing(updatedPricing);

    res.json({
      success: true,
      message: 'Ceny zaktualizowane',
      pricing,
    });
  } catch (error) {
    console.error('Błąd aktualizacji cen:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;

