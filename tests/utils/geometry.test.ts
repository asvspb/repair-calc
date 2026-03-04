import { describe, it, expect } from 'vitest';
import { calculateRoomMetrics } from '../../src/utils/geometry';
import type { RoomData } from '../../src/types';

describe('calculateRoomMetrics', () => {
  // Базовая комната для тестов
  const createBaseRoom = (overrides: Partial<RoomData> = {}): RoomData => ({
    id: 'test-room',
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

  describe('simple mode (default)', () => {
    it('should calculate floor area correctly', () => {
      const room = createBaseRoom({ length: 5, width: 4 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.floorArea).toBe(20); // 5 * 4 = 20
    });

    it('should calculate perimeter correctly', () => {
      const room = createBaseRoom({ length: 5, width: 4 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.perimeter).toBe(18); // (5 + 4) * 2 = 18
    });

    it('should calculate gross wall area correctly', () => {
      const room = createBaseRoom({ length: 5, width: 4, height: 3 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.grossWallArea).toBe(54); // 18 * 3 = 54
    });

    it('should calculate volume correctly', () => {
      const room = createBaseRoom({ length: 5, width: 4, height: 3 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.volume).toBe(60); // 20 * 3 = 60
    });

    it('should calculate windows area', () => {
      const room = createBaseRoom({
        windows: [
          { id: 'w1', width: 1.5, height: 1.5, comment: '' },
          { id: 'w2', width: 1, height: 2, comment: '' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.windowsArea).toBe(4.25); // 1.5*1.5 + 1*2 = 2.25 + 2 = 4.25
    });

    it('should calculate doors area', () => {
      const room = createBaseRoom({
        doors: [
          { id: 'd1', width: 0.9, height: 2.1, comment: '' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.doorsArea).toBeCloseTo(1.89, 2); // 0.9 * 2.1 = 1.89
    });

    it('should calculate net wall area (excluding windows and doors)', () => {
      const room = createBaseRoom({
        length: 5,
        width: 4,
        height: 3,
        windows: [{ id: 'w1', width: 2, height: 1.5, comment: '' }], // 3 м²
        doors: [{ id: 'd1', width: 1, height: 2, comment: '' }], // 2 м²
      });
      const metrics = calculateRoomMetrics(room);

      // grossWallArea = 54, windows = 3, doors = 2
      expect(metrics.netWallArea).toBe(49); // 54 - 3 - 2 = 49
    });

    it('should calculate skirting length (perimeter minus doors width)', () => {
      const room = createBaseRoom({
        length: 5,
        width: 4,
        doors: [
          { id: 'd1', width: 0.9, height: 2, comment: '' },
          { id: 'd2', width: 0.8, height: 2, comment: '' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // perimeter = 18, doors width = 0.9 + 0.8 = 1.7
      expect(metrics.skirtingLength).toBeCloseTo(16.3, 1);
    });

    it('should handle zero dimensions', () => {
      const room = createBaseRoom({ length: 0, width: 0, height: 0 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.floorArea).toBe(0);
      expect(metrics.perimeter).toBe(0);
      expect(metrics.volume).toBe(0);
    });

    it('should handle missing arrays gracefully', () => {
      const room = {
        id: 'test',
        name: 'Test',
        length: 5,
        width: 4,
        height: 3,
        geometryMode: 'simple',
      } as RoomData;
      
      const metrics = calculateRoomMetrics(room);

      expect(metrics.floorArea).toBe(20);
      expect(metrics.windowsArea).toBe(0);
      expect(metrics.doorsArea).toBe(0);
    });
  });

  describe('extended mode (subSections)', () => {
    it('should calculate L-shaped room from subsections', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        length: 0, // Игнорируется в extended mode
        width: 0,
        subSections: [
          { id: 's1', name: 'Main', shape: 'rectangle', length: 5, width: 4, windows: [], doors: [] },
          { id: 's2', name: 'Extension', shape: 'rectangle', length: 3, width: 2, windows: [], doors: [] },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // 5*4 + 3*2 = 20 + 6 = 26
      expect(metrics.floorArea).toBe(26);
    });

    it('should calculate trapezoid section', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        subSections: [
          {
            id: 's1',
            name: 'Trapezoid',
            shape: 'trapezoid',
            base1: 6,
            base2: 4,
            depth: 5,
            side1: 5,
            side2: 5,
            windows: [],
            doors: [],
          },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Area = (6 + 4) * 5 / 2 = 25
      expect(metrics.floorArea).toBe(25);
      // Perimeter = 6 + 4 + 5 + 5 = 20
      expect(metrics.perimeter).toBe(20);
    });

    it('should calculate triangle section using Heron formula', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        height: 3,
        subSections: [
          {
            id: 's1',
            name: 'Triangle',
            shape: 'triangle',
            sideA: 3,
            sideB: 4,
            sideC: 5,
            windows: [],
            doors: [],
          },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // 3-4-5 triangle is right, area = 3*4/2 = 6
      // Using Heron: s = (3+4+5)/2 = 6, area = sqrt(6*3*2*1) = sqrt(36) = 6
      expect(metrics.floorArea).toBe(6);
      expect(metrics.perimeter).toBe(12);
    });

    it('should calculate parallelogram section', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        subSections: [
          {
            id: 's1',
            name: 'Parallelogram',
            shape: 'parallelogram',
            base: 6,
            depth: 4,
            side: 5,
            windows: [],
            doors: [],
          },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Area = base * depth = 6 * 4 = 24
      expect(metrics.floorArea).toBe(24);
      // Perimeter = 2 * (base + side) = 2 * (6 + 5) = 22
      expect(metrics.perimeter).toBe(22);
    });

    it('should aggregate windows and doors from all subsections', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        height: 3,
        subSections: [
          {
            id: 's1',
            name: 'Room 1',
            shape: 'rectangle',
            length: 5,
            width: 4,
            windows: [{ id: 'w1', width: 1.5, height: 1.5, comment: '' }],
            doors: [],
          },
          {
            id: 's2',
            name: 'Room 2',
            shape: 'rectangle',
            length: 3,
            width: 3,
            windows: [{ id: 'w2', width: 1, height: 1, comment: '' }],
            doors: [{ id: 'd1', width: 0.9, height: 2, comment: '' }],
          },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Windows: 1.5*1.5 + 1*1 = 2.25 + 1 = 3.25
      expect(metrics.windowsArea).toBe(3.25);
      // Doors: 0.9 * 2 = 1.8
      expect(metrics.doorsArea).toBe(1.8);
    });
  });

  describe('advanced mode (segments and obstacles)', () => {
    it('should add segment area when operation is "add"', () => {
      const room = createBaseRoom({
        geometryMode: 'advanced',
        segments: [
          { id: 'seg1', name: 'Bay window', length: 2, width: 1, operation: 'add' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Base area (0 in advanced) + 2*1 = 2
      expect(metrics.floorArea).toBe(2);
    });

    it('should subtract segment area when operation is "subtract"', () => {
      const room = createBaseRoom({
        geometryMode: 'advanced',
        segments: [
          { id: 'seg1', name: 'Main', length: 5, width: 4, operation: 'add' },
          { id: 'seg2', name: 'Niche', length: 1, width: 1, operation: 'subtract' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // 5*4 - 1*1 = 20 - 1 = 19
      expect(metrics.floorArea).toBe(19);
    });

    it('should handle obstacles (columns, ducts)', () => {
      const room = createBaseRoom({
        geometryMode: 'advanced',
        segments: [
          { id: 'seg1', name: 'Main', length: 5, width: 4, operation: 'add' },
        ],
        obstacles: [
          { id: 'obs1', name: 'Column', type: 'column', area: 0.5, perimeter: 2.5, operation: 'subtract' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // 20 - 0.5 = 19.5
      expect(metrics.floorArea).toBe(19.5);
    });

    it('should handle wall sections with different heights', () => {
      const room = createBaseRoom({
        geometryMode: 'advanced',
        height: 3,
        segments: [
          { id: 'seg1', name: 'Main', length: 5, width: 4, operation: 'add' },
        ],
        wallSections: [
          { id: 'ws1', name: 'Gable', length: 4, height: 4 },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Wall area: perimeter=18, grossWallArea=54 initially
      // Subtract 4*3=12, add 4*4=16 -> total wall area = 54 - 12 + 16 = 58
      expect(metrics.grossWallArea).toBe(58);
    });

    it('should not return negative values', () => {
      const room = createBaseRoom({
        geometryMode: 'advanced',
        segments: [
          { id: 'seg1', name: 'Small', length: 1, width: 1, operation: 'subtract' },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Would be -1, but should be clamped to 0
      expect(metrics.floorArea).toBe(0);
      expect(metrics.perimeter).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle decimal dimensions', () => {
      const room = createBaseRoom({ length: 5.5, width: 3.5 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.floorArea).toBe(19.25); // 5.5 * 3.5
    });

    it('should handle very large rooms', () => {
      const room = createBaseRoom({ length: 100, width: 50, height: 5 });
      const metrics = calculateRoomMetrics(room);

      expect(metrics.floorArea).toBe(5000);
      expect(metrics.perimeter).toBe(300);
      expect(metrics.volume).toBe(25000);
    });

    it('should handle invalid triangle sides gracefully', () => {
      const room = createBaseRoom({
        geometryMode: 'extended',
        subSections: [
          {
            id: 's1',
            name: 'Invalid Triangle',
            shape: 'triangle',
            sideA: 1,
            sideB: 1,
            sideC: 10, // Invalid: 1+1 < 10
            length: 4,
            width: 3, // Fallback
            windows: [],
            doors: [],
          },
        ],
      });
      const metrics = calculateRoomMetrics(room);

      // Should fallback to base*height/2 = 4*3/2 = 6
      expect(metrics.floorArea).toBe(6);
    });
  });
});