/**
 * API для поиска цен
 * Экспортирует типы и функции для поиска цен через AI провайдеров (Gemini, Mistral)
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

// Gemini
export {
  searchPrice as searchPriceGemini,
  isGeminiConfigured,
  isGeminiEnabled,
  useGeminiPriceSearch,
} from './geminiPriceSearch';

// Mistral
export {
  searchPrice as searchPriceMistral,
  isMistralConfigured,
  isMistralEnabled,
  getMistralModel,
  useMistralPriceSearch,
} from './mistralPriceSearch';

// Универсальные функции (выбирают доступный провайдер)
export {
  type AIProvider,
  getAvailableProvider,
  getProvidersStatus,
  searchPrice,
  usePriceSearch,
} from './unifiedSearch';
