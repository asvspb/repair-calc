/**
 * API для поиска цен
 * Экспортирует типы и функции для поиска цен через серверный AI прокси
 * API-ключи хранятся только на сервере — НЕ в клиентском бандле
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

// Универсальные функции (вызывают серверный прокси /api/ai/search-price)
export {
  type AIProvider,
  getAvailableProvider,
  getProvidersStatus,
  searchPrice,
  usePriceSearch,
  isAnyProviderConfigured,
} from './unifiedSearch';
