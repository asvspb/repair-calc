/**
 * Типы для API поиска цен
 */

export type PriceSearchRequest = {
  productName: string;
  city: string;
  category?: string;
  brand?: string;
};

export type PriceSearchResult = {
  product: string;
  city: string;
  prices: {
    min: number;
    avg: number;
    max: number;
    currency: string;
  };
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
  disclaimer: string;
};

export type PriceSearchError = {
  type: 'network' | 'parse' | 'noResults' | 'rateLimit' | 'api' | 'invalidKey';
  message: string;
  retryable: boolean;
};

export type PriceCacheEntry = {
  key: string;
  result: PriceSearchResult;
  cachedAt: string;
  expiresAt: string;
};

export type PriceCache = PriceCacheEntry[];