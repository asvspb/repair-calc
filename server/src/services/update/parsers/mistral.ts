/**
 * Mistral AI Parser - серверная версия
 * Использует Mistral AI API для поиска ориентировочных цен на стройматериалы
 */

import type { PriceParser, PriceRequest, PriceResult, RateLimit } from './types.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { RateLimiter } from './rateLimiter.js';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Получает API ключ из переменных окружения
 */
function getApiKey(): string | null {
  return process.env.MISTRAL_API_KEY || null;
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
 * Парсит ответ от Mistral
 */
function parseMistralResponse(data: unknown): PriceResult {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = response?.choices?.[0]?.message?.content;
  
  if (!text) {
    throw new Error('Пустой ответ от Mistral API');
  }
  
  // Извлекаем JSON из ответа
  let jsonStr = text;
  
  // Удаляем markdown-обёртку если есть
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  jsonStr = jsonStr.trim();
  
  const parsed = JSON.parse(jsonStr);
  
  if (!parsed.prices || typeof parsed.prices.avg !== 'number') {
    throw new Error('Некорректная структура ответа');
  }
  
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
 * Mistral Parser - реализация интерфейса PriceParser
 */
export class MistralParser implements PriceParser {
  name = 'Mistral AI';
  type = 'ai_mistral';
  
  private apiKey: string | null = null;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private model: string;

  constructor(model: string = 'mistral-small-latest') {
    this.apiKey = getApiKey();
    this.model = model;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 600000, // 10 минут
    });
    this.rateLimiter = new RateLimiter(100); // 100 запросов в минуту
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    return this.circuitBreaker.canExecute();
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 100,
      requestsPerDay: 50000,
      concurrentRequests: 10,
    };
  }

  async fetch(request: PriceRequest): Promise<PriceResult> {
    if (!this.apiKey) {
      throw new Error('API ключ Mistral не настроен. Добавьте MISTRAL_API_KEY в .env');
    }

    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Circuit breaker is open for Mistral');
    }

    await this.rateLimiter.wait();

    try {
      const prompt = buildPriceSearchPrompt(request);
      
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 401 || response.status === 403) {
          this.circuitBreaker.recordFailure();
          throw new Error(`Mistral API auth error: ${response.status}`);
        }
        
        if (response.status === 429) {
          this.circuitBreaker.recordFailure();
          throw new Error('Mistral API rate limit exceeded');
        }
        
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = parseMistralResponse(data);
      
      this.circuitBreaker.recordSuccess();
      
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}

/**
 * Проверяет, включён ли Mistral
 */
export function isMistralEnabled(): boolean {
  return !!getApiKey();
}

// Экспорт singleton
let mistralParserInstance: MistralParser | null = null;

export function getMistralParser(): MistralParser {
  if (!mistralParserInstance) {
    mistralParserInstance = new MistralParser();
  }
  return mistralParserInstance;
}