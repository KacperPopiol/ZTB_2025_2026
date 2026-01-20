import redis from '../redisWrapper.js';

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
// Pobranie aktualnych cen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getPricing() {
  try {
    const cached = await redis.get(PRICING_KEY);
    if (cached) {
      const pricing = JSON.parse(cached);
      localPricingCache = pricing;
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

    return localPricingCache || DEFAULT_PRICING;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ustawnienie cen (tylko admin)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function setPricing(pricing) {
  try {
    const updatedPricing = {
      ...pricing,
      updatedAt: new Date().toISOString(),
    };

    // Zapisanie w Redis (jeśli włączony)
    await redis.set(PRICING_KEY, JSON.stringify(updatedPricing));
    
    localPricingCache = updatedPricing;

    return updatedPricing;
  } catch (error) {
    console.error('Błąd ustawiania cen:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobranie opłaty aktywacyjnej (za rozpoczęcie jazdy)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getActivationFee() {
  const pricing = await getPricing();
  return pricing.activationFee || pricing.reservationPrice || 2.0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobranie ceny za minutę jazdy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getRidePerMinutePrice() {
  const pricing = await getPricing();
  return pricing.ridePerMinute;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Obliczenie ceny jazdy na podstawie czasu (w minutach)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function calculateRidePrice(minutes) {
  const pricing = await getPricing();
  const calculatedPrice = minutes * pricing.ridePerMinute;
  return Math.max(calculatedPrice, pricing.minimumRidePrice);
}