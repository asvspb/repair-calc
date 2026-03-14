/**
 * Gemini AI Parser - серверная версия
 * Использует Gemini API для поиска ориентировочных цен на стройматериалы
 */

import type { PriceParser, PriceRequest, PriceResult, RateLimit } from './types.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { RateLimiter } from './rateLimiter.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Получает API ключ из переменных окружения
 */
function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Строит промпт для поиска цены
 */
function buildPriceSearchPrompt(request: PriceRequest): string {
  return `Ты - помощник по поиску цен на строительные материалы и работы в России.

Найди актуальные цены на "${request.itemName}" (${request.category === 'work' ? 'работа' : request.category === 'material' ? 'материал' : 'инструмент'}) в городе ${request.city}.
Единица измерения: ${request.unit || 'м²'}.

Верни JSON в точном формате:
{
  "product": "название товара/работы",
  "city": "${request.city}",
  "prices": {
    "min": минимальная_цена_число,
    "avg": средняя_цена_число,
    "max": максимальная_цена_число,
    "currency": "RUB"
  },
  "sources": ["источник1", "источник2"],
  "confidence": "high" | "medium" | "low",
  "lastUpdated": "YYYY-MM-DD",
  "disclaimer": "Данные ориентировочные, уточните цены в магазинах"
}

Важно:
- Цены должны быть реалистичными для российского рынка
- Укажи 2-3 реальных источника (магазины, маркетплейсы)
- Если не уверен, укажи confidence: "low"
- Верни только JSON, без дополнительного текста`;
}

/**
 * Парсит ответ от Gemini
 */
function parseGeminiResponse(data: unknown): PriceResult {
  // Извлекаем текст из ответа Gemini
  const response = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('Пустой ответ от Gemini API');
  }
  
  // Извлекаем JSON из ответа (может быть обёрнут в markdown)
  let jsonStr = text;
  
  // Удаляем markdown-обёртку если есть
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  // Удаляем лишние пробелы и переносы
  jsonStr = jsonStr.trim();
  
  // Парсим JSON
  const parsed = JSON.parse(jsonStr);
  
  // Валидируем структуру
  if (!parsed.prices || typeof parsed.prices.avg !== 'number') {
    throw new Error('Некорректная структура ответа');
  }
  
  // Маппинг confidence
  const confidenceMap: Record<string, number> = {
    'high': 0.9,
    'medium': 0.7,
    'low': 0.5,
  };
  
  return {
    prices: {
      min: parsed.prices.min ?? parsed.prices.avg,
      avg: parsed.prices.avg,
      max: parsed.prices.max ?? parsed.prices.avg,
      currency: parsed.prices.currency || 'RUB',
    },
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    confidenceScore: confidenceMap[parsed.confidence] || 0.5,
    raw: parsed,
  };
}

/**
 * Gemini Parser - реализация интерфейса PriceParser
 */
export class GeminiParser implements PriceParser {
  name = 'Google Gemini';
  type = 'ai_gemini';
  
  private apiKey: string | null = null;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor() {
    this.apiKey = getApiKey();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 600000, // 10 минут
    });
    this.rateLimiter = new RateLimiter(60); // 60 запросов в минуту
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    return this.circuitBreaker.canExecute();
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 60,
      requestsPerDay: 10000,
      concurrentRequests: 5,
    };
  }

  async fetch(request: PriceRequest): Promise<PriceResult> {
    if (!this.apiKey) {
      throw new Error('API ключ Gemini не настроен. Добавьте GEMINI_API_KEY в .env');
    }

    // Проверяем Circuit Breaker
    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Circuit breaker is open for Gemini');
    }

    // Rate limiting
    await this.rateLimiter.wait();

    try {
      const prompt = buildPriceSearchPrompt(request);
      
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
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
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Обработка специфичных ошибок
        if (response.status === 401 || response.status === 403) {
          this.circuitBreaker.recordFailure();
          throw new Error(`Gemini API auth error: ${response.status}`);
        }
        
        if (response.status === 429) {
          this.circuitBreaker.recordFailure();
          throw new Error('Gemini API rate limit exceeded');
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = parseGeminiResponse(data);
      
      // Успех - сбрасываем Circuit Breaker
      this.circuitBreaker.recordSuccess();
      
      return result;
    } catch (error) {
      // Записываем ошибку в Circuit Breaker
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  /**
   * Получить состояние Circuit Breaker
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}

/**
 * Проверяет, включён ли Gemini
 */
export function isGeminiEnabled(): boolean {
  return !!getApiKey();
}

// Экспорт singleton
let geminiParserInstance: GeminiParser | null = null;

export function getGeminiParser(): GeminiParser {
  if (!geminiParserInstance) {
    geminiParserInstance = new GeminiParser();
  }
  return geminiParserInstance;
}