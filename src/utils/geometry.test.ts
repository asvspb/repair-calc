import { describe, it, expect } from 'vitest';
import { calculateSectionMetrics, calculateRoomMetrics } from '../utils/geometry';
import type { RoomSubSection, RoomData } from '../types';

describe('calculateSectionMetrics', () => {
  describe('Rectangle', () => {
    it('should calculate area and perimeter for a rectangle', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'rectangle',
        length: 4,
        width: 3,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      expect(result.area).toBe(12);
      expect(result.perimeter).toBe(14);
    });

    it('should handle zero dimensions', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'rectangle',
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      expect(result.area).toBe(0);
      expect(result.perimeter).toBe(0);
    });
  });

  describe('Trapezoid', () => {
    it('should calculate area and perimeter for a trapezoid', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'trapezoid',
        base1: 4,
        base2: 6,
        depth: 3,
        side1: 3.16,
        side2: 3.16,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      // Area = (base1 + base2) * depth / 2 = (4 + 6) * 3 / 2 = 15
      expect(result.area).toBe(15);
      // Perimeter = base1 + base2 + side1 + side2 = 4 + 6 + 3.16 + 3.16 = 16.32
      expect(result.perimeter).toBe(16.32);
    });
  });

  describe('Triangle', () => {
    it('should calculate area using Heron formula for valid triangle', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'triangle',
        sideA: 3,
        sideB: 4,
        sideC: 5,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      // Right triangle: s = (3+4+5)/2 = 6, area = sqrt(6*3*2*1) = 6
      expect(result.area).toBe(6);
      expect(result.perimeter).toBe(12);
    });

    it('should handle invalid triangle (sum of two sides <= third)', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'triangle',
        sideA: 1,
        sideB: 2,
        sideC: 10,
        length: 4,
        width: 3,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      // Falls back to base*height/2
      expect(result.area).toBe(6);
    });

    it('should handle equilateral triangle', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'triangle',
        sideA: 4,
        sideB: 4,
        sideC: 4,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      // s = 6, area = sqrt(6*2*2*2) = sqrt(48) ≈ 6.928
      expect(result.area).toBeCloseTo(6.928, 2);
      expect(result.perimeter).toBe(12);
    });
  });

  describe('Parallelogram', () => {
    it('should calculate area and perimeter for a parallelogram', () => {
      const section: RoomSubSection = {
        id: '1',
        name: 'Test',
        shape: 'parallelogram',
        base: 5,
        depth: 3,
        side: 4,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      // Area = base * depth = 5 * 3 = 15
      expect(result.area).toBe(15);
      // Perimeter = 2 * (base + side) = 2 * (5 + 4) = 18
      expect(result.perimeter).toBe(18);
    });
  });

  describe('Default/Unknown shape', () => {
    it('should return zero for unknown shape', () => {
      const section = {
        id: '1',
        name: 'Test',
        shape: 'unknown' as any,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };

      const result = calculateSectionMetrics(section);

      expect(result.area).toBe(0);
      expect(result.perimeter).toBe(0);
    });
  });
});

describe('calculateRoomMetrics', () => {
  describe('NaN bug prevention', () => {
    it('should not return NaN when room dimensions are undefined', () => {
      const room = {
        id: '1',
        name: 'Test Room',
        geometryMode: 'simple',
        length: undefined as any,
        width: undefined as any,
        height: undefined as any,
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        windows: [],
        doors: [],
        works: [],
      };

      const result = calculateRoomMetrics(room);

      expect(Number.isNaN(result.floorArea)).toBe(false);
      expect(Number.isNaN(result.perimeter)).toBe(false);
      expect(Number.isNaN(result.grossWallArea)).toBe(false);
      expect(Number.isNaN(result.netWallArea)).toBe(false);
      expect(Number.isNaN(result.skirtingLength)).toBe(false);
      expect(Number.isNaN(result.volume)).toBe(false);

      expect(result.floorArea).toBe(0);
      expect(result.perimeter).toBe(0);
      expect(result.grossWallArea).toBe(0);
      expect(result.netWallArea).toBe(0);
      expect(result.skirtingLength).toBe(0);
      expect(result.volume).toBe(0);
    });

    it('should not return NaN when height is 0 or undefined', () => {
      const room1: RoomData = {
        id: '1',
        name: 'Test Room',
        geometryMode: 'simple',
        length: 4,
        width: 3,
        height: 0,
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        windows: [],
        doors: [],
        works: [],
      };

      const result1 = calculateRoomMetrics(room1);

      expect(Number.isNaN(result1.grossWallArea)).toBe(false);
      expect(Number.isNaN(result1.volume)).toBe(false);
      expect(result1.grossWallArea).toBe(0);
      expect(result1.volume).toBe(0);
    });

    it('should correctly calculate metrics for a simple room', () => {
      const room: RoomData = {
        id: '1',
        name: 'Test Room',
        geometryMode: 'simple',
        length: 4,
        width: 3,
        height: 2.5,
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        windows: [{ id: 'w1', width: 1.5, height: 1.4 }],
        doors: [{ id: 'd1', width: 0.9, height: 2.1 }],
        works: [],
      };

      const result = calculateRoomMetrics(room);

      expect(result.floorArea).toBe(12);
      expect(result.perimeter).toBe(14);
      expect(result.grossWallArea).toBe(35); // 14 * 2.5
      expect(result.windowsArea).toBeCloseTo(2.1, 2); // 1.5 * 1.4
      expect(result.doorsArea).toBeCloseTo(1.89, 2); // 0.9 * 2.1
      expect(result.netWallArea).toBeCloseTo(35 - 2.1 - 1.89, 2);
      expect(result.skirtingLength).toBeCloseTo(14 - 0.9, 2);
      expect(result.volume).toBe(30); // 12 * 2.5
    });
  });

  describe('Extended mode', () => {
    it('should not return NaN for empty subSections in extended mode', () => {
      const room: RoomData = {
        id: '1',
        name: 'Test Room',
        geometryMode: 'extended',
        length: 0,
        width: 0,
        height: 0,
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        windows: [],
        doors: [],
        works: [],
      };

      const result = calculateRoomMetrics(room);

      expect(Number.isNaN(result.floorArea)).toBe(false);
      expect(Number.isNaN(result.perimeter)).toBe(false);
      expect(Number.isNaN(result.grossWallArea)).toBe(false);
      expect(Number.isNaN(result.volume)).toBe(false);
    });
  });

  describe('Advanced mode', () => {
    it('should not return NaN for empty segments in advanced mode', () => {
      const room: RoomData = {
        id: '1',
        name: 'Test Room',
        geometryMode: 'advanced',
        length: 4,
        width: 3,
        height: 2.5,
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        windows: [],
        doors: [],
        works: [],
      };

      const result = calculateRoomMetrics(room);

      expect(Number.isNaN(result.floorArea)).toBe(false);
      expect(Number.isNaN(result.perimeter)).toBe(false);
      expect(Number.isNaN(result.grossWallArea)).toBe(false);
    });
  });
});
