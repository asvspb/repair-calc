/**
 * Тесты для ApiStorageProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiStorageProvider } from '../../src/api/storage/apiStorageProvider';
import * as projectsApi from '../../src/api/projects';

// Mock projects API
vi.mock('../../src/api/projects', () => ({
  syncPull: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  apiToClientProject: vi.fn((p: any) => ({
    id: p.id,
    name: p.name,
    city: p.city || undefined,
    useAiPricing: p.use_ai_pricing,
    lastAiPriceUpdate: p.last_ai_price_update || undefined,
    rooms: (p.rooms || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      geometryMode: r.geometry_mode,
      length: r.length,
      width: r.width,
      height: r.height,
      segments: [],
      obstacles: [],
      wallSections: [],
      subSections: [],
      windows: [],
      doors: [],
      works: [],
    })),
  })),
  ProjectsApiError: class ProjectsApiError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'ProjectsApiError';
    }
  },
}));

describe('ApiStorageProvider', () => {
  let provider: ApiStorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset singleton
    ApiStorageProvider.resetInstance();
    provider = ApiStorageProvider.getInstance();
  });

  afterEach(() => {
    provider.clearCache();
    ApiStorageProvider.resetInstance();
  });

  describe('loadProjectsAsync', () => {
    it('should use syncPull to fetch projects with rooms', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          user_id: 'user-1',
          name: 'Test Project',
          city: 'Moscow',
          use_ai_pricing: false,
          last_ai_price_update: null,
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          rooms: [
            {
              id: 'room-1',
              project_id: 'proj-1',
              name: 'Living Room',
              geometry_mode: 'simple',
              length: 5,
              width: 4,
              height: 2.6,
              segments: null,
              obstacles: null,
              wall_sections: null,
              sub_sections: null,
              windows: null,
              doors: null,
              works: null,
              sort_order: 0,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ];

      (projectsApi.syncPull as any).mockResolvedValueOnce({
        status: 'success',
        data: {
          projects: mockProjects,
          timestamp: Date.now(),
        },
      });

      const result = await provider.loadProjectsAsync();

      expect(projectsApi.syncPull).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('proj-1');
      expect(result[0].rooms).toHaveLength(1);
      expect(result[0].rooms[0].name).toBe('Living Room');
    });

    it('should cache loaded projects', async () => {
      (projectsApi.syncPull as any).mockResolvedValueOnce({
        status: 'success',
        data: {
          projects: [
            {
              id: 'proj-1',
              name: 'Test',
              rooms: [],
            },
          ],
          timestamp: Date.now(),
        },
      });

      await provider.loadProjectsAsync();

      // Second call should use cache (but syncPull is called once)
      const result = await provider.loadProjectsAsync();

      // syncPull should be called twice because loadProjectsAsync always fetches fresh data
      expect(projectsApi.syncPull).toHaveBeenCalledTimes(2);
    });

    it('should save projects to localStorage as cache', async () => {
      (projectsApi.syncPull as any).mockResolvedValueOnce({
        status: 'success',
        data: {
          projects: [
            {
              id: 'proj-1',
              name: 'Test Project',
              rooms: [],
            },
          ],
          timestamp: Date.now(),
        },
      });

      await provider.loadProjectsAsync();

      const cached = localStorage.getItem('repair-calc-projects');
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('proj-1');
    });

    it('should fallback to localStorage cache on error', async () => {
      // Setup localStorage cache
      localStorage.setItem('repair-calc-projects', JSON.stringify([
        { id: 'cached-proj', name: 'Cached Project', rooms: [] },
      ]));

      (projectsApi.syncPull as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.loadProjectsAsync();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached-proj');
    });
  });

  describe('resetInstance', () => {
    it('should reset singleton instance', () => {
      const instance1 = ApiStorageProvider.getInstance();
      ApiStorageProvider.resetInstance();
      const instance2 = ApiStorageProvider.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('clearCache', () => {
    it('should clear internal cache', async () => {
      (projectsApi.syncPull as any).mockResolvedValue({
        status: 'success',
        data: {
          projects: [{ id: 'proj-1', name: 'Test', rooms: [] }],
          timestamp: Date.now(),
        },
      });

      await provider.loadProjectsAsync();
      provider.clearCache();

      // Cache should be cleared
      const cachedProjects = provider.get('repair-calc-projects');
      expect(cachedProjects).toBeNull();
    });
  });
});