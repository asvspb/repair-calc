/**
 * Типы и интерфейсы для AI сервисов
 * Фаза 7.5: AI-интеграция
 */

/**
 * Запрос на оценку стоимости работ
 */
export interface EstimateRequest {
  description: string;
  city: string;
  projectType?: 'standard' | 'economy' | 'premium';
  roomType?: string;
  area?: number;
}

/**
 * Рекомендованная работа в смете
 */
export interface RecommendedWork {
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  calculationType: string;
  category?: string;
}

/**
 * Рекомендованный материал
 */
export interface RecommendedMaterial {
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  coverage?: string;
}

/**
 * Рекомендованный инструмент
 */
export interface RecommendedTool {
  name: string;
  quantity: number;
  pricePerUnit: number;
  isRent: boolean;
}

/**
 * Результат оценки стоимости
 */
export interface EstimateResult {
  id: string;
  description: string;
  city: string;
  projectType: string;
  estimatedCost: {
    min: number;
    max: number;
    currency: string;
  };
  works: RecommendedWork[];
  materials: RecommendedMaterial[];
  tools?: RecommendedTool[];
  confidence: 'high' | 'medium' | 'low';
  generatedAt: string;
  disclaimer?: string;
}

/**
 * Запрос на подбор материалов
 */
export interface SuggestMaterialsRequest {
  workName: string;
  area: number;
  city: string;
  roomType?: string;
  additionalInfo?: string;
}

/**
 * Результат подбора материалов
 */
export interface SuggestMaterialsResult {
  workName: string;
  area: number;
  city: string;
  materials: RecommendedMaterial[];
  tools: RecommendedTool[];
  tips?: string[];
  confidence: 'high' | 'medium' | 'low';
  generatedAt: string;
}

/**
 * Запрос на генерацию шаблона работ
 */
export interface GenerateTemplateRequest {
  roomType: string;
  area: number;
  city: string;
  style?: 'standard' | 'economy' | 'premium';
}

/**
 * Результат генерации шаблона
 */
export interface GenerateTemplateResult {
  roomType: string;
  area: number;
  city: string;
  works: RecommendedWork[];
  recommendedMaterials: RecommendedMaterial[];
  estimatedDays?: number;
  confidence: 'high' | 'medium' | 'low';
  generatedAt: string;
}

/**
 * Интерфейс AI провайдера
 */
export interface AIProvider {
  name: string;
  type: string;

  /**
   * Проверка доступности провайдера
   */
  isAvailable(): Promise<boolean>;

  /**
   * Оценка стоимости работ
   */
  estimate(request: EstimateRequest): Promise<EstimateResult>;

  /**
   * Подбор материалов для работы
   */
  suggestMaterials(request: SuggestMaterialsRequest): Promise<SuggestMaterialsResult>;

  /**
   * Генерация шаблона работ для типа комнаты
   */
  generateTemplate(request: GenerateTemplateRequest): Promise<GenerateTemplateResult>;
}

/**
 * Ошибка AI провайдера
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

/**
 * Конфигурация AI провайдера
 */
export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Статистика использования AI провайдера
 */
export interface AIProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  lastRequestAt: string | null;
}