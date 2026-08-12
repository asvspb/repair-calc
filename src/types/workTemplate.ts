import type { CalculationType } from './index';

// Категории работ
export type WorkCategory = 'floor' | 'walls' | 'ceiling' | 'openings' | 'other';

// Сложность выполнения
export type Difficulty = 'easy' | 'medium' | 'hard';

// Шаблон материала для каталога
export type MaterialTemplate = {
  id: string;
  name: string;
  unit: string;

  // Один из способов расчёта:
  coveragePerUnit?: number;     // м² в упаковке
  consumptionRate?: number;     // расход на м² (л/м², кг/м², шт/м²)
  piecesPerUnit?: number;       // штук в упаковке
  isPerimeter?: boolean;        // расчёт по периметру
  multiplier?: number;          // множитель для периметра

  layers?: number;              // слои (краска)
  wastePercent?: number;        // запас %
  defaultPrice?: number;        // примерная цена
  packageSize?: number;         // размер упаковки (л, кг)
  
  // Подсказки для UI
  tips?: string;                // "Для ванной выберите влагостойкую краску"
};

// Шаблон инструмента для каталога
export type ToolTemplate = {
  id: string;
  name: string;
  isRentDefault: boolean;
  defaultPrice?: number;
  defaultRentPeriod?: number;   // дней аренды по умолчанию
};

// Шаблон работы из каталога
export type WorkTemplateCatalog = {
  id: string;
  name: string;
  unit: string;
  calculationType: CalculationType;
  category: WorkCategory;
  defaultWorkPrice?: number;
  description?: string;         // Краткое описание работы

  materials: MaterialTemplate[];
  tools: ToolTemplate[];
  
  // Метаданные
  popularity?: number;          // Частота использования (для сортировки)
  difficulty?: Difficulty;      // Сложность выполнения
  estimatedTimePerUnit?: number; // часов на м² (для оценки времени)
};

// ============ Legacy типы для совместимости ============

export type WorkTemplateCategory = 'floor' | 'walls' | 'perimeter' | 'other';

export type WorkTemplateMaterial = {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
};

export type WorkTemplateTool = {
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;
  rentPeriod?: number;
};

export type WorkTemplate = {
  id: string;
  name: string;
  category: WorkTemplateCategory;
  unit: string;
  workUnitPrice: number;
  calculationType: CalculationType;
  count?: number;
  sourceVolume?: number;  // v2: Объём работы при сохранении (м², пог.м, шт)
  materials: WorkTemplateMaterial[];
  tools: WorkTemplateTool[];
  createdAt: string;
  updatedAt: string;
};

// ============ Утилиты ============

/**
 * Determines category based on calculationType (legacy)
 */
export function getTemplateCategory(calculationType: CalculationType): WorkTemplateCategory {
  switch (calculationType) {
    case 'floorArea':
      return 'floor';
    case 'netWallArea':
      return 'walls';
    case 'skirtingLength':
      return 'perimeter';
    case 'customCount':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Maps new WorkCategory to legacy WorkTemplateCategory
 */
export function mapWorkCategoryToLegacy(category: WorkCategory): WorkTemplateCategory {
  switch (category) {
    case 'floor':
    case 'ceiling':
      return 'floor';
    case 'walls':
      return 'walls';
    case 'openings':
    case 'other':
    default:
      return 'other';
  }
}

/**
 * Category display names in Russian (legacy)
 */
export const CATEGORY_LABELS: Record<WorkTemplateCategory, string> = {
  floor: 'Пол/Потолок',
  walls: 'Стены',
  perimeter: 'Периметр',
  other: 'Прочее',
};

/**
 * New category display names in Russian
 */
export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  floor: 'Пол',
  walls: 'Стены',
  ceiling: 'Потолок',
  openings: 'Проёмы',
  other: 'Прочее',
};

/**
 * Calculation type display names in Russian
 */
export const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  floorArea: 'площадь пола',
  netWallArea: 'площадь стен',
  skirtingLength: 'периметр',
  customCount: 'вручную',
};

/**
 * Difficulty display names in Russian
 */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная',
};