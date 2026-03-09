/**
 * Формулы расчёта материалов
 * 
 * Пять основных формул:
 * 1. calculateByCoverage — по площади покрытия (обои, ламинат, плитка)
 * 2. calculateByConsumption — по расходу на м² (краска, клей, затирка)
 * 3. calculateByPerimeter — по периметру (плинтус, профили)
 * 4. calculateByCount — поштучно (уголки, заглушки, точки)
 * 5. calculateVolumetric — объёмные материалы (стяжка, штукатурка)
 */

import type { MaterialTemplate, Material } from '../types/workTemplate';
import type { RoomMetrics } from '../types/index';

// ============================================
// ТИПЫ РЕЗУЛЬТАТОВ РАСЧЁТА
// ============================================

export interface CalculationResult {
  total: number;           // Общее количество
  packages?: number;       // Количество упаковок
  displayQty: number;      // Количество для отображения
  displayUnit: string;     // Единица измерения для отображения
  formula: string;         // Формула расчёта для UI
}

// ============================================
// ФОРМУЛА 1: По площади покрытия
// ============================================

/**
 * Расчёт количества по площади покрытия
 * Применение: обои, ламинат, плитка, линолеум
 * 
 * Формула: qty = площадь / coveragePerUnit × (1 + wastePercent/100)
 * 
 * @param area - площадь помещения (м²)
 * @param coveragePerUnit - м² в упаковке
 * @param wastePercent - % запаса
 * @param roundUp - округлять вверх (по умолчанию true)
 */
export function calculateByCoverage(
  area: number,
  coveragePerUnit: number,
  wastePercent: number = 10,
  roundUp: boolean = true
): CalculationResult {
  if (coveragePerUnit <= 0) {
    throw new Error('coveragePerUnit must be greater than 0');
  }

  const rawQty = area / coveragePerUnit;
  const withWaste = rawQty * (1 + wastePercent / 100);
  
  const total = roundUp 
    ? Math.ceil(withWaste * 100) / 100 
    : Math.round(withWaste * 100) / 100;

  return {
    total,
    displayQty: Math.ceil(total),
    displayUnit: 'упак',
    formula: `${area} м² ÷ ${coveragePerUnit} м² × ${(1 + wastePercent / 100).toFixed(2)} = ${total.toFixed(2)}`,
  };
}

// ============================================
// ФОРМУЛА 2: По расходу на м²
// ============================================

/**
 * Расчёт количества по расходу на м²
 * Применение: краска, клей, затирка, штукатурка, грунтовка
 * 
 * Формула: qty = площадь × consumptionRate × layers × (1 + wastePercent/100)
 * 
 * @param area - площадь помещения (м²)
 * @param consumptionRate - расход на м² (л/м², кг/м², шт/м²)
 * @param layers - количество слоёв (по умолчанию 1)
 * @param wastePercent - % запаса
 * @param packageSize - размер упаковки для подбора (опционально)
 */
export function calculateByConsumption(
  area: number,
  consumptionRate: number,
  layers: number = 1,
  wastePercent: number = 5,
  packageSize?: number
): CalculationResult {
  if (consumptionRate <= 0) {
    throw new Error('consumptionRate must be greater than 0');
  }

  const rawQty = area * consumptionRate * layers;
  const withWaste = rawQty * (1 + wastePercent / 100);
  const total = Math.ceil(withWaste * 100) / 100;
  
  const packages = packageSize 
    ? Math.ceil(total / packageSize)
    : undefined;

  const layersText = layers > 1 ? ` × ${layers} слоёв` : '';
  const formula = `${area} м² × ${consumptionRate}${layersText} × ${(1 + wastePercent / 100).toFixed(2)} = ${total.toFixed(2)}`;

  return {
    total,
    packages,
    displayQty: packages || Math.ceil(total),
    displayUnit: packageSize ? 'упак' : 'ед',
    formula,
  };
}

// ============================================
// ФОРМУЛА 3: По периметру
// ============================================

/**
 * Расчёт количества по периметру
 * Применение: плинтус, обрешётка, профили
 * 
 * Формула: qty = периметр × multiplier × (1 + wastePercent/100)
 * 
 * @param perimeter - периметр помещения (пог. м)
 * @param multiplier - коэффициент (1.0 = 1:1)
 * @param pieceLength - длина 1 шт (для плинтуса)
 * @param wastePercent - % запаса
 */
export function calculateByPerimeter(
  perimeter: number,
  multiplier: number = 1.0,
  pieceLength?: number,
  wastePercent: number = 5
): CalculationResult {
  const rawQty = perimeter * multiplier;
  const withWaste = rawQty * (1 + wastePercent / 100);
  
  // Если указана длина штуки — считаем количество штук
  const total = pieceLength 
    ? Math.ceil(withWaste / pieceLength)
    : Math.ceil(withWaste * 100) / 100;

  const formula = pieceLength
    ? `${perimeter} пог.м × ${multiplier} × ${(1 + wastePercent / 100).toFixed(2)} ÷ ${pieceLength} м = ${total} шт`
    : `${perimeter} пог.м × ${multiplier} × ${(1 + wastePercent / 100).toFixed(2)} = ${total} пог.м`;

  return {
    total,
    displayQty: total,
    displayUnit: pieceLength ? 'шт' : 'пог. м',
    formula,
  };
}

// ============================================
// ФОРМУЛА 4: Поштучно
// ============================================

/**
 * Расчёт количества поштучно
 * Применение: уголки, заглушки, крепёж, точки электрики/сантехники
 * 
 * Формула: qty = count × multiplier × (1 + wastePercent/100)
 * 
 * @param count - количество
 * @param multiplier - коэффициент
 * @param wastePercent - % запаса
 */
export function calculateByCount(
  count: number,
  multiplier: number = 1.0,
  wastePercent: number = 0
): CalculationResult {
  const rawQty = count * multiplier;
  const withWaste = rawQty * (1 + wastePercent / 100);
  const total = Math.ceil(withWaste);

  const formula = `${count} × ${multiplier} × ${(1 + wastePercent / 100).toFixed(2)} = ${total} шт`;

  return {
    total,
    displayQty: total,
    displayUnit: 'шт',
    formula,
  };
}

// ============================================
// ФОРМУЛА 5: Объёмные материалы
// ============================================

/**
 * Расчёт объёмных материалов (с учётом толщины)
 * Применение: стяжка, штукатурка
 * 
 * Формула: 
 *   totalKg = площадь × толщина × расход_на_1см × (1 + wastePercent/100)
 *   packages = totalKg / packageSize
 * 
 * @param area - площадь (м²)
 * @param thickness - толщина слоя (см)
 * @param consumptionPerCm - кг/м² на 1 см толщины
 * @param wastePercent - % запаса
 * @param packageSize - кг в упаковке
 */
export function calculateVolumetric(
  area: number,
  thickness: number,
  consumptionPerCm: number,
  wastePercent: number = 5,
  packageSize: number = 25
): CalculationResult & { totalKg: number } {
  const rawKg = area * thickness * consumptionPerCm;
  const withWaste = rawKg * (1 + wastePercent / 100);
  const totalKg = Math.ceil(withWaste);
  const packages = Math.ceil(totalKg / packageSize);

  const formula = `${area} м² × ${thickness} см × ${consumptionPerCm} кг/м²/см × ${(1 + wastePercent / 100).toFixed(2)} = ${totalKg} кг`;

  return {
    total: packages,
    totalKg,
    packages,
    displayQty: packages,
    displayUnit: 'мешок',
    formula,
  };
}

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА
// ============================================

/**
 * Определяет тип расчёта для материала и вычисляет количество
 * @param material - шаблон материала
 * @param metrics - метрики помещения
 * @param customCount - количество для customCount типа
 * @param calculationType - тип расчёта работы (определяет какую площадь использовать)
 */
export function calculateMaterialQuantity(
  material: MaterialTemplate,
  metrics: RoomMetrics,
  customCount?: number,
  calculationType?: string
): CalculationResult {
  // 1. По площади покрытия (обои, ламинат, плитка)
  if (material.coveragePerUnit) {
    const area = getAreaForMaterial(material, metrics, calculationType);
    return calculateByCoverage(
      area,
      material.coveragePerUnit,
      material.wastePercent || 10
    );
  }

  // 2. По расходу на м² (краска, клей, затирка)
  if (material.consumptionRate) {
    const area = getAreaForMaterial(material, metrics, calculationType);
    return calculateByConsumption(
      area,
      material.consumptionRate,
      material.layers || 1,
      material.wastePercent || 5,
      material.packageSize
    );
  }

  // 3. По периметру (плинтус, обрешётка)
  if (material.isPerimeter) {
    return calculateByPerimeter(
      metrics.perimeter,
      material.multiplier || 1.0,
      material.packageSize, // используем как длину штуки
      material.wastePercent || 5
    );
  }

  // 4. Поштучно (точки, крепёж)
  if (customCount !== undefined) {
    return calculateByCount(
      customCount,
      material.multiplier || 1.0,
      material.wastePercent || 0
    );
  }

  // По умолчанию — не можем рассчитать
  throw new Error(`Cannot calculate material "${material.name}": missing calculation parameters`);
}

/**
 * Определяет площадь для расчёта материала
 */
function getAreaForMaterial(
  material: MaterialTemplate,
  metrics: RoomMetrics,
  calculationType?: string
): number {
  // Если материал для периметра — используем периметр
  if (material.isPerimeter) {
    return metrics.perimeter;
  }
  
  // Если указан тип расчёта — используем соответствующую площадь
  if (calculationType) {
    switch (calculationType) {
      case 'floorArea':
        return metrics.floorArea;
      case 'netWallArea':
        return metrics.netWallArea;
      case 'skirtingLength':
        return metrics.perimeter;
      default:
        return metrics.floorArea;
    }
  }
  
  // По умолчанию — площадь пола
  return metrics.floorArea;
}

/**
 * Вычисляет площадь на основе типа расчёта работы
 */
export function getAreaForCalculationType(
  calculationType: string,
  metrics: RoomMetrics,
  customCount?: number
): number {
  switch (calculationType) {
    case 'floorArea':
      return metrics.floorArea;
    case 'netWallArea':
      return metrics.netWallArea;
    case 'skirtingLength':
      return metrics.perimeter;
    case 'customCount':
      return customCount || 1;
    default:
      return metrics.floorArea;
  }
}

// ============================================
// КОНВЕРТАЦИЯ ШАБЛОНА В МАТЕРИАЛ
// ============================================

/**
 * Создаёт Material из MaterialTemplate с вычисленным количеством
 */
export function createMaterialFromTemplate(
  template: MaterialTemplate,
  metrics: RoomMetrics,
  customCount?: number
): Material {
  const calculation = calculateMaterialQuantity(template, metrics, customCount);
  
  return {
    id: template.id,
    name: template.name,
    unit: template.unit,
    quantity: calculation.displayQty,
    pricePerUnit: template.defaultPrice || 0,
    
    // Параметры расчёта
    coveragePerUnit: template.coveragePerUnit,
    consumptionRate: template.consumptionRate,
    layers: template.layers,
    piecesPerUnit: template.piecesPerUnit,
    wastePercent: template.wastePercent,
    packageSize: template.packageSize,
    
    // Вычисляемое
    calculatedQty: calculation.displayQty,
    autoCalcEnabled: true,
  };
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Форматирует количество с единицей измерения
 */
export function formatQuantity(qty: number, unit: string): string {
  const formattedQty = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  return `${formattedQty} ${unit}`;
}

/**
 * Форматирует цену
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Вычисляет общую стоимость материала
 */
export function calculateMaterialTotal(material: Material): number {
  return material.quantity * material.pricePerUnit;
}

/**
 * Округляет до разумного количества знаков
 */
export function roundToReasonable(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}