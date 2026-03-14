/**
 * Mistral AI Provider - для оценки работ и подбора материалов
 * Фаза 7.5: AI-интеграция
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AIProvider,
  AIProviderConfig,
  AIProviderStats,
  EstimateRequest,
  EstimateResult,
  SuggestMaterialsRequest,
  SuggestMaterialsResult,
  GenerateTemplateRequest,
  GenerateTemplateResult,
  RecommendedWork,
  RecommendedMaterial,
  RecommendedTool,
} from './types.js';
import { AIProviderError } from './types.js';
import { CircuitBreaker } from '../update/parsers/circuitBreaker.js';
import { RateLimiter } from '../update/parsers/rateLimiter.js';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Получает API ключ из переменных окружения
 */
function getApiKey(): string | null {
  return process.env.MISTRAL_API_KEY || null;
}

/**
 * Базовый провайдер с общей логикой
 */
abstract class BaseAIProvider {
  protected circuitBreaker: CircuitBreaker;
  protected rateLimiter: RateLimiter;
  protected stats: AIProviderStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
    lastRequestAt: null,
  };

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 600000, // 10 минут
    });
    this.rateLimiter = new RateLimiter(100); // 100 запросов в минуту
  }

  protected updateStats(success: boolean, latencyMs: number): void {
    this.stats.totalRequests++;
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    this.stats.averageLatencyMs =
      (this.stats.averageLatencyMs * (this.stats.totalRequests - 1) + latencyMs) / this.stats.totalRequests;
    this.stats.lastRequestAt = new Date().toISOString();
  }

  getStats(): AIProviderStats {
    return { ...this.stats };
  }
}

/**
 * Mistral AI Provider - реализация интерфейса AIProvider
 */
export class MistralAIProvider extends BaseAIProvider implements AIProvider {
  name = 'Mistral AI';
  type = 'ai_mistral';

  private apiKey: string | null = null;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig = {}) {
    super();
    this.apiKey = config.apiKey || getApiKey();
    this.config = {
      model: 'mistral-small-latest',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 30000,
      ...config,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    return this.circuitBreaker.canExecute();
  }

  /**
   * Оценка стоимости работ
   */
  async estimate(request: EstimateRequest): Promise<EstimateResult> {
    const prompt = this.buildEstimatePrompt(request);
    const response = await this.makeRequest(prompt);
    return this.parseEstimateResponse(response, request);
  }

  /**
   * Подбор материалов для работы
   */
  async suggestMaterials(request: SuggestMaterialsRequest): Promise<SuggestMaterialsResult> {
    const prompt = this.buildSuggestMaterialsPrompt(request);
    const response = await this.makeRequest(prompt);
    return this.parseSuggestMaterialsResponse(response, request);
  }

  /**
   * Генерация шаблона работ для типа комнаты
   */
  async generateTemplate(request: GenerateTemplateRequest): Promise<GenerateTemplateResult> {
    const prompt = this.buildGenerateTemplatePrompt(request);
    const response = await this.makeRequest(prompt);
    return this.parseGenerateTemplateResponse(response, request);
  }

  /**
   * Выполнение запроса к Mistral API
   */
  private async makeRequest(prompt: string): Promise<unknown> {
    if (!this.apiKey) {
      throw new AIProviderError(
        'API ключ Mistral не настроен. Добавьте MISTRAL_API_KEY в .env',
        this.name,
        false,
        'NO_API_KEY'
      );
    }

    if (!this.circuitBreaker.canExecute()) {
      throw new AIProviderError(
        'Circuit breaker is open for Mistral',
        this.name,
        false,
        'CIRCUIT_BREAKER_OPEN'
      );
    }

    await this.rateLimiter.wait();

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout!);

      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401 || response.status === 403) {
          this.circuitBreaker.recordFailure();
          throw new AIProviderError(
            `Mistral API auth error: ${response.status}`,
            this.name,
            false,
            'AUTH_ERROR'
          );
        }

        if (response.status === 429) {
          this.circuitBreaker.recordFailure();
          throw new AIProviderError(
            'Mistral API rate limit exceeded',
            this.name,
            true,
            'RATE_LIMIT'
          );
        }

        throw new AIProviderError(
          `Mistral API error: ${response.status} - ${errorText}`,
          this.name,
          true,
          'API_ERROR'
        );
      }

      const data = await response.json();
      this.circuitBreaker.recordSuccess();
      this.updateStats(true, Date.now() - startTime);

      return data;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      this.updateStats(false, Date.now() - startTime);

      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(
        error instanceof Error ? error.message : 'Unknown error',
        this.name,
        true,
        'REQUEST_ERROR'
      );
    }
  }

  /**
   * Извлечение текста из ответа Mistral
   */
  private extractText(data: unknown): string {
    const response = data as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = response?.choices?.[0]?.message?.content;

    if (!text) {
      throw new AIProviderError('Пустой ответ от Mistral API', this.name, false, 'EMPTY_RESPONSE');
    }

    return text;
  }

  /**
   * Парсинг JSON из ответа
   */
  private parseJsonFromText(text: string): unknown {
    let jsonStr = text;

    // Удаляем markdown-обёртку если есть
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    jsonStr = jsonStr.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new AIProviderError(
        'Не удалось распарсить JSON из ответа',
        this.name,
        false,
        'PARSE_ERROR'
      );
    }
  }

  /**
   * Построение промпта для оценки стоимости
   */
  private buildEstimatePrompt(request: EstimateRequest): string {
    return `Ты - эксперт по строительным сметам в России.

Составь ориентировочную смету для следующих работ:
- Описание: ${request.description}
- Город: ${request.city}
- Тип проекта: ${request.projectType || 'standard'}${request.roomType ? `\n- Тип помещения: ${request.roomType}` : ''}${request.area ? `\n- Площадь: ${request.area} м²` : ''}

Верни JSON в точном формате:
{
  "works": [
    {
      "name": "название работы",
      "unit": "м²|м.п.|шт|точка",
      "quantity": число,
      "pricePerUnit": число_в_рублях,
      "calculationType": "floorArea|wallArea|perimeter|customCount",
      "category": "demolition|preparation|finishing|etc"
    }
  ],
  "materials": [
    {
      "name": "название материала",
      "unit": "кг|л|шт|м²|уп",
      "quantity": число,
      "pricePerUnit": число_в_рублях,
      "coverage": "расход на единицу если применимо"
    }
  ],
  "tools": [
    {
      "name": "название инструмента",
      "quantity": число,
      "pricePerUnit": число_в_рублях,
      "isRent": true|false
    }
  ],
  "estimatedCost": {
    "min": минимальная_оценка_итого,
    "max": максимальная_оценка_итого,
    "currency": "RUB"
  },
  "confidence": "high|medium|low",
  "disclaimer": "Важно: это ориентировочная смета..."
}

Требования:
- Цены должны быть актуальными для ${request.city}
- Укажи реалистичные цены для российского рынка
- Включи все необходимые работы и материалы
- Если данных недостаточно, укажи confidence: "low"`;
  }

  /**
   * Построение промпта для подбора материалов
   */
  private buildSuggestMaterialsPrompt(request: SuggestMaterialsRequest): string {
    return `Ты - эксперт по строительным материалам в России.

Подбери материалы для работы:
- Название работы: ${request.workName}
- Площадь: ${request.area} м²
- Город: ${request.city}${request.roomType ? `\n- Тип помещения: ${request.roomType}` : ''}${request.additionalInfo ? `\n- Дополнительная информация: ${request.additionalInfo}` : ''}

Верни JSON в точном формате:
{
  "materials": [
    {
      "name": "название материала",
      "unit": "кг|л|шт|м²|уп",
      "quantity": число_с_запасом_10_процентов,
      "pricePerUnit": примерная_цена_в_рублях,
      "coverage": "расход на единицу"
    }
  ],
  "tools": [
    {
      "name": "название инструмента",
      "quantity": число,
      "pricePerUnit": примерная_цена_в_рублях,
      "isRent": true|false
    }
  ],
  "tips": [
    "полезный совет по выполнению работы",
    "ещё один совет"
  ],
  "confidence": "high|medium|low"
}

Требования:
- Рассчитай количество материалов с запасом 10%
- Укажи реалистичные цены для ${request.city}
- Включи все необходимые расходные материалы
- Добавь полезные советы по выполнению работы`;
  }

  /**
   * Построение промпта для генерации шаблона
   */
  private buildGenerateTemplatePrompt(request: GenerateTemplateRequest): string {
    return `Ты - эксперт по ремонту помещений в России.

Создай список типовых работ для ремонта:
- Тип помещения: ${request.roomType}
- Площадь: ${request.area} м²
- Город: ${request.city}
- Стиль ремонта: ${request.style || 'standard'}

Верни JSON в точном формате:
{
  "works": [
    {
      "name": "название работы",
      "unit": "м²|м.п.|шт|точка",
      "pricePerUnit": средняя_цена_в_рублях,
      "calculationType": "floorArea|wallArea|perimeter|ceilingArea|skirtingLength|customCount",
      "category": "demolition|preparation|flooring|walls|ceiling|electrical|plumbing|finishing"
    }
  ],
  "recommendedMaterials": [
    {
      "name": "основной материал",
      "unit": "м²|шт|уп",
      "quantity": количество,
      "pricePerUnit": примерная_цена
    }
  ],
  "estimatedDays": примерное_количество_дней_работы,
  "confidence": "high|medium|low"
}

Требования:
- Включи полный цикл работ для ${request.roomType}: демонтаж, подготовка, отделка
- Цены должны быть актуальными для ${request.city}
- Укажи правильный calculationType для автоматического расчёта количества
- Работы должны быть в логическом порядке выполнения`;
  }

  /**
   * Парсинг ответа оценки стоимости
   */
  private parseEstimateResponse(data: unknown, request: EstimateRequest): EstimateResult {
    const text = this.extractText(data);
    const parsed = this.parseJsonFromText(text) as {
      works?: unknown[];
      materials?: unknown[];
      tools?: unknown[];
      estimatedCost?: { min?: number; max?: number; currency?: string };
      confidence?: string;
      disclaimer?: string;
    };

    return {
      id: uuidv4(),
      description: request.description,
      city: request.city,
      projectType: request.projectType || 'standard',
      estimatedCost: {
        min: parsed.estimatedCost?.min || 0,
        max: parsed.estimatedCost?.max || 0,
        currency: parsed.estimatedCost?.currency || 'RUB',
      },
      works: this.parseWorks(parsed.works),
      materials: this.parseMaterials(parsed.materials),
      tools: this.parseTools(parsed.tools),
      confidence: this.validateConfidence(parsed.confidence),
      generatedAt: new Date().toISOString(),
      disclaimer: parsed.disclaimer || 'Данные ориентировочные, уточните цены у подрядчиков',
    };
  }

  /**
   * Парсинг ответа подбора материалов
   */
  private parseSuggestMaterialsResponse(
    data: unknown,
    request: SuggestMaterialsRequest
  ): SuggestMaterialsResult {
    const text = this.extractText(data);
    const parsed = this.parseJsonFromText(text) as {
      materials?: unknown[];
      tools?: unknown[];
      tips?: string[];
      confidence?: string;
    };

    return {
      workName: request.workName,
      area: request.area,
      city: request.city,
      materials: this.parseMaterials(parsed.materials),
      tools: this.parseTools(parsed.tools),
      tips: parsed.tips || [],
      confidence: this.validateConfidence(parsed.confidence),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Парсинг ответа генерации шаблона
   */
  private parseGenerateTemplateResponse(
    data: unknown,
    request: GenerateTemplateRequest
  ): GenerateTemplateResult {
    const text = this.extractText(data);
    const parsed = this.parseJsonFromText(text) as {
      works?: unknown[];
      recommendedMaterials?: unknown[];
      estimatedDays?: number;
      confidence?: string;
    };

    return {
      roomType: request.roomType,
      area: request.area,
      city: request.city,
      works: this.parseWorks(parsed.works),
      recommendedMaterials: this.parseMaterials(parsed.recommendedMaterials),
      estimatedDays: parsed.estimatedDays,
      confidence: this.validateConfidence(parsed.confidence),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Парсинг списка работ
   */
  private parseWorks(works: unknown): RecommendedWork[] {
    if (!Array.isArray(works)) return [];

    return works.map((w: unknown) => {
      const work = w as Record<string, unknown>;
      return {
        name: String(work.name || ''),
        unit: String(work.unit || 'м²'),
        quantity: Number(work.quantity) || 0,
        pricePerUnit: Number(work.pricePerUnit) || 0,
        calculationType: String(work.calculationType || 'customCount'),
        category: work.category ? String(work.category) : undefined,
      };
    });
  }

  /**
   * Парсинг списка материалов
   */
  private parseMaterials(materials: unknown): RecommendedMaterial[] {
    if (!Array.isArray(materials)) return [];

    return materials.map((m: unknown) => {
      const material = m as Record<string, unknown>;
      return {
        name: String(material.name || ''),
        unit: String(material.unit || 'шт'),
        quantity: Number(material.quantity) || 0,
        pricePerUnit: Number(material.pricePerUnit) || 0,
        coverage: material.coverage ? String(material.coverage) : undefined,
      };
    });
  }

  /**
   * Парсинг списка инструментов
   */
  private parseTools(tools: unknown): RecommendedTool[] {
    if (!Array.isArray(tools)) return [];

    return tools.map((t: unknown) => {
      const tool = t as Record<string, unknown>;
      return {
        name: String(tool.name || ''),
        quantity: Number(tool.quantity) || 1,
        pricePerUnit: Number(tool.pricePerUnit) || 0,
        isRent: Boolean(tool.isRent),
      };
    });
  }

  /**
   * Валидация confidence
   */
  private validateConfidence(confidence?: string): 'high' | 'medium' | 'low' {
    if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
      return confidence;
    }
    return 'medium';
  }
}

/**
 * Проверяет, включён ли Mistral AI
 */
export function isMistralAIEnabled(): boolean {
  return !!getApiKey();
}

// Singleton instance
let mistralAIProviderInstance: MistralAIProvider | null = null;

export function getMistralAIProvider(): MistralAIProvider {
  if (!mistralAIProviderInstance) {
    mistralAIProviderInstance = new MistralAIProvider();
  }
  return mistralAIProviderInstance;
}