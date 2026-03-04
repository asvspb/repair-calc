import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkTemplates } from '../../src/hooks/useWorkTemplates';
import { TemplateStorage } from '../../src/utils/templateStorage';
import type { WorkTemplate } from '../../src/types/workTemplate';
import type { WorkData } from '../../src/types';

// Mock TemplateStorage
vi.mock('../../src/utils/templateStorage', () => ({
  TemplateStorage: {
    loadTemplates: vi.fn(),
    findByName: vi.fn(),
    upsertByName: vi.fn(),
    deleteTemplate: vi.fn(),
    searchAndFilter: vi.fn(),
    existsByName: vi.fn(),
    saveTemplates: vi.fn(),
  },
}));

// Mock crypto.randomUUID
const mockUUIDs = ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5'];
let uuidIndex = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++ % mockUUIDs.length],
});

describe('useWorkTemplates', () => {
  const createTestWork = (): WorkData => ({
    id: 'work-1',
    enabled: true,
    isCustom: true,
    name: 'Test Work',
    unit: 'м²',
    workUnitPrice: 500,
    calculationType: 'floorArea',
    count: 10,
    materials: [
      { id: 'mat-1', name: 'Paint', quantity: 5, unit: 'л', pricePerUnit: 200 },
    ],
    tools: [
      { id: 'tool-1', name: 'Brush', quantity: 2, price: 100, isRent: false, rentPeriod: 0 },
    ],
  });

  const createTestTemplate = (id: string, name: string): WorkTemplate => ({
    id,
    name,
    category: 'floor',
    unit: 'м²',
    workUnitPrice: 500,
    calculationType: 'floorArea',
    count: 10,
    sourceVolume: 20,
    materials: [
      { name: 'Paint', quantity: 5, unit: 'л', pricePerUnit: 200 },
    ],
    tools: [
      { name: 'Brush', quantity: 2, price: 100, isRent: false, rentPeriod: 0 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    uuidIndex = 0;
    (TemplateStorage.loadTemplates as ReturnType<typeof vi.fn>).mockReturnValue([]);
  });

  describe('initialization', () => {
    it('should load templates on mount', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      (TemplateStorage.loadTemplates as ReturnType<typeof vi.fn>).mockReturnValue(templates);

      const { result } = renderHook(() => useWorkTemplates());

      expect(result.current.templates).toEqual(templates);
      expect(result.current.isLoading).toBe(false);
    });

    it('should start with empty array when no templates', () => {
      (TemplateStorage.loadTemplates as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const { result } = renderHook(() => useWorkTemplates());

      expect(result.current.templates).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('saveTemplate', () => {
    it('should save new template successfully', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      (TemplateStorage.findByName as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (TemplateStorage.upsertByName as ReturnType<typeof vi.fn>).mockReturnValue(templates);

      const { result } = renderHook(() => useWorkTemplates());

      let saveResult: ReturnType<typeof result.current.saveTemplate> | undefined;
      act(() => {
        saveResult = result.current.saveTemplate(createTestWork());
      });

      expect(saveResult).toEqual({ success: true, isUpdate: false });
      expect(TemplateStorage.upsertByName).toHaveBeenCalled();
    });

    it('should update existing template with forceReplace', () => {
      const existingTemplate = createTestTemplate('t1', 'Test Work');
      (TemplateStorage.findByName as ReturnType<typeof vi.fn>).mockReturnValue(existingTemplate);
      (TemplateStorage.upsertByName as ReturnType<typeof vi.fn>).mockReturnValue([existingTemplate]);

      const { result } = renderHook(() => useWorkTemplates());

      let saveResult: ReturnType<typeof result.current.saveTemplate> | undefined;
      act(() => {
        saveResult = result.current.saveTemplate(createTestWork(), true);
      });

      expect(saveResult).toEqual({ success: true, isUpdate: true });
    });

    it('should return needsConfirm when template exists without forceReplace', () => {
      const existingTemplate = createTestTemplate('t1', 'Test Work');
      (TemplateStorage.findByName as ReturnType<typeof vi.fn>).mockReturnValue(existingTemplate);

      const { result } = renderHook(() => useWorkTemplates());

      let saveResult: ReturnType<typeof result.current.saveTemplate> | undefined;
      act(() => {
        saveResult = result.current.saveTemplate(createTestWork());
      });

      expect(saveResult).toEqual({
        success: false,
        error: 'Шаблон с таким названием уже существует',
        needsConfirm: true,
      });
      expect(TemplateStorage.upsertByName).not.toHaveBeenCalled();
    });

    it('should handle save error', () => {
      (TemplateStorage.findByName as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (TemplateStorage.upsertByName as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Save failed');
      });

      const { result } = renderHook(() => useWorkTemplates());

      let saveResult: ReturnType<typeof result.current.saveTemplate> | undefined;
      act(() => {
        saveResult = result.current.saveTemplate(createTestWork());
      });

      expect(saveResult).toEqual({
        success: false,
        error: 'Save failed',
      });
    });

    it('should save workVolume as sourceVolume', () => {
      (TemplateStorage.findByName as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (TemplateStorage.upsertByName as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const { result } = renderHook(() => useWorkTemplates());

      act(() => {
        result.current.saveTemplate(createTestWork(), false, 25);
      });

      const savedTemplate = (TemplateStorage.upsertByName as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedTemplate.sourceVolume).toBe(25);
    });
  });

  describe('loadTemplate', () => {
    it('should load template to WorkData format', () => {
      const template = createTestTemplate('t1', 'Template 1');

      const { result } = renderHook(() => useWorkTemplates());

      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template);
      });

      expect(loadedWork).toMatchObject({
        enabled: true,
        isCustom: true,
        name: 'Template 1',
        unit: 'м²',
        workUnitPrice: 500,
        calculationType: 'floorArea',
      });
      expect(loadedWork?.id).toBe('uuid-1');
      expect(loadedWork?.materials).toHaveLength(1);
      expect(loadedWork?.tools).toHaveLength(1);
    });

    it('should scale materials based on room metrics', () => {
      const template = createTestTemplate('t1', 'Template 1');
      template.sourceVolume = 20; // Original room was 20 m²

      const { result } = renderHook(() => useWorkTemplates());

      // Load to a room with 40 m² floor area
      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template, {
          floorArea: 40,
          netWallArea: 50,
          skirtingLength: 30,
        });
      });

      // Material should be scaled 2x (40/20)
      expect(loadedWork?.materials[0].quantity).toBe(10); // 5 * 2
    });

    it('should not scale materials when sourceVolume is 0', () => {
      const template = createTestTemplate('t1', 'Template 1');
      template.sourceVolume = 0;

      const { result } = renderHook(() => useWorkTemplates());

      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template, {
          floorArea: 40,
          netWallArea: 50,
          skirtingLength: 30,
        });
      });

      // Material should not be scaled
      expect(loadedWork?.materials[0].quantity).toBe(5);
    });

    it('should use netWallArea for wallArea calculationType', () => {
      const template = createTestTemplate('t1', 'Template 1');
      template.calculationType = 'netWallArea';
      template.sourceVolume = 50;

      const { result } = renderHook(() => useWorkTemplates());

      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template, {
          floorArea: 40,
          netWallArea: 100,
          skirtingLength: 30,
        });
      });

      // Material should be scaled 2x (100/50)
      expect(loadedWork?.materials[0].quantity).toBe(10);
    });

    it('should use skirtingLength for skirtingLength calculationType', () => {
      const template = createTestTemplate('t1', 'Template 1');
      template.calculationType = 'skirtingLength';
      template.sourceVolume = 30;

      const { result } = renderHook(() => useWorkTemplates());

      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template, {
          floorArea: 40,
          netWallArea: 100,
          skirtingLength: 60,
        });
      });

      // Material should be scaled 2x (60/30)
      expect(loadedWork?.materials[0].quantity).toBe(10);
    });

    it('should not scale tools', () => {
      const template = createTestTemplate('t1', 'Template 1');
      template.sourceVolume = 20;

      const { result } = renderHook(() => useWorkTemplates());

      let loadedWork: WorkData | undefined;
      act(() => {
        loadedWork = result.current.loadTemplate(template, {
          floorArea: 40,
          netWallArea: 50,
          skirtingLength: 30,
        });
      });

      // Tools should not be scaled
      expect(loadedWork?.tools[0].quantity).toBe(2);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', () => {
      const remaining = [createTestTemplate('t2', 'Template 2')];
      (TemplateStorage.deleteTemplate as ReturnType<typeof vi.fn>).mockReturnValue(remaining);

      const { result } = renderHook(() => useWorkTemplates());

      act(() => {
        result.current.deleteTemplate('t1');
      });

      expect(TemplateStorage.deleteTemplate).toHaveBeenCalledWith('t1');
      expect(result.current.templates).toEqual(remaining);
    });
  });

  describe('searchTemplates', () => {
    it('should search templates with query and category', () => {
      const results = [createTestTemplate('t1', 'Paint')];
      (TemplateStorage.searchAndFilter as ReturnType<typeof vi.fn>).mockReturnValue(results);

      const { result } = renderHook(() => useWorkTemplates());

      let found: WorkTemplate[] | undefined;
      act(() => {
        found = result.current.searchTemplates('paint', 'floor');
      });

      expect(TemplateStorage.searchAndFilter).toHaveBeenCalledWith('paint', 'floor');
      expect(found).toEqual(results);
    });

    it('should search all categories when category is "all"', () => {
      const results = [createTestTemplate('t1', 'Paint')];
      (TemplateStorage.searchAndFilter as ReturnType<typeof vi.fn>).mockReturnValue(results);

      const { result } = renderHook(() => useWorkTemplates());

      act(() => {
        result.current.searchTemplates('paint', 'all');
      });

      expect(TemplateStorage.searchAndFilter).toHaveBeenCalledWith('paint', 'all');
    });
  });

  describe('templateExists', () => {
    it('should return true if template exists', () => {
      (TemplateStorage.existsByName as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const { result } = renderHook(() => useWorkTemplates());

      expect(result.current.templateExists('Test Work')).toBe(true);
    });

    it('should return false if template does not exist', () => {
      (TemplateStorage.existsByName as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useWorkTemplates());

      expect(result.current.templateExists('Test Work')).toBe(false);
    });
  });

  describe('importTemplates', () => {
    it('should import templates', () => {
      const imported = [createTestTemplate('t1', 'Imported')];
      (TemplateStorage.saveTemplates as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const { result } = renderHook(() => useWorkTemplates());

      act(() => {
        result.current.importTemplates(imported);
      });

      expect(TemplateStorage.saveTemplates).toHaveBeenCalledWith(imported);
      expect(result.current.templates).toEqual(imported);
    });
  });
});