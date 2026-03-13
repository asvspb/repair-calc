/**
 * Унифицированный поиск цен
 * Автоматически выбирает доступный AI провайдер (Gemini или Mistral)
 */

import React from 'react';
import type { PriceSearchRequest, PriceSearchResult, PriceSearchError } from './types';
import { searchPrice as searchPriceGemini, isGeminiEnabled } from './geminiPriceSearch';
import { searchPrice as searchPriceMistral, isMistralEnabled, getMistralModel } from './mistralPriceSearch';

export type AIProvider = 'gemini' | 'mistral' | null;

/**
 * Получает приоритетный провайдер из переменной окружения
 */
function getPrimaryProvider(): AIProvider {
  const primary = import.meta.env.VITE_LLM_PRIMARY;
  if (primary === 'gemini' || primary === 'mistral') {
    return primary;
  }
  return null;
}

/**
 * Возвращает доступный AI провайдер
 * Учитывает:
 * 1. VITE_LLM_PRIMARY - приоритетный провайдер (если указан и доступен)
 * 2. VITE_GEMINI_ENABLED / VITE_MISTRAL_ENABLED - включён ли провайдер
 * 3. Наличие API ключей
 */
export function getAvailableProvider(): AIProvider {
  const primary = getPrimaryProvider();
  const geminiEnabled = isGeminiEnabled();
  const mistralEnabled = isMistralEnabled();
  
  // Если указан приоритетный провайдер и он доступен — используем его
  if (primary === 'gemini' && geminiEnabled) return 'gemini';
  if (primary === 'mistral' && mistralEnabled) return 'mistral';
  
  // Иначе выбираем первый доступный (приоритет: Gemini -> Mistral)
  if (geminiEnabled) return 'gemini';
  if (mistralEnabled) return 'mistral';
  
  return null;
}

/**
 * Возвращает информацию о доступных провайдерах
 */
export function getProvidersStatus(): {
  gemini: { enabled: boolean; isPrimary: boolean };
  mistral: { enabled: boolean; isPrimary: boolean; model?: string };
  primary: AIProvider;
} {
  const primary = getPrimaryProvider();
  const geminiEnabled = isGeminiEnabled();
  const mistralEnabled = isMistralEnabled();
  
  return {
    gemini: {
      enabled: geminiEnabled,
      isPrimary: primary === 'gemini',
    },
    mistral: {
      enabled: mistralEnabled,
      isPrimary: primary === 'mistral',
      model: mistralEnabled ? getMistralModel() : undefined,
    },
    primary: getAvailableProvider(),
  };
}

/**
 * Ищет цены используя доступный провайдер
 */
export async function searchPrice(
  request: PriceSearchRequest,
  options?: { skipCache?: boolean; maxRetries?: number; provider?: AIProvider }
): Promise<PriceSearchResult> {
  const { provider = getAvailableProvider(), ...searchOptions } = options ?? {};
  
  if (provider === 'gemini') {
    return searchPriceGemini(request, searchOptions);
  }
  
  if (provider === 'mistral') {
    return searchPriceMistral(request, searchOptions);
  }
  
  throw {
    type: 'invalidKey',
    message: 'Не настроен ни один AI провайдер. Добавьте VITE_GEMINI_API_KEY или VITE_MISTRAL_API_KEY в .env',
    retryable: false,
  } as PriceSearchError;
}

/**
 * Проверяет, настроен ли хотя бы один провайдер
 */
export function isAnyProviderConfigured(): boolean {
  return getAvailableProvider() !== null;
}

/**
 * Хук для использования в React компонентах
 * Автоматически использует доступный провайдер
 */
export function usePriceSearch() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PriceSearchResult | null>(null);
  const [error, setError] = React.useState<PriceSearchError | null>(null);
  
  // Получаем провайдер один раз при монтировании
  const provider = React.useMemo(() => getAvailableProvider(), []);
  
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
  
  return {
    search,
    isLoading,
    result,
    error,
    reset,
    isConfigured: provider !== null,
    provider,
  };
}