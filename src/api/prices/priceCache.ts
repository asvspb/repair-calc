/**
 * Кэширование результатов поиска цен
 * Хранит результаты в localStorage с TTL 7 дней
 */

import type { PriceCache, PriceCacheEntry, PriceSearchResult } from './types';

const PRICE_CACHE_KEY = 'repair-calc-price-cache';
const CACHE_TTL_DAYS = 7;
const MAX_CACHE_SIZE = 100;

/**
 * Генерирует ключ кэша на основе параметров запроса
 */
export function buildCacheKey(params: {
  productName: string;
  city: string;
  category?: string;
  brand?: string;
}): string {
  const parts = [
    params.productName.toLowerCase().trim(),
    params.city.toLowerCase().trim(),
    params.category?.toLowerCase().trim() || '',
    params.brand?.toLowerCase().trim() || '',
  ];
  return parts.join('|');
}

/**
 * Получает весь кэш из localStorage
 */
function loadCache(): PriceCache {
  try {
    const cached = localStorage.getItem(PRICE_CACHE_KEY);
    if (!cached) return [];
    return JSON.parse(cached) as PriceCache;
  } catch {
    return [];
  }
}

/**
 * Сохраняет кэш в localStorage
 */
function saveCache(cache: PriceCache): void {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    // Если localStorage переполнен, удаляем старые записи
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const trimmed = cache.slice(-Math.floor(MAX_CACHE_SIZE / 2));
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(trimmed));
    }
  }
}

/**
 * Удаляет просроченные записи из кэша
 */
function cleanExpired(cache: PriceCache): PriceCache {
  const now = new Date();
  return cache.filter((entry) => new Date(entry.expiresAt) > now);
}

/**
 * Получает закэшированный результат
 */
export function getCachedPrice(key: string): PriceSearchResult | null {
  const cache = loadCache();
  const cleaned = cleanExpired(cache);
  
  // Если удалили просроченные — сохраняем
  if (cleaned.length !== cache.length) {
    saveCache(cleaned);
  }
  
  const entry = cleaned.find((e) => e.key === key);
  return entry?.result ?? null;
}

/**
 * Сохраняет результат в кэш
 */
export function setCachedPrice(key: string, result: PriceSearchResult): void {
  const cache = loadCache();
  const cleaned = cleanExpired(cache);
  
  // Удаляем старую запись с таким же ключом
  const filtered = cleaned.filter((e) => e.key !== key);
  
  // Добавляем новую запись
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  
  const newEntry: PriceCacheEntry = {
    key,
    result,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  
  // Ограничиваем размер кэша (FIFO)
  const updated = [...filtered, newEntry].slice(-MAX_CACHE_SIZE);
  
  saveCache(updated);
}

/**
 * Очищает весь кэш цен
 */
export function clearPriceCache(): void {
  localStorage.removeItem(PRICE_CACHE_KEY);
}

/**
 * Возвращает статистику кэша
 */
export function getCacheStats(): {
  totalEntries: number;
  validEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
} {
  const cache = loadCache();
  const cleaned = cleanExpired(cache);
  const now = new Date();
  
  const validEntries = cleaned.filter((e) => new Date(e.expiresAt) > now);
  
  const dates = cleaned.map((e) => e.cachedAt).sort();
  
  return {
    totalEntries: cache.length,
    validEntries: validEntries.length,
    oldestEntry: dates[0] ?? null,
    newestEntry: dates[dates.length - 1] ?? null,
  };
}