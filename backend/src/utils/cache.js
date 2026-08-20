import NodeCache from 'node-cache';

// Small in-memory cache for expensive aggregates. Invalidation is triggered
// explicitly whenever financial data changes.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export function cacheGet(key) {
  return cache.get(key);
}

export function cacheSet(key, value, ttlSeconds = 60) {
  cache.set(key, value, ttlSeconds);
}

export function cacheDel(key) {
  cache.del(key);
}

export function invalidateFinancialCache() {
  const keys = cache.keys().filter((k) => k.startsWith('financial:'));
  cache.del(keys);
}