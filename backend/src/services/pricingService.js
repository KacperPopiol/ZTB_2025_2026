import redis from '../redisWrapper.js'; // ← Zmiana importu

const PRICING_KEY = 'pricing:config';
const DEFAULT_PRICING = {
  activationFee: 2.0,
  ridePerMinute: 0.50,
  minimumRidePrice: 5.0,
  updatedAt: new Date().toISOString(),
};

// Lokalny cache dla przypadku gdy Redis jest wyłączony
let localPricingCache = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz aktualne ceny
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getPricing() {
  try {
    // Próbuj z Redis
    const cached = await redis.get(PRICING_KEY);
    if (cached) {
      const pricing = JSON.parse(cached);
      localPricingCache = pricing; // Aktualizuj lokalny cache
      return pricing;
    }

    // Jeśli Redis wyłączony lub brak danych, użyj lokalnego cache
    if (localPricingCache) {
      return localPricingCache;
    }

    // Jeśli nie ma w Redis ani lokalnie, zwróć domyślne ceny i zapisz je
    await setPricing(DEFAULT_PRICING);
    return DEFAULT_PRICING;
  } catch (error) {
    console.error('Błąd pobierania cen:', error);
    // Fallback na lokalny cache lub domyślne
    return localPricingCache || DEFAULT_PRICING;
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

    // Zapisz w Redis (jeśli włączony)
    await redis.set(PRICING_KEY, JSON.stringify(updatedPricing));
    
    // Zawsze aktualizuj lokalny cache
    localPricingCache = updatedPricing;

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
  return pricing.activationFee || pricing.reservationPrice || 2.0;
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