import redis from '../redis.js';

const PRICING_KEY = 'pricing:config';
const DEFAULT_PRICING = {
  activationFee: 2.0, // Opłata aktywacyjna za rozpoczęcie jazdy (zł)
  ridePerMinute: 0.50, // Cena za minutę jazdy (zł)
  minimumRidePrice: 5.0, // Minimalna cena za jazdę (zł) - deprecated, można usunąć
  updatedAt: new Date().toISOString(),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz aktualne ceny
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getPricing() {
  try {
    const cached = await redis.get(PRICING_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // Jeśli nie ma w Redis, zwróć domyślne ceny i zapisz je
    await setPricing(DEFAULT_PRICING);
    return DEFAULT_PRICING;
  } catch (error) {
    console.error('Błąd pobierania cen:', error);
    return DEFAULT_PRICING;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ustaw ceny (tylko admin)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function setPricing(pricing) {
  try {
    const updatedPricing = {
      ...pricing,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(PRICING_KEY, JSON.stringify(updatedPricing));
    return updatedPricing;
  } catch (error) {
    console.error('Błąd ustawiania cen:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz opłatę aktywacyjną (za rozpoczęcie jazdy)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getActivationFee() {
  const pricing = await getPricing();
  return pricing.activationFee || pricing.reservationPrice || 2.0; // Backward compatibility
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz cenę za minutę jazdy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getRidePerMinutePrice() {
  const pricing = await getPricing();
  return pricing.ridePerMinute;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Oblicz cenę jazdy na podstawie czasu (w minutach)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function calculateRidePrice(minutes) {
  const pricing = await getPricing();
  const calculatedPrice = minutes * pricing.ridePerMinute;
  return Math.max(calculatedPrice, pricing.minimumRidePrice);
}

