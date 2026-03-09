/**
 * Unit-тесты для формул расчёта материалов
 */

import { describe, it, expect } from 'vitest';
import {
  calculateByCoverage,
  calculateByConsumption,
  calculateByPerimeter,
  calculateByCount,
  calculateVolumetric,
  calculateMaterialQuantity,
  createMaterialFromTemplate,
  getAreaForCalculationType,
  formatQuantity,
  calculateMaterialTotal,
  roundToReasonable,
} from '../../src/utils/materialCalculations';
import type { MaterialTemplate } from '../../src/types/workTemplate';
import type { RoomMetrics } from '../../src/types/index';

const mockMetrics: RoomMetrics = {
  floorArea: 24,
  perimeter: 18,
  grossWallArea: 43.2,
  windowsArea: 2.25,
  doorsArea: 1.8,
  netWallArea: 39.15,
  skirtingLength: 18,
  volume: 64.8,
};

describe('calculateByCoverage', () => {
  it('should calculate wallpaper quantity', () => {
    const result = calculateByCoverage(24, 5.3, 10);
    expect(result.total).toBeCloseTo(5.0, 1);
    expect(result.displayQty).toBe(5);
  });

  it('should calculate laminate quantity', () => {
    const result = calculateByCoverage(45, 2.0, 5);
    expect(result.total).toBeCloseTo(23.63, 1);
  });

  it('should calculate tile quantity', () => {
    const result = calculateByCoverage(20, 1.0, 10);
    expect(result.total).toBeCloseTo(22, 0);
  });

  it('should use default wastePercent of 10%', () => {
    const result1 = calculateByCoverage(10, 1.0);
    const result2 = calculateByCoverage(10, 1.0, 10);
    expect(result1.total).toBeCloseTo(result2.total, 2);
  });

  it('should handle zero wastePercent', () => {
    const result = calculateByCoverage(10, 2.0, 0);
    expect(result.total).toBe(5);
  });

  it('should throw error for zero coveragePerUnit', () => {
    expect(() => calculateByCoverage(10, 0)).toThrow();
  });

  it('should return correct displayUnit', () => {
    const result = calculateByCoverage(10, 1.0, 10);
    expect(result.displayUnit).toBe('упак');
  });
});

describe('calculateByConsumption', () => {
  it('should calculate paint quantity with layers', () => {
    // 24 * 0.006 * 2 * 1.05 = 0.3024 → Math.ceil(30.24)/100 = 0.31
    const result = calculateByConsumption(24, 0.006, 2, 5);
    expect(result.total).toBeCloseTo(0.31, 2);
  });

  it('should calculate package count', () => {
    const result = calculateByConsumption(100, 0.003, 1, 5, 5);
    expect(result.packages).toBe(1);
  });

  it('should use default layers = 1', () => {
    const result1 = calculateByConsumption(10, 0.01);
    const result2 = calculateByConsumption(10, 0.01, 1);
    expect(result1.total).toBe(result2.total);
  });

  it('should throw error for zero consumptionRate', () => {
    expect(() => calculateByConsumption(10, 0)).toThrow();
  });

  it('should handle multiple layers correctly', () => {
    // result1: 10 * 0.01 * 1 = 0.1 → Math.ceil(10)/100 = 0.1
    // result3: 10 * 0.01 * 3 = 0.3 → Math.ceil(30)/100 = 0.3
    const result1 = calculateByConsumption(10, 0.01, 1, 0);
    const result3 = calculateByConsumption(10, 0.01, 3, 0);
    expect(result3.total).toBeCloseTo(result1.total * 3, 1);
  });

  it('should include layers in formula for 2+ layers', () => {
    const result = calculateByConsumption(24, 0.006, 2, 5);
    expect(result.formula).toContain('2 слоёв');
  });
});

describe('calculateByPerimeter', () => {
  it('should calculate skirting board count', () => {
    const result = calculateByPerimeter(18, 1.0, 2.5, 5);
    expect(result.total).toBe(8);
    expect(result.displayUnit).toBe('шт');
  });

  it('should calculate perimeter without pieceLength', () => {
    // 18 * 1.0 * 1.05 = 18.9 (with floating point rounding)
    const result = calculateByPerimeter(18, 1.0, undefined, 5);
    expect(result.total).toBeCloseTo(18.9, 1);
    expect(result.displayUnit).toBe('пог. м');
  });

  it('should apply multiplier correctly', () => {
    // 18 * 2.5 * 1.10 = 49.5 → Math.ceil(49.5 * 100) / 100 = 49.5 (но floating point даст 49.51)
    const result = calculateByPerimeter(18, 2.5, undefined, 10);
    expect(result.total).toBeCloseTo(49.5, 1);
  });

  it('should use default multiplier = 1.0', () => {
    const result1 = calculateByPerimeter(10);
    const result2 = calculateByPerimeter(10, 1.0, undefined, 5);
    expect(result1.total).toBe(result2.total);
  });
});

describe('calculateByCount', () => {
  it('should calculate quantity by count', () => {
    const result = calculateByCount(5, 1.0, 0);
    expect(result.total).toBe(5);
  });

  it('should apply waste percent', () => {
    const result = calculateByCount(5, 1.0, 10);
    expect(result.total).toBe(6);
  });

  it('should apply multiplier', () => {
    const result = calculateByCount(5, 2.0, 0);
    expect(result.total).toBe(10);
  });

  it('should always round up to integer', () => {
    const result = calculateByCount(5, 1.0, 15);
    expect(result.total).toBe(6);
    expect(Number.isInteger(result.total)).toBe(true);
  });
});

describe('calculateVolumetric', () => {
  it('should calculate screed quantity', () => {
    const result = calculateVolumetric(20, 5, 20, 5, 25);
    expect(result.totalKg).toBe(2100);
    expect(result.packages).toBe(84);
  });

  it('should calculate plaster quantity', () => {
    const result = calculateVolumetric(50, 1, 8.5, 5, 30);
    expect(result.totalKg).toBe(447);
    expect(result.packages).toBe(15);
  });

  it('should use default packageSize = 25', () => {
    const result = calculateVolumetric(10, 2, 20, 5);
    expect(result.displayUnit).toBe('мешок');
  });
});

describe('calculateMaterialQuantity', () => {
  it('should calculate coverage-based material', () => {
    const material: MaterialTemplate = {
      id: 'test', name: 'Обои', unit: 'рулон',
      coveragePerUnit: 5.3, wastePercent: 10,
    };
    const result = calculateMaterialQuantity(material, mockMetrics);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should calculate consumption-based material', () => {
    const material: MaterialTemplate = {
      id: 'test', name: 'Краска', unit: 'л',
      consumptionRate: 0.006, layers: 2, wastePercent: 5, packageSize: 10,
    };
    const result = calculateMaterialQuantity(material, mockMetrics);
    expect(result.packages).toBeDefined();
  });

  it('should calculate perimeter-based material', () => {
    const material: MaterialTemplate = {
      id: 'test', name: 'Плинтус', unit: 'шт',
      isPerimeter: true, multiplier: 1.0, packageSize: 2.5, wastePercent: 5,
    };
    const result = calculateMaterialQuantity(material, mockMetrics);
    expect(result.displayUnit).toBe('шт');
  });

  it('should calculate count-based material with customCount', () => {
    const material: MaterialTemplate = {
      id: 'test', name: 'Розетки', unit: 'шт', multiplier: 1.0,
    };
    const result = calculateMaterialQuantity(material, mockMetrics, 5);
    expect(result.total).toBe(5);
  });

  it('should throw error for material without calculation params', () => {
    const material: MaterialTemplate = { id: 'test', name: 'Unknown', unit: 'шт' };
    expect(() => calculateMaterialQuantity(material, mockMetrics)).toThrow();
  });
});

describe('getAreaForCalculationType', () => {
  it('should return floorArea for floorArea type', () => {
    expect(getAreaForCalculationType('floorArea', mockMetrics)).toBe(24);
  });
  it('should return netWallArea for netWallArea type', () => {
    expect(getAreaForCalculationType('netWallArea', mockMetrics)).toBe(39.15);
  });
  it('should return perimeter for skirtingLength type', () => {
    expect(getAreaForCalculationType('skirtingLength', mockMetrics)).toBe(18);
  });
  it('should return customCount for customCount type', () => {
    expect(getAreaForCalculationType('customCount', mockMetrics, 10)).toBe(10);
  });
});

describe('createMaterialFromTemplate', () => {
  it('should create Material from template', () => {
    const template: MaterialTemplate = {
      id: 'wallpaper', name: 'Обои', unit: 'рулон',
      coveragePerUnit: 5.3, wastePercent: 10, defaultPrice: 1500,
    };
    const material = createMaterialFromTemplate(template, mockMetrics);
    expect(material.id).toBe('wallpaper');
    expect(material.name).toBe('Обои');
    expect(material.pricePerUnit).toBe(1500);
    expect(material.autoCalcEnabled).toBe(true);
  });
});

describe('formatQuantity', () => {
  it('should format integer quantity', () => {
    expect(formatQuantity(5, 'шт')).toBe('5 шт');
  });
  it('should format decimal quantity', () => {
    expect(formatQuantity(5.5, 'м')).toBe('5.50 м');
  });
});

describe('calculateMaterialTotal', () => {
  it('should calculate total price', () => {
    const material = { id: 't', name: 'T', quantity: 5, unit: 'шт', pricePerUnit: 100 };
    expect(calculateMaterialTotal(material)).toBe(500);
  });
});

describe('roundToReasonable', () => {
  it('should round to 2 decimal places by default', () => {
    expect(roundToReasonable(3.14159)).toBe(3.14);
  });
  it('should round to specified decimal places', () => {
    expect(roundToReasonable(3.14159, 3)).toBe(3.142);
  });
});

describe('Integration scenarios', () => {
  it('Scenario 1: Wallpaper for room 3x4m', () => {
    const roomMetrics: RoomMetrics = {
      floorArea: 12, perimeter: 14, grossWallArea: 37.8,
      windowsArea: 2.25, doorsArea: 1.8, netWallArea: 33.75,
      skirtingLength: 14, volume: 32.4,
    };
    const template: MaterialTemplate = {
      id: 'wp', name: 'Обои', unit: 'рулон',
      coveragePerUnit: 5.3, wastePercent: 10, defaultPrice: 1800,
    };
    // Обои рассчитываются по площади стен (netWallArea)
    // 33.75 / 5.3 * 1.10 = 7.01 → 8 рулонов
    const result = calculateMaterialQuantity(template, roomMetrics, undefined, 'netWallArea');
    expect(result.displayQty).toBe(8);
  });

  it('Scenario 2: Paint 50m² 2 layers', () => {
    const template: MaterialTemplate = {
      id: 'paint', name: 'Краска', unit: 'л',
      consumptionRate: 0.006, layers: 2, wastePercent: 5, packageSize: 10,
    };
    const result = calculateMaterialQuantity(template, { ...mockMetrics, floorArea: 50 });
    expect(result.packages).toBe(1);
  });

  it('Scenario 3: Tile 20m²', () => {
    const template: MaterialTemplate = {
      id: 'tile', name: 'Плитка', unit: 'м²',
      coveragePerUnit: 1.0, wastePercent: 10, defaultPrice: 1200,
    };
    const result = calculateMaterialQuantity(template, { ...mockMetrics, floorArea: 20 });
    expect(result.displayQty).toBe(22);
  });

  it('Scenario 4: Skirting for perimeter 18m', () => {
    const template: MaterialTemplate = {
      id: 'skirt', name: 'Плинтус', unit: 'шт',
      isPerimeter: true, multiplier: 1.0, packageSize: 2.5, wastePercent: 5,
    };
    const result = calculateMaterialQuantity(template, mockMetrics);
    expect(result.displayQty).toBe(8);
  });
});