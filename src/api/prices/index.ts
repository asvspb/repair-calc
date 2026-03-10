/**
 * API для поиска цен
 * Экспортирует типы и функции для поиска цен через Gemini AI
 */

export type {
  PriceSearchRequest,
  PriceSearchResult,
  PriceSearchError,
  PriceCacheEntry,
  PriceCache,
} from './types';

export {
  buildCacheKey,
  getCachedPrice,
  setCachedPrice,
  clearPriceCache,
  getCacheStats,
} from './priceCache';

export {
  searchPrice,
  isGeminiConfigured,
  useGeminiPriceSearch,
} from './geminiPriceSearch';