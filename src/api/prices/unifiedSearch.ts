/**
 * Унифицированный поиск цен
 * Все AI-вызовы проходят через серверный прокси /api/ai/search-price
 * API-ключи хранятся только на сервере — НЕ в клиентском бандле
 */

import React from 'react';
import type { PriceSearchRequest, PriceSearchResult, PriceSearchError } from './types';
import { buildCacheKey, getCachedPrice, setCachedPrice } from './priceCache';
import { httpClient } from '../httpClient';

export type AIProvider = 'gemini' | 'mistral' | null;

/** Интерфейс ответа серверного эндпоинта */
interface SearchPriceResponse {
  status: 'success';
  data: PriceSearchResult;
  meta: {
    provider: string;
    cached: boolean;
    cachedAt?: string;
  };
}

/** Интерфейс ответа статуса AI */
interface AIStatusResponse {
  status: 'success';
  data: {
    available: boolean;
    provider: { name: string; type: string } | null;
  };
}

/**
 * Кэшированный статус доступности AI
 * Проверяется один раз при загрузке, обновляется при ошибке
 */
let cachedAvailable: boolean | null = null;
let cachedProvider: AIProvider = null;
let statusCheckPromise: Promise<void> | null = null;

/**
 * Проверяет доступность AI на сервере
 * Результат кэшируется до перезагрузки страницы
 */
async function checkAIAvailability(): Promise<void> {
  if (cachedAvailable !== null) return;

  if (statusCheckPromise) {
    await statusCheckPromise;
    return;
  }

  statusCheckPromise = (async () => {
    try {
      const response = await httpClient.get<AIStatusResponse>('/api/ai/status');
      cachedAvailable = response.data.available;
      if (response.data.provider) {
        const type = response.data.provider.type;
        cachedProvider = type === 'ai_gemini' ? 'gemini' : type === 'ai_mistral' ? 'mistral' : null;
      } else {
        cachedProvider = null;
      }
    } catch {
      cachedAvailable = false;
      cachedProvider = null;
    }
  })();

  await statusCheckPromise;
}

/**
 * Преобразует ошибку серверного запроса в PriceSearchError
 */
function mapToPriceSearchError(error: unknown): PriceSearchError {
  if (error instanceof Error) {
    const message = error.message;

    // Rate limit
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
      return {
        type: 'rateLimit',
        message: 'Превышен лимит запросов к AI сервису',
        retryable: true,
      };
    }

    // Network ошибки
    if (message.includes('network') || message.includes('fetch') || message.includes('ECONNREFUSED') || message.includes('Failed to fetch')) {
      return {
        type: 'network',
        message: 'Ошибка сети при обращении к серверу',
        retryable: true,
      };
    }

    // Сервер вернул 503 — AI недоступен
    if (message.includes('503') || message.includes('AI сервис недоступен')) {
      return {
        type: 'invalidKey',
        message: 'AI сервис недоступен. Обратитесь к администратору.',
        retryable: false,
      };
    }

    // Parse ошибки
    if (message.includes('парсинга') || message.includes('JSON') || message.includes('parse')) {
      return {
        type: 'parse',
        message,
        retryable: false,
      };
    }

    return {
      type: 'api',
      message,
      retryable: false,
    };
  }

  return {
    type: 'api',
    message: 'Неизвестная ошибка',
    retryable: false,
  };
}

/**
 * Задержка для retry
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Возвращает доступный AI провайдер (из кэша статуса сервера)
 */
export function getAvailableProvider(): AIProvider {
  return cachedProvider;
}

/**
 * Возвращает информацию о доступных провайдерах
 */
export function getProvidersStatus(): {
  gemini: { enabled: boolean; isPrimary: boolean };
  mistral: { enabled: boolean; isPrimary: boolean; model?: string };
  primary: AIProvider;
} {
  const provider = cachedProvider;

  return {
    gemini: {
      enabled: provider === 'gemini',
      isPrimary: provider === 'gemini',
    },
    mistral: {
      enabled: provider === 'mistral',
      isPrimary: provider === 'mistral',
    },
    primary: provider,
  };
}

/**
 * Ищет цены используя серверный AI прокси
 * API-ключи не покидают сервер — запросы идут через /api/ai/search-price
 */
export async function searchPrice(
  request: PriceSearchRequest,
  options?: { skipCache?: boolean; maxRetries?: number }
): Promise<PriceSearchResult> {
  const { skipCache = false, maxRetries = 2 } = options ?? {};

  // Проверяем кэш на клиенте (localStorage)
  const cacheKey = buildCacheKey(request);
  if (!skipCache) {
    const cached = getCachedPrice(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Проверяем доступность AI
  await checkAIAvailability();
  if (!cachedAvailable) {
    throw {
      type: 'invalidKey',
      message: 'AI сервис недоступен. Обратитесь к администратору для настройки API ключей на сервере.',
      retryable: false,
    } as PriceSearchError;
  }

  // Повторные попытки с exponential backoff
  let lastError: PriceSearchError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await httpClient.post<SearchPriceResponse>(
        '/api/ai/search-price',
        {
          productName: request.productName,
          city: request.city,
          category: request.category,
          brand: request.brand,
          useCache: !skipCache, // передаём намерение клиента на сервер
        }
      );

      const result = response.data;

      // Сохраняем в клиентский кэш
      setCachedPrice(cacheKey, result);

      return result;
    } catch (error) {
      lastError = mapToPriceSearchError(error);

      if (!lastError.retryable || attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s...
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError;
}

/**
 * Проверяет, настроен ли хотя бы один провайдер на сервере
 */
export function isAnyProviderConfigured(): boolean {
  // Если статус ещё не проверен — возвращаем false (безопасный подход)
  // Реальная проверка произойдёт при первом запросе или через usePriceSearch
  return cachedAvailable ?? false;
}

/**
 * Хук для использования в React компонентах
 * Автоматически использует серверный AI прокси
 */
export function usePriceSearch() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PriceSearchResult | null>(null);
  const [error, setError] = React.useState<PriceSearchError | null>(null);

  const search = React.useCallback(async (request: PriceSearchRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await searchPrice(request);
      setResult(data);
      return data;
    } catch (err) {
      setError(err as PriceSearchError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    setIsLoading(false);
    setResult(null);
    setError(null);
  }, []);

  // Проверяем доступность AI при монтировании
  // null = ещё не проверено (показываем загрузку), true = доступен, false = недоступен
  const [isConfigured, setIsConfigured] = React.useState<boolean | null>(cachedAvailable);

  React.useEffect(() => {
    let cancelled = false;
    checkAIAvailability().then(() => {
      if (!cancelled) {
        setIsConfigured(cachedAvailable ?? false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return {
    search,
    isLoading,
    result,
    error,
    reset,
    isConfigured,
    provider: cachedProvider,
  };
}
