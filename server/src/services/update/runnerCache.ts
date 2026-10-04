import crypto from 'crypto';
import type { PriceResult } from './parsers/types.js';
import type { ItemToUpdate } from './runner.types.js';

// ═══════════════════════════════════════════════════════
// КЭШ РЕЗУЛЬТАТОВ RUNNER'А (вынесено из runner.ts)
// ═══════════════════════════════════════════════════════

export type RunnerCache = Map<string, { result: PriceResult; expiresAt: number }>;

export function cacheKey(item: ItemToUpdate): string {
  const data = `${item.name}:${item.city}:${item.category}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function getFromCache(cache: RunnerCache, key: string): PriceResult | null {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  cache.delete(key);
  return null;
}

export function saveToCache(
  cache: RunnerCache,
  key: string,
  result: PriceResult,
  ttlMs: number,
): void {
  cache.set(key, {
    result,
    expiresAt: Date.now() + ttlMs,
  });
}
