/**
 * Поиск цен через Mistral AI
 * Использует Mistral API для поиска ориентировочных цен на стройматериалы
 */

import React from 'react';
import type { PriceSearchRequest, PriceSearchResult, PriceSearchError } from './types';
import { buildCacheKey, getCachedPrice, setCachedPrice } from './priceCache';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Получает имя модели из переменных окружения или возвращает значение по умолчанию
 */
function getModelName(): string {
  return import.meta.env.VITE_MISTRAL_MODEL_NAME || 'mistral-small-latest';
}

/**
 * Получает API ключ из переменных окружения
 */
function getApiKey(): string | null {
  return import.meta.env.VITE_MISTRAL_API_KEY || null;
}

/**
 * Проверяет, включён ли Mistral через переменную окружения
 */
function isEnabled(): boolean {
  const enabled = import.meta.env.VITE_MISTRAL_ENABLED;
  // Если переменная не задана, считаем что включён (для обратной совместимости)
  if (enabled === undefined) return true;
  return enabled === 'true' || enabled === '1';
}

/**
 * Строит промпт для Mistral
 */
function buildPriceSearchPrompt(request: PriceSearchRequest): string {
  return `Найди средние цены на "${request.productName}" в городе ${request.city}.
${request.brand ? `Бренд: ${request.brand}.` : ''}
${request.category ? `Категория: ${request.category}.` : ''}

Проверь цены в крупных магазинах: Леруа Мерлен, Петрович, ОБИ, Максидом, местные строительные магазины.

Верни ТОЛЬКО валидный JSON без markdown-форматирования:
{
  "product": "точное название товара",
  "city": "город",
  "prices": { 
    "min": число,
    "avg": число,
    "max": число,
    "currency": "RUB"
  },
  "sources": ["магазин1", "магазин2", "магазин3"],
  "confidence": "high",
  "lastUpdated": "YYYY-MM-DD",
  "disclaimer": "предупреждение о точности данных"
}

Требования:
- Цены в рублях РФ
- Минимум 3 источника, если возможно
- confidence: high (5+ источников), medium (3-4), low (1-2)
- disclaimer: если данных мало или цены могут быть неточными
- Не добавляй никакого текста до или после JSON`;
}

/**
 * Парсит ответ от Mistral
 */
function parseMistralResponse(response: unknown): PriceSearchResult {
  try {
    // Mistral возвращает { choices: [{ message: { content: "..." } }] }
    const choices = (response as { choices?: unknown[] })?.choices;
    const content = (choices?.[0] as { message?: { content?: string } })?.message?.content;
    
    if (!content) {
      throw new Error('Пустой ответ от Mistral');
    }
    
    // Удаляем markdown-форматирование если есть
    const jsonText = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    
    const parsed = JSON.parse(jsonText);
    
    // Валидация структуры
    if (!parsed.prices || typeof parsed.prices.avg !== 'number') {
      throw new Error('Некорректная структура ответа');
    }
    
    return {
      product: parsed.product || '',
      city: parsed.city || '',
      prices: {
        min: parsed.prices.min ?? parsed.prices.avg,
        avg: parsed.prices.avg,
        max: parsed.prices.max ?? parsed.prices.avg,
        currency: parsed.prices.currency || 'RUB',
      },
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      confidence: parsed.confidence || 'low',
      lastUpdated: parsed.lastUpdated || new Date().toISOString().split('T')[0],
      disclaimer: parsed.disclaimer || 'Данные ориентировочные, уточните цены в магазинах',
    };
  } catch (error) {
    throw new Error(`Ошибка парсинга ответа: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
  }
}

/**
 * Преобразует ошибку в PriceSearchError
 */
function mapToPriceSearchError(error: unknown): PriceSearchError {
  if (error instanceof Error) {
    // API key ошибки
    if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
      return {
        type: 'invalidKey',
        message: 'Неверный или отсутствующий API ключ Mistral',
        retryable: false,
      };
    }
    
    // Rate limit
    if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('quota')) {
      return {
        type: 'rateLimit',
        message: 'Превышен лимит запросов к Mistral API',
        retryable: true,
      };
    }
    
    // Network ошибки
    if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      return {
        type: 'network',
        message: 'Ошибка сети при обращении к Mistral API',
        retryable: true,
      };
    }
    
    // Parse ошибки
    if (error.message.includes('парсинга') || error.message.includes('JSON')) {
      return {
        type: 'parse',
        message: error.message,
        retryable: false,
      };
    }
    
    return {
      type: 'api',
      message: error.message,
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
 * Выполняет запрос к Mistral API
 */
async function callMistral(prompt: string, apiKey: string): Promise<PriceSearchResult> {
  const model = getModelName();
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Низкая температура для более точных ответов
      max_tokens: 1024,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return parseMistralResponse(data);
}

/**
 * Ищет цены на товар с кэшированием и retry
 */
export async function searchPrice(
  request: PriceSearchRequest,
  options?: { skipCache?: boolean; maxRetries?: number }
): Promise<PriceSearchResult> {
  const { skipCache = false, maxRetries = 2 } = options ?? {};
  
  // Проверяем кэш
  const cacheKey = buildCacheKey(request);
  if (!skipCache) {
    const cached = getCachedPrice(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  // Проверяем API ключ
  const apiKey = getApiKey();
  if (!apiKey) {
    throw {
      type: 'invalidKey',
      message: 'API ключ Mistral не настроен. Добавьте VITE_MISTRAL_API_KEY в .env',
      retryable: false,
    } as PriceSearchError;
  }
  
  // Строим промпт
  const prompt = buildPriceSearchPrompt(request);
  
  // Повторные попытки с exponential backoff
  let lastError: PriceSearchError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callMistral(prompt, apiKey);
      
      // Сохраняем в кэш
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
 * Проверяет, включён ли Mistral
 */
export function isMistralEnabled(): boolean {
  return isEnabled() && !!getApiKey();
}

/**
 * Проверяет, настроен ли API ключ (для обратной совместимости)
 */
export function isMistralConfigured(): boolean {
  return isMistralEnabled();
}

/**
 * Возвращает имя используемой модели
 */
export function getMistralModel(): string {
  return getModelName();
}

/**
 * Хук для использования в React компонентах
 */
export function useMistralPriceSearch() {
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
  
  return {
    search,
    isLoading,
    result,
    error,
    reset,
    isConfigured: isMistralConfigured(),
  };
}