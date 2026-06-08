import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjectDomain } from '../../../src/hooks/domains/useProjectDomain';
import type { ProjectData } from '../../../src/types';

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn(),
    loadActiveProject: vi.fn(),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
    saveProject: vi.fn(),
  },
}));

vi.mock('../../../src/api/storage', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(),
    resetInstance: vi.fn(),
  },
}));

vi.mock('../../../src/api/totals', () => ({
  saveTotals: vi.fn(),
}));

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logStart: vi.fn(() => Date.now()),
  logEnd: vi.fn(),
  logStateChange: vi.fn(),
  logWarning: vi.fn(),
  logDebug: vi.fn(),
}));

vi.mock('../../../src/utils/migration', () => ({
  runMigrations: vi.fn(),
  needsMigration: vi.fn(() => false),
}));

vi.mock('../../../src/utils/idMapper', () => ({
  idMapper: {
    getServerId: vi.fn(),
    addMapping: vi.fn(),
    clear: vi.fn(),
  },
  IdMapper: {
    isServerId: vi.fn((id: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    }),
    isLocalId: vi.fn((id: string) => id.startsWith('local-')),
  },
  isServerId: vi.fn((id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }),
}));

vi.mock('../../../src/utils/saveQueue', () => ({
  saveQueue: {
    enqueue: vi.fn((task: () => Promise<void>) => task()),
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
  },
}));

vi.mock('../../../src/utils/projectObjects', () => ({
  getAllRooms: vi.fn(() => []),
  migrateProjectToObjects: vi.fn((p: ProjectData) => ({
    ...p,
    objects: p.objects || [],
  })),
}));

import { useAuth } from '../../../src/contexts/AuthContext';
import { StorageManager } from '../../../src/utils/storage';
import { ApiStorageProvider } from '../../../src/api/storage';
import { saveTotals } from '../../../src/api/totals';
import { needsMigration, runMigrations } from '../../../src/utils/migration';
import { saveQueue } from '../../../src/utils/saveQueue';
import { migrateProjectToObjects } from '../../../src/utils/projectObjects';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockStorageManager = StorageManager as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockApiProvider = {
  loadProjectsAsync: vi.fn(),
  saveProjectsAsync: vi.fn(),
  saveProjectAsync: vi.fn(),
  createProjectAsync: vi.fn(),
  deleteProjectAsync: vi.fn(),
  markProjectDeleted: vi.fn(),
  getRoomSyncErrors: vi.fn(() => new Map()),
};

function createTestProject(id: string, name: string, city?: string): ProjectData {
  return {
    id,
    name,
    city,
    objects: [],
  };
}

async function waitForLoad(result: { current: { isLoading: boolean } }) {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
}

describe('useProjectDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    (ApiStorageProvider.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockApiProvider);

    mockStorageManager.loadProjects.mockReturnValue(null);
    mockStorageManager.loadActiveProject.mockReturnValue(null);
    mockStorageManager.saveProjects.mockImplementation(() => {});
    mockStorageManager.saveActiveProject.mockImplementation(() => {});
    mockStorageManager.saveProject.mockImplementation(() => {});

    (migrateProjectToObjects as ReturnType<typeof vi.fn>).mockImplementation(
      (p: ProjectData) => ({ ...p, objects: p.objects || [] })
    );

    mockApiProvider.loadProjectsAsync.mockResolvedValue([]);
    mockApiProvider.saveProjectsAsync.mockResolvedValue([]);
    mockApiProvider.saveProjectAsync.mockResolvedValue({} as ProjectData);
    mockApiProvider.createProjectAsync.mockResolvedValue({} as ProjectData);
    mockApiProvider.deleteProjectAsync.mockResolvedValue(undefined);
    mockApiProvider.getRoomSyncErrors.mockReturnValue(new Map());

    (saveTotals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (saveQueue.enqueue as ReturnType<typeof vi.fn>).mockImplementation(
      (task: () => Promise<void>) => task()
    );
    (needsMigration as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (runMigrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      migrated: 0,
      duplicatesRemoved: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with migrated projects', async () => {
      const project = createTestProject('p1', 'Test Project');
      const { result } = renderHook(() => useProjectDomain([project]));

      await waitForLoad(result);

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('Test Project');
      expect(result.current.activeProjectId).toBe('p1');
    });

    it('should set empty activeProjectId when no projects', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.activeProjectId).toBe('');
      expect(result.current.activeProject).toBeNull();
    });

    it('should compute activeProject based on activeProjectId', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      expect(result.current.activeProject).toBeDefined();
      expect(result.current.activeProject!.id).toBe('p1');
    });

    it('should set isLoading to false after load', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.isLoading).toBe(false);
    });

    it('should load projects from localStorage when not authenticated', async () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      mockStorageManager.loadProjects.mockReturnValue(savedProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('saved-1');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(mockStorageManager.loadProjects).toHaveBeenCalled();
      expect(result.current.projects[0].name).toBe('Saved Project');
    });

    it('should load projects from server when authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProjects = [createTestProject('server-1', 'Server Project')];
      mockApiProvider.loadProjectsAsync.mockResolvedValue(serverProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('server-1');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(mockApiProvider.loadProjectsAsync).toHaveBeenCalled();
      expect(result.current.projects).toHaveLength(1);
    });

    it('should handle error during load', async () => {
      mockStorageManager.loadProjects.mockImplementation(() => {
        throw new Error('Load error');
      });

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.error).toEqual({
        type: 'unknown',
        message: 'Ошибка загрузки данных',
      });
      expect(result.current.isLoading).toBe(false);
    });

    it('should use first project as active when saved active not found', async () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      mockStorageManager.loadProjects.mockReturnValue(savedProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('non-existent');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.activeProjectId).toBe('saved-1');
    });

    it('should save initial projects to localStorage on first run', async () => {
      const initialProjects = [createTestProject('p1', 'First Project')];
      mockStorageManager.loadProjects.mockReturnValue(null);
      mockStorageManager.loadActiveProject.mockReturnValue(null);

      const { result } = renderHook(() => useProjectDomain(initialProjects));

      await waitForLoad(result);

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
      expect(mockStorageManager.saveActiveProject).toHaveBeenCalledWith('p1');
    });

    it('should set isAuthenticated based on auth context', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should run migration when needed and authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });
      (needsMigration as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runMigrations as ReturnType<typeof vi.fn>).mockResolvedValue({
        migrated: 1,
        duplicatesRemoved: 1,
      });
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(runMigrations).toHaveBeenCalled();
    });

    it('should handle migration error gracefully', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });
      (needsMigration as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runMigrations as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Migration failed'));
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.error).toBeNull();
    });

    it('should fallback to localStorage when server has no projects', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);
      const localProjects = [createTestProject('local-1', 'Local Project')];
      mockStorageManager.loadProjects.mockReturnValue(localProjects);

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.projects[0].name).toBe('Local Project');
    });
  });

  describe('setActiveProjectId', () => {
    it('should update active project id and save', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      act(() => {
        result.current.setActiveProjectId('p2');
      });

      expect(result.current.activeProjectId).toBe('p2');
      expect(mockStorageManager.saveActiveProject).toHaveBeenCalledWith('p2');
    });

    it('should update activeProject when id changes', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      act(() => {
        result.current.setActiveProjectId('p2');
      });

      expect(result.current.activeProject!.id).toBe('p2');
      expect(result.current.activeProject!.name).toBe('Project 2');
    });
  });

  describe('createProject', () => {
    it('should create local project when not authenticated', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      let newProject: ProjectData | undefined;
      await act(async () => {
        newProject = await result.current.createProject({
          name: 'New Project',
          city: 'Moscow',
        });
      });

      expect(newProject).toBeDefined();
      expect(newProject!.name).toBe('New Project');
      expect(newProject!.city).toBe('Moscow');
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.activeProjectId).toBe(newProject!.id);
    });

    it('should create project with objects when provided', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      let newProject: ProjectData | undefined;
      await act(async () => {
        newProject = await result.current.createProject({
          name: 'New Project',
          objects: ['Объект 1', 'Объект 2'],
        });
      });

      expect(newProject!.objects).toHaveLength(2);
      expect(newProject!.objects![0].name).toBe('Объект 1');
      expect(newProject!.objects![1].name).toBe('Объект 2');
    });

    it('should create project with default object when no objects specified', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      let newProject: ProjectData | undefined;
      await act(async () => {
        newProject = await result.current.createProject({ name: 'Test' });
      });

      expect(newProject!.objects).toHaveLength(1);
      expect(newProject!.objects![0].name).toBe('Основной объект');
    });

    it('should create project on server when authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProject = createTestProject('uuid-aaaa-bbbb-cccc', 'Server Project');
      mockApiProvider.createProjectAsync.mockResolvedValue(serverProject);
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      await act(async () => {
        await result.current.createProject({
          name: 'Server Project',
          city: 'Moscow',
        });
      });

      expect(mockApiProvider.createProjectAsync).toHaveBeenCalledWith({
        name: 'Server Project',
        city: 'Moscow',
      });
    });

    it('should create server project with objects', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProject = createTestProject('uuid-aaaa', 'Server');
      serverProject.id = 'uuid-aaaa';
      mockApiProvider.createProjectAsync.mockResolvedValue(serverProject);
      mockApiProvider.saveProjectsAsync.mockResolvedValue([serverProject]);
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      await act(async () => {
        await result.current.createProject({
          name: 'Server',
          objects: ['Flat 1'],
        });
      });

      expect(mockApiProvider.saveProjectsAsync).toHaveBeenCalled();
    });

    it('should set isSyncing during creation and reset after', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(result.current.isSyncing).toBe(false);

      await act(async () => {
        await result.current.createProject({ name: 'Test' });
      });

      expect(result.current.isSyncing).toBe(false);
    });

    it('should throw and reset isSyncing on error', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });
      mockApiProvider.createProjectAsync.mockRejectedValue(new Error('Server error'));
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      await act(async () => {
        await expect(
          result.current.createProject({ name: 'Fail' })
        ).rejects.toThrow('Server error');
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('deleteProject', () => {
    it('should remove project from list', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      await act(async () => {
        await result.current.deleteProject('p2');
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].id).toBe('p1');
    });

    it('should switch active project when deleting active one', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      expect(result.current.activeProjectId).toBe('p1');

      await act(async () => {
        await result.current.deleteProject('p1');
      });

      expect(result.current.activeProjectId).toBe('p2');
    });

    it('should clear activeProjectId when deleting last project', async () => {
      const project = createTestProject('p1', 'Only Project');
      const { result } = renderHook(() => useProjectDomain([project]));

      await waitForLoad(result);

      await act(async () => {
        await result.current.deleteProject('p1');
      });

      expect(result.current.projects).toHaveLength(0);
      expect(result.current.activeProjectId).toBe('');
    });

    it('should delete project on server when authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProject = createTestProject('uuid-aaaa-bbbb-cccc', 'Server');
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      const { result } = renderHook(() => useProjectDomain([serverProject]));

      await waitForLoad(result);

      await act(async () => {
        await result.current.deleteProject('uuid-aaaa-bbbb-cccc');
      });

      expect(mockApiProvider.deleteProjectAsync).toHaveBeenCalledWith('uuid-aaaa-bbbb-cccc');
    });

    it('should handle server deletion error gracefully', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const proj1 = createTestProject('uuid-aaaa-bbbb-cccc', 'Server');
      const proj2 = createTestProject('uuid-dddd-eeee-ffff', 'Other');
      mockApiProvider.loadProjectsAsync.mockResolvedValue([proj1, proj2]);
      mockApiProvider.deleteProjectAsync.mockRejectedValue(new Error('Server delete error'));
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      const { result } = renderHook(() => useProjectDomain([proj1, proj2]));

      await waitForLoad(result);

      await act(async () => {
        await result.current.deleteProject('uuid-aaaa-bbbb-cccc');
      });

      expect(result.current.saveError).toBe(
        'Не удалось удалить проект на сервере. Проект удалён локально.'
      );
    });

    it('should set isSyncing during deletion', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      expect(result.current.isSyncing).toBe(false);

      await act(async () => {
        await result.current.deleteProject('p2');
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('updateProjects', () => {
    it('should update projects list and schedule save', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      const newProjects = [createTestProject('p1', 'Updated')];

      act(() => {
        result.current.updateProjects(newProjects);
      });

      expect(result.current.projects).toEqual(newProjects);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
    });
  });

  describe('updateActiveProject', () => {
    it('should update only the active project in projects list', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjectDomain(projects));

      await waitForLoad(result);

      const updatedProject = { ...projects[0], name: 'Updated Project 1' };

      act(() => {
        result.current.updateActiveProject(updatedProject);
      });

      expect(result.current.projects[0].name).toBe('Updated Project 1');
      expect(result.current.projects[1].name).toBe('Project 2');
    });

    it('should handle multiple rapid updates', async () => {
      const project = createTestProject('p1', 'Project 1');
      const { result } = renderHook(() => useProjectDomain([project]));

      await waitForLoad(result);

      act(() => {
        result.current.updateActiveProject({ ...project, name: 'Update 1' });
        result.current.updateActiveProject({ ...project, name: 'Update 2' });
        result.current.updateActiveProject({ ...project, name: 'Update 3' });
      });

      expect(result.current.projects[0].name).toBe('Update 3');
    });
  });

  describe('scheduleSave', () => {
    it('should debounce saves', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      mockStorageManager.saveProjects.mockClear();

      act(() => {
        result.current.scheduleSave([createTestProject('p1', 'A')]);
        result.current.scheduleSave([createTestProject('p2', 'B')]);
        result.current.scheduleSave([createTestProject('p3', 'C')]);
      });

      expect(mockStorageManager.saveProjects).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
    });
  });

  describe('scheduleTotalsSave', () => {
    it('should not save totals when not authenticated', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      const project = createTestProject('p1', 'Test');
      act(() => {
        result.current.scheduleTotalsSave(project);
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(saveTotals).not.toHaveBeenCalled();
    });

    it('should save totals when authenticated and project has server id', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProject = createTestProject('p1', 'Server');
      serverProject.id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue(serverProject.id);

      const { result } = renderHook(() => useProjectDomain([serverProject]));

      await waitForLoad(result);

      (saveTotals as ReturnType<typeof vi.fn>).mockClear();

      act(() => {
        result.current.scheduleTotalsSave(serverProject);
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });

    it('should handle totals save error', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const serverProject = createTestProject('p1', 'Server');
      serverProject.id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue(serverProject.id);

      const { result } = renderHook(() => useProjectDomain([serverProject]));

      await waitForLoad(result);

      (saveTotals as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Totals save error'));

      act(() => {
        result.current.scheduleTotalsSave(serverProject);
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(result.current.totalsSaveError).toBe('Totals save error');
      });
    });
  });

  describe('setProjects', () => {
    it('should allow direct state update', async () => {
      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      const newProjects = [createTestProject('p1', 'Direct Update')];

      act(() => {
        result.current.setProjects(newProjects);
      });

      expect(result.current.projects).toEqual(newProjects);
    });
  });

  describe('beforeunload', () => {
    it('should register beforeunload handler', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      addSpy.mockRestore();
    });
  });

  describe('room sync errors', () => {
    it('should check room sync errors when authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      });

      const errorMap = new Map();
      errorMap.set('proj1:room1', { error: new Error('Sync failed'), timestamp: Date.now() });
      mockApiProvider.getRoomSyncErrors.mockReturnValue(errorMap);
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);
      mockStorageManager.loadActiveProject.mockReturnValue(null);

      const { result } = renderHook(() => useProjectDomain([]));

      await waitForLoad(result);

      await waitFor(() => {
        expect(result.current.roomSyncError).toContain('Ошибка синхронизации комнат');
      });
    });
  });
});
