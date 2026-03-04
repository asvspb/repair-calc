import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageManager, BackupData, STORAGE_KEYS, CURRENT_VERSION } from '../../src/utils/storage';
import { LocalStorageProvider } from '../../src/utils/localStorageProvider';
import { TemplateStorage } from '../../src/utils/templateStorage';
import { StorageProviderError } from '../../src/types/storage';
import type { ProjectData, WorkTemplate } from '../../src/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock provider for testing
class MockStorageProvider {
  private store: Map<string, unknown> = new Map();
  
  get = vi.fn(<T>(key: string): T | null => {
    return this.store.get(key) as T | null ?? null;
  });
  
  set = vi.fn(<T>(key: string, value: T): void => {
    this.store.set(key, value);
  });
  
  remove = vi.fn((key: string): void => {
    this.store.delete(key);
  });
  
  clear = vi.fn((): void => {
    this.store.clear();
  });
  
  getStorageInfo = vi.fn(() => ({
    used: 1000,
    total: 5 * 1024 * 1024,
    percentage: 0.02,
  }));
  
  // Helper for tests
  getStore() {
    return this.store;
  }
  
  reset() {
    this.store.clear();
    vi.clearAllMocks();
  }
}

describe('LocalStorageProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = LocalStorageProvider.getInstance();
      const instance2 = LocalStorageProvider.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('get', () => {
    it('should return null for missing key', () => {
      const provider = LocalStorageProvider.getInstance();
      
      expect(provider.get('nonexistent')).toBeNull();
    });

    it('should return parsed JSON value', () => {
      const provider = LocalStorageProvider.getInstance();
      const data = { name: 'test', value: 42 };
      localStorageMock.store['test-key'] = JSON.stringify(data);
      
      const result = provider.get<{ name: string; value: number }>('test-key');
      
      expect(result).toEqual(data);
    });

    it('should return null for corrupted data', () => {
      const provider = LocalStorageProvider.getInstance();
      localStorageMock.store['corrupted'] = 'not valid json{{{';
      
      const result = provider.get('corrupted');
      
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store value as JSON', () => {
      const provider = LocalStorageProvider.getInstance();
      const data = { name: 'test', items: [1, 2, 3] };
      
      provider.set('test-key', data);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(data)
      );
    });
  });

  describe('remove', () => {
    it('should remove item from storage', () => {
      const provider = LocalStorageProvider.getInstance();
      
      provider.remove('test-key');
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage usage info', () => {
      const provider = LocalStorageProvider.getInstance();
      localStorageMock.store['key1'] = 'value1';
      localStorageMock.store['key2'] = 'value2';
      
      const info = provider.getStorageInfo();
      
      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('total');
      expect(info).toHaveProperty('percentage');
      expect(info.total).toBe(5 * 1024 * 1024);
    });
  });
});

describe('StorageManager', () => {
  let mockProvider: MockStorageProvider;

  const createTestProject = (id: string, name: string): ProjectData => ({
    id,
    name,
    rooms: [
      {
        id: 'room-1',
        name: 'Living Room',
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
      },
    ],
  });

  const createTestTemplate = (id: string, name: string): WorkTemplate => ({
    id,
    name,
    category: 'flooring',
    workUnitPrice: 500,
    calculationType: 'floorArea',
    unit: 'м²',
    materials: [],
    tools: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    mockProvider = new MockStorageProvider();
    StorageManager.setProvider(mockProvider as unknown as LocalStorageProvider);
    TemplateStorage.setProvider(mockProvider as unknown as LocalStorageProvider);
  });

  describe('saveProjects', () => {
    it('should save projects to storage', () => {
      const projects = [createTestProject('p1', 'Project 1')];
      
      StorageManager.saveProjects(projects);
      
      expect(mockProvider.set).toHaveBeenCalledWith(
        STORAGE_KEYS.PROJECTS,
        projects
      );
      expect(mockProvider.set).toHaveBeenCalledWith(
        STORAGE_KEYS.VERSION,
        CURRENT_VERSION
      );
    });

    it('should throw StorageError on quota exceeded', () => {
      mockProvider.set.mockImplementationOnce(() => {
        throw new StorageProviderError('quota_exceeded', 'Storage full');
      });
      
      expect(() => StorageManager.saveProjects([])).toThrow();
    });
  });

  describe('loadProjects', () => {
    it('should return null when no projects exist', () => {
      mockProvider.get.mockReturnValue(null);
      
      const result = StorageManager.loadProjects();
      
      expect(result).toBeNull();
    });

    it('should return projects array', () => {
      const projects = [createTestProject('p1', 'Project 1')];
      mockProvider.get.mockReturnValue(projects);
      
      const result = StorageManager.loadProjects();
      
      expect(result).toEqual(projects);
    });

    it('should return null for invalid data structure', () => {
      mockProvider.get.mockReturnValue({ not: 'an array' });
      
      const result = StorageManager.loadProjects();
      
      expect(result).toBeNull();
    });
  });

  describe('saveActiveProject', () => {
    it('should save active project id', () => {
      StorageManager.saveActiveProject('project-123');
      
      expect(mockProvider.set).toHaveBeenCalledWith(
        STORAGE_KEYS.ACTIVE_PROJECT,
        'project-123'
      );
    });
  });

  describe('loadActiveProject', () => {
    it('should return active project id', () => {
      mockProvider.get.mockReturnValue('project-123');
      
      const result = StorageManager.loadActiveProject();
      
      expect(result).toBe('project-123');
    });

    it('should return null when not set', () => {
      mockProvider.get.mockReturnValue(null);
      
      const result = StorageManager.loadActiveProject();
      
      expect(result).toBeNull();
    });
  });

  describe('exportToJSON', () => {
    it('should export valid JSON with all required fields', () => {
      const projects = [createTestProject('p1', 'Project 1')];
      const templates = [createTestTemplate('t1', 'Template 1')];
      mockProvider.get.mockReturnValue(templates);
      
      const json = StorageManager.exportToJSON(projects, 'p1');
      const data = JSON.parse(json) as BackupData;
      
      expect(data.version).toBe(CURRENT_VERSION);
      expect(data.projects).toEqual(projects);
      expect(data.activeProjectId).toBe('p1');
      expect(data.workTemplates).toEqual(templates);
      expect(data.exportedAt).toBeDefined();
    });
  });

  describe('importFromJSON', () => {
    it('should import valid backup data', () => {
      const backupData: BackupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        projects: [createTestProject('p1', 'Project 1')],
        activeProjectId: 'p1',
        workTemplates: [createTestTemplate('t1', 'Template 1')],
      };
      
      const result = StorageManager.importFromJSON(JSON.stringify(backupData));
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(backupData);
      }
    });

    it('should fail for invalid JSON', () => {
      const result = StorageManager.importFromJSON('not valid json');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('JSON');
      }
    });

    it('should fail for missing projects', () => {
      const result = StorageManager.importFromJSON(JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
      }));
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('проекты');
      }
    });

    it('should fail for missing version', () => {
      const result = StorageManager.importFromJSON(JSON.stringify({
        projects: [],
      }));
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('версия');
      }
    });

    it('should fail for invalid project structure', () => {
      const result = StorageManager.importFromJSON(JSON.stringify({
        version: '1.0.0',
        projects: [{ name: 'Invalid' }], // Missing id and rooms
      }));
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('проекта');
      }
    });

    it('should fail for invalid template structure', () => {
      const result = StorageManager.importFromJSON(JSON.stringify({
        version: '1.0.0',
        projects: [createTestProject('p1', 'Project 1')],
        workTemplates: [{ name: 'Invalid' }], // Missing id and category
      }));
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('шаблона');
      }
    });
  });

  describe('exportToCSV', () => {
    it('should export valid CSV with headers', () => {
      const projects = [createTestProject('p1', 'Project 1')];
      
      const csv = StorageManager.exportToCSV(projects);
      
      expect(csv).toContain('Объект');
      expect(csv).toContain('Комната');
      expect(csv).toContain('Работа');
      expect(csv).toContain('\uFEFF'); // BOM for Excel
    });

    it('should include work costs in CSV', () => {
      const project = createTestProject('p1', 'Project 1');
      project.rooms[0].works = [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: true,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          unit: 'м²',
          materials: [],
          tools: [],
        },
      ];
      
      const csv = StorageManager.exportToCSV([project]);
      const rows = csv.split('\n');
      
      expect(rows.length).toBe(2); // Header + 1 work
      expect(rows[1]).toContain('Flooring');
      expect(rows[1]).toContain('10000.00'); // 20 * 500 = 10000
    });

    it('should skip disabled works', () => {
      const project = createTestProject('p1', 'Project 1');
      project.rooms[0].works = [
        {
          id: 'work-1',
          name: 'Flooring',
          category: 'flooring',
          enabled: false,
          workUnitPrice: 500,
          calculationType: 'floorArea',
          unit: 'м²',
          materials: [],
          tools: [],
        },
      ];
      
      const csv = StorageManager.exportToCSV([project]);
      const rows = csv.split('\n');
      
      expect(rows.length).toBe(1); // Only header
    });
  });

  describe('clearAll', () => {
    it('should remove all storage keys', () => {
      StorageManager.clearAll();
      
      expect(mockProvider.remove).toHaveBeenCalledWith(STORAGE_KEYS.PROJECTS);
      expect(mockProvider.remove).toHaveBeenCalledWith(STORAGE_KEYS.ACTIVE_PROJECT);
      expect(mockProvider.remove).toHaveBeenCalledWith(STORAGE_KEYS.VERSION);
      expect(mockProvider.remove).toHaveBeenCalledWith(STORAGE_KEYS.WORK_TEMPLATES);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage info from provider', () => {
      const info = StorageManager.getStorageInfo();
      
      expect(info).toEqual({
        used: 1000,
        total: 5 * 1024 * 1024,
        percentage: 0.02,
      });
    });
  });
});

describe('TemplateStorage', () => {
  let mockProvider: MockStorageProvider;

  const createTestTemplate = (id: string, name: string, category: WorkTemplate['category'] = 'flooring'): WorkTemplate => ({
    id,
    name,
    category,
    workUnitPrice: 500,
    calculationType: 'floorArea',
    unit: 'м²',
    materials: [],
    tools: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    mockProvider = new MockStorageProvider();
    TemplateStorage.setProvider(mockProvider as unknown as LocalStorageProvider);
  });

  describe('loadTemplates', () => {
    it('should return empty array when no templates', () => {
      mockProvider.get.mockReturnValue(null);
      
      const result = TemplateStorage.loadTemplates();
      
      expect(result).toEqual([]);
    });

    it('should return templates array', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.loadTemplates();
      
      expect(result).toEqual(templates);
    });

    it('should return empty array for invalid data', () => {
      mockProvider.get.mockReturnValue({ not: 'array' });
      
      const result = TemplateStorage.loadTemplates();
      
      expect(result).toEqual([]);
    });
  });

  describe('saveTemplates', () => {
    it('should save templates to storage', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      
      TemplateStorage.saveTemplates(templates);
      
      expect(mockProvider.set).toHaveBeenCalledWith(
        STORAGE_KEYS.WORK_TEMPLATES,
        templates
      );
    });
  });

  describe('addTemplate', () => {
    it('should add new template', () => {
      const existing = [createTestTemplate('t1', 'Template 1')];
      mockProvider.get.mockReturnValue(existing);
      
      const newTemplate = createTestTemplate('t2', 'Template 2');
      const result = TemplateStorage.addTemplate(newTemplate);
      
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('should update existing template', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      mockProvider.get.mockReturnValue(templates);
      
      const updated = { ...templates[0], name: 'Updated Name' };
      const result = TemplateStorage.updateTemplate(updated);
      
      expect(result[0].name).toBe('Updated Name');
      expect(result[0].updatedAt).toBeDefined();
    });

    it('should not add if template not found', () => {
      const templates = [createTestTemplate('t1', 'Template 1')];
      mockProvider.get.mockReturnValue(templates);
      
      const updated = createTestTemplate('t2', 'Not Existing');
      const result = TemplateStorage.updateTemplate(updated);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('upsertByName', () => {
    it('should update template with same name', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      const updated = createTestTemplate('t2', 'Template One'); // Same name, different id
      const result = TemplateStorage.upsertByName(updated);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1'); // Keep original ID
    });

    it('should add new template if name not found', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      const newTemplate = createTestTemplate('t2', 'Template Two');
      const result = TemplateStorage.upsertByName(newTemplate);
      
      expect(result).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      const updated = createTestTemplate('t2', 'TEMPLATE ONE');
      const result = TemplateStorage.upsertByName(updated);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by id', () => {
      const templates = [
        createTestTemplate('t1', 'Template 1'),
        createTestTemplate('t2', 'Template 2'),
      ];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.deleteTemplate('t1');
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t2');
    });
  });

  describe('findByName', () => {
    it('should find template by name', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.findByName('Template One');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('t1');
    });

    it('should be case-insensitive', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.findByName('TEMPLATE ONE');
      
      expect(result).toBeDefined();
    });

    it('should return undefined if not found', () => {
      mockProvider.get.mockReturnValue([]);
      
      const result = TemplateStorage.findByName('Not Found');
      
      expect(result).toBeUndefined();
    });
  });

  describe('existsByName', () => {
    it('should return true if template exists', () => {
      const templates = [createTestTemplate('t1', 'Template One')];
      mockProvider.get.mockReturnValue(templates);
      
      expect(TemplateStorage.existsByName('Template One')).toBe(true);
    });

    it('should return false if template does not exist', () => {
      mockProvider.get.mockReturnValue([]);
      
      expect(TemplateStorage.existsByName('Not Found')).toBe(false);
    });
  });

  describe('searchByName', () => {
    beforeEach(() => {
      const templates = [
        createTestTemplate('t1', 'Floor Painting'),
        createTestTemplate('t2', 'Wall Painting'),
        createTestTemplate('t3', 'Ceiling Plaster'),
      ];
      mockProvider.get.mockReturnValue(templates);
    });

    it('should find templates by substring', () => {
      const result = TemplateStorage.searchByName('Paint');
      
      expect(result).toHaveLength(2);
    });

    it('should return all templates for empty query', () => {
      const result = TemplateStorage.searchByName('');
      
      expect(result).toHaveLength(3);
    });

    it('should be case-insensitive', () => {
      const result = TemplateStorage.searchByName('PAINT');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('filterByCategory', () => {
    it('should filter templates by category', () => {
      const templates = [
        createTestTemplate('t1', 'Floor 1', 'flooring'),
        createTestTemplate('t2', 'Wall 1', 'walls'),
        createTestTemplate('t3', 'Floor 2', 'flooring'),
      ];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.filterByCategory('flooring');
      
      expect(result).toHaveLength(2);
    });

    it('should return all for category "all"', () => {
      const templates = [
        createTestTemplate('t1', 'Floor 1', 'flooring'),
        createTestTemplate('t2', 'Wall 1', 'walls'),
      ];
      mockProvider.get.mockReturnValue(templates);
      
      const result = TemplateStorage.filterByCategory('all');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('searchAndFilter', () => {
    beforeEach(() => {
      const templates = [
        createTestTemplate('t1', 'Floor Painting', 'flooring'),
        createTestTemplate('t2', 'Wall Painting', 'walls'),
        createTestTemplate('t3', 'Floor Screed', 'flooring'),
      ];
      mockProvider.get.mockReturnValue(templates);
    });

    it('should search and filter combined', () => {
      const result = TemplateStorage.searchAndFilter('Paint', 'flooring');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Floor Painting');
    });

    it('should only filter when query is empty', () => {
      const result = TemplateStorage.searchAndFilter('', 'flooring');
      
      expect(result).toHaveLength(2);
    });

    it('should only search when category is all', () => {
      const result = TemplateStorage.searchAndFilter('Paint', 'all');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('clearTemplates', () => {
    it('should remove templates from storage', () => {
      TemplateStorage.clearTemplates();
      
      expect(mockProvider.remove).toHaveBeenCalledWith(STORAGE_KEYS.WORK_TEMPLATES);
    });
  });
});

describe('StorageProviderError', () => {
  it('should create error with type', () => {
    const error = new StorageProviderError('quota_exceeded', 'Storage is full');
    
    expect(error.type).toBe('quota_exceeded');
    expect(error.message).toBe('Storage is full');
    expect(error.name).toBe('StorageProviderError');
  });

  describe('fromError', () => {
    it('should return same error if already StorageProviderError', () => {
      const original = new StorageProviderError('corrupted', 'Data corrupted');
      
      const result = StorageProviderError.fromError(original);
      
      expect(result).toBe(original);
    });

    it('should detect QuotaExceededError', () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'QuotaExceededError';
      
      const result = StorageProviderError.fromError(quotaError);
      
      expect(result.type).toBe('quota_exceeded');
    });

    it('should handle generic error', () => {
      const genericError = new Error('Something went wrong');
      
      const result = StorageProviderError.fromError(genericError);
      
      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle non-Error values', () => {
      const result = StorageProviderError.fromError('string error');
      
      expect(result.type).toBe('unknown');
    });
  });
});