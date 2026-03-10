/**
 * Поиск цен через Gemini AI
 * Использует Gemini API для поиска ориентировочных цен на стройматериалы
 */

import React from 'react';
import type { PriceSearchRequest, PriceSearchResult, PriceSearchError } from './types';
import { buildCacheKey, getCachedPrice, setCachedPrice } from './priceCache';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Получает API ключ из переменных окружения
 */
function getApiKey(): string | null {
  // В Vite переменные окружения доступны через import.meta.env
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

/**
 * Строит промпт для Gemini
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
 * Парсит ответ от Gemini
 */
function parseGeminiResponse(response: unknown): PriceSearchResult {
  try {
    // Gemini возвращает { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    const candidates = (response as { candidates?: unknown[] })?.candidates;
    const text = (candidates?.[0] as { content?: { parts?: { text?: string }[] } })?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Пустой ответ от Gemini');
    }
    
    // Удаляем markdown-форматирование если есть
    const jsonText = text
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
    if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
      return {
        type: 'invalidKey',
        message: 'Неверный или отсутствующий API ключ Gemini',
        retryable: false,
      };
    }
    
    // Rate limit
    if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('quota')) {
      return {
        type: 'rateLimit',
        message: 'Превышен лимит запросов к Gemini API',
        retryable: true,
      };
    }
    
    // Network ошибки
    if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      return {
        type: 'network',
        message: 'Ошибка сети при обращении к Gemini API',
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
 * Выполняет запрос к Gemini API
 */
async function callGemini(prompt: string, apiKey: string): Promise<PriceSearchResult> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Низкая температура для более точных ответов
        maxOutputTokens: 1024,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return parseGeminiResponse(data);
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
      message: 'API ключ Gemini не настроен. Добавьте VITE_GEMINI_API_KEY в .env',
      retryable: false,
    } as PriceSearchError;
  }
  
  // Строим промпт
  const prompt = buildPriceSearchPrompt(request);
  
  // Повторные попытки с exponential backoff
  let lastError: PriceSearchError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callGemini(prompt, apiKey);
      
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
 * Проверяет, настроен ли API ключ
 */
export function isGeminiConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Хук для использования в React компонентах
 */
export function useGeminiPriceSearch() {
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
    isConfigured: isGeminiConfigured(),
  };
}

