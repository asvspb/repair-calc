import type { PriceSearchRequest, PriceSearchResult } from './types.js';

export function buildPriceSearchPrompt(request: PriceSearchRequest): string {
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

export function buildPriceSearchResult(
  parsed: {
    product?: string;
    city?: string;
    prices?: { min?: number; avg?: number; max?: number; currency?: string };
    sources?: string[];
    confidence?: string;
    lastUpdated?: string;
    disclaimer?: string;
  },
  request: PriceSearchRequest,
  validateConfidence: (c?: string) => 'high' | 'medium' | 'low',
): PriceSearchResult {
  const avg = parsed.prices?.avg ?? 0;

  return {
    product: parsed.product || request.productName,
    city: parsed.city || request.city,
    prices: {
      min: parsed.prices?.min ?? avg,
      avg,
      max: parsed.prices?.max ?? avg,
      currency: parsed.prices?.currency || 'RUB',
    },
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    confidence: validateConfidence(parsed.confidence),
    lastUpdated: parsed.lastUpdated || new Date().toISOString().split('T')[0],
    disclaimer: parsed.disclaimer || 'Данные ориентировочные, уточните цены в магазинах',
  };
}
