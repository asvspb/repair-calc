import { describe, it, expect } from 'vitest';
import {
  roundCostUp,
  migrateWorkData,
  calculateWorkQuantity,
  calculateWorkCosts,
  calculateRoomCosts,
} from '../../src/utils/costs';
import type { WorkData, RoomData, RoomMetrics } from '../../src/types';

describe('roundCostUp', () => {
  it('should round up to nearest integer', () => {
    expect(roundCostUp(10.1)).toBe(11);
    expect(roundCostUp(10.9)).toBe(11);
    expect(roundCostUp(10.0)).toBe(10);
  });

  it('should handle zero', () => {
    expect(roundCostUp(0)).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(roundCostUp(-5.5)).toBe(-5); // Math.ceil rounds toward positive infinity
  });

  it('should handle very small decimals', () => {
    expect(roundCostUp(0.01)).toBe(1);
    expect(roundCostUp(0.99)).toBe(1);
  });
});

describe('migrateWorkData', () => {
  const createBaseWork = (overrides: Partial<WorkData> = {}): WorkData => ({
    id: 'work-1',
    name: 'Test Work',
    category: 'flooring',
    enabled: true,
    workUnitPrice: 500,
    calculationType: 'floorArea',
    unit: 'м²',
    materials: [],
    tools: [],
    ...overrides,
  });

  it('should return work with initialized arrays if missing', () => {
    const work = {
      id: 'work-1',
      name: 'Test Work',
      category: 'flooring',
      enabled: true,
      workUnitPrice: 500,
      calculationType: 'floorArea',
    } as WorkData;

    const migrated = migrateWorkData(work);

    expect(migrated.materials).toEqual([]);
    expect(migrated.tools).toEqual([]);
  });

  it('should migrate legacy materialPrice to materials array', () => {
    const work = createBaseWork({
      materialPrice: 300,
      materials: undefined as unknown as [],
    });

    const migrated = migrateWorkData(work);

    expect(migrated.materials).toHaveLength(1);
    expect(migrated.materials![0].name).toBe('Материалы');
    expect(migrated.materials![0].pricePerUnit).toBe(300);
  });

  it('should not create material if materials already exist', () => {
    const work = createBaseWork({
      materialPrice: 300,
      materials: [{ id: 'm1', name: 'Existing Material', quantity: 2, unit: 'кг', pricePerUnit: 100 }],
    });

    const migrated = migrateWorkData(work);

    expect(migrated.materials).toHaveLength(1);
    expect(migrated.materials![0].name).toBe('Existing Material');
  });

  it('should not mutate original work object', () => {
    const work = createBaseWork({
      materialPrice: 300,
    });
    delete (work as Partial<WorkData>).materials;

    const migrated = migrateWorkData(work);

    expect(work.materials).toBeUndefined();
    expect(migrated.materials).toBeDefined();
  });
});

describe('calculateWorkQuantity', () => {
  const createBaseMetrics = (overrides: Partial<RoomMetrics> = {}): RoomMetrics => ({
    floorArea: 20,
    perimeter: 18,
    grossWallArea: 54,
    windowsArea: 0,
    doorsArea: 0,
    netWallArea: 54,
    skirtingLength: 18,
    volume: 60,
    ...overrides,
  });

  const createBaseWork = (overrides: Partial<WorkData> = {}): WorkData => ({
    id: 'work-1',
    name: 'Test Work',
    category: 'flooring',
    enabled: true,
    workUnitPrice: 500,
    calculationType: 'floorArea',
    ...overrides,
  });

  it('should return manualQty if set', () => {
    const work = createBaseWork({ manualQty: 15, calculationType: 'floorArea' });
    const metrics = createBaseMetrics({ floorArea: 20 });

    expect(calculateWorkQuantity(work, metrics)).toBe(15);
  });

  it('should return floorArea for calculationType "floorArea"', () => {
    const work = createBaseWork({ calculationType: 'floorArea' });
    const metrics = createBaseMetrics({ floorArea: 25.5 });

    expect(calculateWorkQuantity(work, metrics)).toBe(25.5);
  });

  it('should return netWallArea for calculationType "netWallArea"', () => {
    const work = createBaseWork({ calculationType: 'netWallArea' });
    const metrics = createBaseMetrics({ netWallArea: 45 });

    expect(calculateWorkQuantity(work, metrics)).toBe(45);
  });

  it('should return skirtingLength for calculationType "skirtingLength"', () => {
    const work = createBaseWork({ calculationType: 'skirtingLength' });
    const metrics = createBaseMetrics({ skirtingLength: 16.5 });

    expect(calculateWorkQuantity(work, metrics)).toBe(16.5);
  });

  it('should return count for calculationType "customCount"', () => {
    const work = createBaseWork({ calculationType: 'customCount', count: 5 });
    const metrics = createBaseMetrics();

    expect(calculateWorkQuantity(work, metrics)).toBe(5);
  });

  it('should return 0 for unknown calculationType', () => {
    const work = createBaseWork({ calculationType: 'unknown' as WorkData['calculationType'] });
    const metrics = createBaseMetrics();

    expect(calculateWorkQuantity(work, metrics)).toBe(0);
  });
});

describe('calculateWorkCosts', () => {
  const createBaseMetrics = (overrides: Partial<RoomMetrics> = {}): RoomMetrics => ({
    floorArea: 20,
    perimeter: 18,
    grossWallArea: 54,
    windowsArea: 0,
    doorsArea: 0,
    netWallArea: 54,
    skirtingLength: 18,
    volume: 60,
    ...overrides,
  });

  const createBaseWork = (overrides: Partial<WorkData> = {}): WorkData => ({
    id: 'work-1',
    name: 'Test Work',
    category: 'flooring',
    enabled: true,
    workUnitPrice: 500,
    calculationType: 'floorArea',
    materials: [],
    tools: [],
    ...overrides,
  });

  it('should return zeros for disabled work', () => {
    const work = createBaseWork({ enabled: false });
    const metrics = createBaseMetrics();

    const costs = calculateWorkCosts(work, metrics);

    expect(costs).toEqual({ work: 0, material: 0, tools: 0, total: 0 });
  });

  it('should calculate work cost based on quantity and unit price', () => {
    const work = createBaseWork({
      workUnitPrice: 500,
      calculationType: 'floorArea',
    });
    const metrics = createBaseMetrics({ floorArea: 20 });

    const costs = calculateWorkCosts(work, metrics);

    // 20 * 500 = 10000
    expect(costs.work).toBe(10000);
    expect(costs.total).toBe(10000);
  });

  it('should calculate material cost from materials array', () => {
    const work = createBaseWork({
      materials: [
        { id: 'm1', name: 'Paint', quantity: 10, unit: 'л', pricePerUnit: 200 },
        { id: 'm2', name: 'Primer', quantity: 5, unit: 'л', pricePerUnit: 150 },
      ],
    });
    const metrics = createBaseMetrics();

    const costs = calculateWorkCosts(work, metrics);

    // 10*200 + 5*150 = 2000 + 750 = 2750
    expect(costs.material).toBe(2750);
  });

  it('should calculate legacy materialPrice (migrated to materials)', () => {
    const work = createBaseWork({
      materialPrice: 300,
      materialPriceType: 'per_unit',
      calculationType: 'floorArea',
      materials: [],
    });
    const metrics = createBaseMetrics({ floorArea: 20 });

    const costs = calculateWorkCosts(work, metrics);

    // migrateWorkData converts materialPrice to materials array with quantity=1
    // So material cost = 1 * 300 = 300
    expect(costs.material).toBe(300);
  });

  it('should calculate legacy materialPrice fixed', () => {
    const work = createBaseWork({
      materialPrice: 5000,
      materialPriceType: 'fixed',
      materials: [],
    });
    const metrics = createBaseMetrics();

    const costs = calculateWorkCosts(work, metrics);

    expect(costs.material).toBe(5000);
  });

  it('should calculate tools cost (purchase)', () => {
    const work = createBaseWork({
      tools: [
        { id: 't1', name: 'Brush', quantity: 5, price: 100, isRent: false },
      ],
    });
    const metrics = createBaseMetrics();

    const costs = calculateWorkCosts(work, metrics);

    // 5 * 100 = 500
    expect(costs.tools).toBe(500);
  });

  it('should calculate tools cost (rent)', () => {
    const work = createBaseWork({
      tools: [
        { id: 't1', name: 'Drill', quantity: 1, price: 200, isRent: true, rentPeriod: 3 },
      ],
    });
    const metrics = createBaseMetrics();

    const costs = calculateWorkCosts(work, metrics);

    // 1 * 200 * 3 = 600
    expect(costs.tools).toBe(600);
  });

  it('should calculate total correctly', () => {
    const work = createBaseWork({
      workUnitPrice: 500,
      calculationType: 'floorArea',
      materials: [
        { id: 'm1', name: 'Material', quantity: 1, unit: 'шт', pricePerUnit: 2000 },
      ],
      tools: [
        { id: 't1', name: 'Tool', quantity: 1, price: 500, isRent: false },
      ],
    });
    const metrics = createBaseMetrics({ floorArea: 20 });

    const costs = calculateWorkCosts(work, metrics);

    // work: 20*500=10000, material: 2000, tools: 500
    // total: 12500
    expect(costs.work).toBe(10000);
    expect(costs.material).toBe(2000);
    expect(costs.tools).toBe(500);
    expect(costs.total).toBe(12500);
  });

  it('should round costs up', () => {
    const work = createBaseWork({
      workUnitPrice: 333.33,
      calculationType: 'floorArea',
    });
    const metrics = createBaseMetrics({ floorArea: 10 });

    const costs = calculateWorkCosts(work, metrics);

    // 10 * 333.33 = 3333.3 -> 3334
    expect(costs.work).toBe(3334);
  });
});

describe('calculateRoomCosts', () => {
  const createBaseRoom = (overrides: Partial<RoomData> = {}): RoomData => ({
    id: 'room-1',
    name: 'Test Room',
    length: 5,
    width: 4,
    height: 3,
    windows: [],
    doors: [],
    works: [],
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    geometryMode: 'simple',
    ...overrides,
  });

  it('should return zeros for room without works', () => {
    const room = createBaseRoom();

    const roomCosts = calculateRoomCosts(room);

    expect(roomCosts.totalWork).toBe(0);
    expect(roomCosts.totalMaterial).toBe(0);
    expect(roomCosts.totalTools).toBe(0);
    expect(roomCosts.total).toBe(0);
  });

  it('should aggregate costs from multiple works', () => {
    const room = createBaseRoom({
      works: [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
        {
          id: 'work-2',
          name: 'Painting',
          category: 'walls',
          enabled: true,
          workUnitPrice: 300,
          calculationType: 'netWallArea',
          materials: [
            { id: 'm1', name: 'Paint', quantity: 10, unit: 'л', pricePerUnit: 200 },
          ],
          tools: [],
        },
      ],
    });

    const roomCosts = calculateRoomCosts(room);

    // Flooring: 20*500 = 10000 (work only)
    // Painting: 54*300 = 16200 (work) + 2000 (material) = 18200
    // Total work: 26200, Total material: 2000, Total: 28200
    expect(roomCosts.totalWork).toBe(26200);
    expect(roomCosts.totalMaterial).toBe(2000);
    expect(roomCosts.total).toBe(28200);
  });

  it('should skip disabled works', () => {
    const room = createBaseRoom({
      works: [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
        {
          id: 'work-2',
          name: 'Painting',
          category: 'walls',
          enabled: false,
          workUnitPrice: 300,
          calculationType: 'netWallArea',
          materials: [],
          tools: [],
        },
      ],
    });

    const roomCosts = calculateRoomCosts(room);

    // Only flooring: 20*500 = 10000
    expect(roomCosts.totalWork).toBe(10000);
  });

  it('should provide costs per work id', () => {
    const room = createBaseRoom({
      works: [
        {
          id: 'flooring-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
        {
          id: 'painting-1',
          name: 'Painting',
          category: 'walls',
          enabled: true,
          workUnitPrice: 300,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
      ],
    });

    const roomCosts = calculateRoomCosts(room);

    expect(roomCosts.costs['flooring-1']).toBeDefined();
    expect(roomCosts.costs['painting-1']).toBeDefined();
    expect(roomCosts.costs['flooring-1'].work).toBe(10000);
    expect(roomCosts.costs['painting-1'].work).toBe(6000);
  });

  it('should handle extended geometry mode', () => {
    const room = createBaseRoom({
      geometryMode: 'extended',
      length: 0,
      width: 0,
      subSections: [
        { id: 's1', name: 'Main', shape: 'rectangle', length: 5, width: 4, windows: [], doors: [] },
      ],
      works: [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
      ],
    });

    const roomCosts = calculateRoomCosts(room);

    // 20 * 500 = 10000
    expect(roomCosts.totalWork).toBe(10000);
  });

  it('should handle advanced geometry mode with segments', () => {
    const room = createBaseRoom({
      geometryMode: 'advanced',
      segments: [
        { id: 'seg1', name: 'Main', length: 5, width: 4, operation: 'add' },
      ],
      works: [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          materials: [],
          tools: [],
        },
      ],
    });

    const roomCosts = calculateRoomCosts(room);

    // 20 * 500 = 10000
    expect(roomCosts.totalWork).toBe(10000);
  });
});