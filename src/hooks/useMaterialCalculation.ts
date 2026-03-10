/**
 * Хук для расчёта материалов с поддержкой авто-расчёта
 */

import { useMemo, useCallback } from 'react';
import type { Material, RoomMetrics } from '../types';
import {
  calculateByCoverage,
  calculateByConsumption,
  calculateByPerimeter,
  calculateByCount,
  calculateVolumetric,
  type CalculationResult,
} from '../utils/materialCalculations';

export interface MaterialCalculationOptions {
  material: Material;
  metrics: RoomMetrics;
  calculationType?: 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';
  customCount?: number;
  thickness?: number; // Для объёмных материалов (стяжка, штукатурка)
}

export interface MaterialCalculationResult extends CalculationResult {
  isCalculated: boolean;
  canAutoCalculate: boolean;
  recommendedQty: number;
}

/**
 * Хук для расчёта количества материала
 */
export function useMaterialCalculation(
  options: MaterialCalculationOptions
): MaterialCalculationResult {
  const { material, metrics, calculationType, customCount, thickness } = options;

  return useMemo(() => {
    // Проверяем, можем ли мы автоматически рассчитать
    const canAutoCalculate = canCalculateMaterial(material, calculationType);

    if (!canAutoCalculate || !material.autoCalcEnabled) {
      return {
        total: material.quantity,
        displayQty: material.quantity,
        displayUnit: material.unit,
        formula: '',
        isCalculated: false,
        canAutoCalculate,
        recommendedQty: material.quantity,
      };
    }

    // Выполняем расчёт
    const result = calculateMaterial(material, metrics, calculationType, customCount, thickness);

    return {
      ...result,
      isCalculated: true,
      canAutoCalculate,
      recommendedQty: result.displayQty,
    };
  }, [material, metrics, calculationType, customCount, thickness]);
}

/**
 * Проверяет, можно ли рассчитать материал автоматически
 */
export function canCalculateMaterial(
  material: Material,
  calculationType?: string
): boolean {
  // По площади покрытия
  if (material.coveragePerUnit && material.coveragePerUnit > 0) {
    return true;
  }

  // По расходу на м²
  if (material.consumptionRate && material.consumptionRate > 0) {
    return true;
  }

  // По периметру
  if (material.isPerimeter) {
    return true;
  }

  // Поштучно (нужен customCount)
  if (calculationType === 'customCount') {
    return true;
  }

  return false;
}

/**
 * Выполняет расчёт материала
 */
function calculateMaterial(
  material: Material,
  metrics: RoomMetrics,
  calculationType?: string,
  customCount?: number,
  thickness?: number
): CalculationResult {
  // Определяем площадь для расчёта
  const area = getAreaForType(calculationType, metrics);

  // 1. По площади покрытия
  if (material.coveragePerUnit && material.coveragePerUnit > 0) {
    return calculateByCoverage(
      area,
      material.coveragePerUnit,
      material.wastePercent ?? 10
    );
  }

  // 2. По расходу на м²
  if (material.consumptionRate && material.consumptionRate > 0) {
    return calculateByConsumption(
      area,
      material.consumptionRate,
      material.layers ?? 1,
      material.wastePercent ?? 5,
      material.packageSize
    );
  }

  // 3. По периметру
  if (material.isPerimeter) {
    return calculateByPerimeter(
      metrics.perimeter,
      material.multiplier ?? 1.0,
      material.packageSize,
      material.wastePercent ?? 5
    );
  }

  // 4. Поштучно
  if (customCount !== undefined) {
    return calculateByCount(
      customCount,
      material.multiplier ?? 1.0,
      material.wastePercent ?? 0
    );
  }

  // По умолчанию
  return {
    total: material.quantity,
    displayQty: material.quantity,
    displayUnit: material.unit,
    formula: '',
  };
}

/**
 * Определяет площадь по типу расчёта
 */
function getAreaForType(
  calculationType?: string,
  metrics?: RoomMetrics
): number {
  if (!metrics) return 0;

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

/**
 * Хук для массового пересчёта материалов работы
 */
export function useWorkMaterialsCalculation(
  materials: Material[],
  metrics: RoomMetrics,
  calculationType?: 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount',
  customCount?: number
) {
  return useMemo(() => {
    return materials.map((material) => {
      const canAuto = canCalculateMaterial(material, calculationType);
      
      if (!canAuto || !material.autoCalcEnabled) {
        return {
          material,
          calculation: null as MaterialCalculationResult | null,
          shouldUpdate: false,
        };
      }

      const result = useMaterialCalculation({
        material,
        metrics,
        calculationType,
        customCount,
      });

      const shouldUpdate = result.isCalculated && 
        Math.abs(result.recommendedQty - material.quantity) > 0.01;

      return {
        material,
        calculation: result,
        shouldUpdate,
      };
    });
  }, [materials, metrics, calculationType, customCount]);
}

/**
 * Форматирует формулу для отображения
 */
export function formatFormula(formula: string): string {
  return formula.replace(/\*/g, '×').replace(/\//g, '÷');
}

export default useMaterialCalculation;