import type { CalculationType } from '../App';

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
  materials: WorkTemplateMaterial[];
  tools: WorkTemplateTool[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Determines category based on calculationType
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
 * Category display names in Russian
 */
export const CATEGORY_LABELS: Record<WorkTemplateCategory, string> = {
  floor: 'Пол/Потолок',
  walls: 'Стены',
  perimeter: 'Периметр',
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