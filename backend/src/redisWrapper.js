import redis from './redis.js';
import { systemState } from './utils/systemState.js';

/**
 * Wrapper dla Redis, który sprawdza czy Redis jest włączony
 * Jeśli wyłączony - operacje cache są pomijane
 */
const redisWrapper = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Podstawowe operacje cache
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  async get(key) {
    if (!systemState.redisEnabled) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd GET dla ${key}:`, error.message);
      return null;
    }
  },

  async set(key, value, ...args) {
    if (!systemState.redisEnabled) return null;
    try {
      return await redis.set(key, value, ...args);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd SET dla ${key}:`, error.message);
      return null;
    }
  },

  async setex(key, seconds, value) {
    if (!systemState.redisEnabled) return null;
    try {
      return await redis.setex(key, seconds, value);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd SETEX dla ${key}:`, error.message);
      return null;
    }
  },

  async del(...keys) {
    if (!systemState.redisEnabled) return 0;
    try {
      return await redis.del(...keys);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd DEL:`, error.message);
      return 0;
    }
  },

  async exists(key) {
    if (!systemState.redisEnabled) return 0;
    try {
      return await redis.exists(key);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd EXISTS dla ${key}:`, error.message);
      return 0;
    }
  },

  async keys(pattern) {
    if (!systemState.redisEnabled) return [];
    try {
      return await redis.keys(pattern);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd KEYS dla ${pattern}:`, error.message);
      return [];
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Operacje GEO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async geoadd(key, longitude, latitude, member) {
    if (!systemState.redisEnabled) return 0;
    try {
      return await redis.geoadd(key, longitude, latitude, member);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd GEOADD:`, error.message);
      return 0;
    }
  },

  async geosearch(key, ...args) {
    if (!systemState.redisEnabled) return [];
    try {
      return await redis.geosearch(key, ...args);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd GEOSEARCH:`, error.message);
      return [];
    }
  },

  async zrem(key, member) {
    if (!systemState.redisEnabled) return 0;
    try {
      return await redis.zrem(key, member);
    } catch (error) {
      console.warn(`[Redis Wrapper] Błąd ZREM:`, error.message);
      return 0;
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Pomocnicze
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  isEnabled() {
    return systemState.redisEnabled;
  },

  // Bezpośredni dostęp do oryginalnego klienta (dla specjalnych przypadków)
  getClient() {
    return redis;
  }
};

export default redisWrapper;