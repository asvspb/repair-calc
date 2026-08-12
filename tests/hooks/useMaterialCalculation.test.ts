/**
 * Tests for useMaterialCalculation hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMaterialCalculation, canCalculateMaterial } from '../../src/hooks/useMaterialCalculation';
import type { Material, RoomMetrics } from '../../src/types';

// Mock room metrics
const mockMetrics: RoomMetrics = {
  floorArea: 20,
  netWallArea: 50,
  perimeter: 18,
  skirtingLength: 16,
  volume: 50,
  grossWallArea: 60,
  windowsArea: 5,
  doorsArea: 3,
};

describe('canCalculateMaterial', () => {
  it('should return true for material with coveragePerUnit', () => {
    const material: Material = {
      id: '1',
      name: 'Ламинат',
      quantity: 10,
      unit: 'упак',
      pricePerUnit: 1200,
      coveragePerUnit: 2.0,
    };
    expect(canCalculateMaterial(material)).toBe(true);
  });

  it('should return true for material with consumptionRate', () => {
    const material: Material = {
      id: '1',
      name: 'Краска',
      quantity: 2,
      unit: 'л',
      pricePerUnit: 800,
      consumptionRate: 0.006,
    };
    expect(canCalculateMaterial(material)).toBe(true);
  });

  it('should return true for perimeter material', () => {
    const material: Material = {
      id: '1',
      name: 'Плинтус',
      quantity: 8,
      unit: 'шт',
      pricePerUnit: 350,
      isPerimeter: true,
    };
    expect(canCalculateMaterial(material)).toBe(true);
  });

  it('should return false for simple material without calculation params', () => {
    const material: Material = {
      id: '1',
      name: 'Крепёж',
      quantity: 100,
      unit: 'шт',
      pricePerUnit: 5,
    };
    expect(canCalculateMaterial(material)).toBe(false);
  });
});

describe('useMaterialCalculation', () => {
  it('should calculate material with coveragePerUnit', () => {
    const material: Material = {
      id: '1',
      name: 'Обои',
      quantity: 5,
      unit: 'рулон',
      pricePerUnit: 1500,
      coveragePerUnit: 5.3,
      wastePercent: 10,
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'netWallArea',
      })
    );

    expect(result.current.isCalculated).toBe(true);
    expect(result.current.canAutoCalculate).toBe(true);
    // 50 м² / 5.3 м² * 1.10 = 10.38 рулонов → Math.ceil = 11
    expect(result.current.recommendedQty).toBeCloseTo(11, 0);
  });

  it('should calculate material with consumptionRate and layers', () => {
    const material: Material = {
      id: '1',
      name: 'Краска',
      quantity: 1,
      unit: 'л',
      pricePerUnit: 800,
      consumptionRate: 0.006,
      layers: 2,
      wastePercent: 5,
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'floorArea',
      })
    );

    expect(result.current.isCalculated).toBe(true);
    // 20 м² * 0.006 * 2 * 1.05 = 0.252 л → Math.ceil = 1
    expect(result.current.total).toBe(1);
  });

  it('should calculate perimeter material', () => {
    const material: Material = {
      id: '1',
      name: 'Плинтус',
      quantity: 8,
      unit: 'шт',
      pricePerUnit: 350,
      isPerimeter: true,
      packageSize: 2.5, // длина одной штуки
      wastePercent: 5,
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'floorArea',
      })
    );

    expect(result.current.isCalculated).toBe(true);
    // 18 м * 1.05 / 2.5 = 7.56 -> 8 шт
    expect(result.current.recommendedQty).toBe(8);
  });

  it('should return current quantity when autoCalcEnabled is false', () => {
    const material: Material = {
      id: '1',
      name: 'Обои',
      quantity: 5,
      unit: 'рулон',
      pricePerUnit: 1500,
      coveragePerUnit: 5.3,
      wastePercent: 10,
      autoCalcEnabled: false,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'netWallArea',
      })
    );

    expect(result.current.isCalculated).toBe(false);
    expect(result.current.recommendedQty).toBe(5);
  });

  it('should return formula for calculated material', () => {
    const material: Material = {
      id: '1',
      name: 'Ламинат',
      quantity: 10,
      unit: 'упак',
      pricePerUnit: 1200,
      coveragePerUnit: 2.0,
      wastePercent: 5,
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'floorArea',
      })
    );

    expect(result.current.formula).toContain('20');
    expect(result.current.formula).toContain('2');
    // 20 / 2.0 * 1.05 = 10.5 → Math.ceil = 11
    expect(result.current.formula).toContain('11');
  });

  it('should use floorArea for floorArea calculationType', () => {
    const material: Material = {
      id: '1',
      name: 'Ламинат',
      quantity: 10,
      unit: 'упак',
      pricePerUnit: 1200,
      coveragePerUnit: 2.0,
      wastePercent: 0, // без запаса
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'floorArea',
      })
    );

    // 20 м² / 2.0 = 10 упак (без запаса)
    expect(result.current.total).toBe(10);
  });

  it('should use netWallArea for netWallArea calculationType', () => {
    const material: Material = {
      id: '1',
      name: 'Обои',
      quantity: 10,
      unit: 'рулон',
      pricePerUnit: 1500,
      coveragePerUnit: 5.3,
      wastePercent: 0, // без запаса
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'netWallArea',
      })
    );

    // 50 м² / 5.3 = 9.43 рулона (без запаса) → Math.ceil = 10
    expect(result.current.total).toBe(10);
  });

  it('should handle customCount calculationType', () => {
    const material: Material = {
      id: '1',
      name: 'Розетка',
      quantity: 5,
      unit: 'шт',
      pricePerUnit: 200,
      multiplier: 1.0,
      autoCalcEnabled: true,
    };

    const { result } = renderHook(() =>
      useMaterialCalculation({
        material,
        metrics: mockMetrics,
        calculationType: 'customCount',
        customCount: 5,
      })
    );

    expect(result.current.recommendedQty).toBe(5);
  });
});