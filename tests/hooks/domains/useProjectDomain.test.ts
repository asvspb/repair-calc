import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, resetStore } from '../../../src/store/useProjectStore';
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
  getObjectFromProject: vi.fn((project: ProjectData, id: string) =>
    project.objects?.find((o: { id: string }) => o.id === id) || null
  ),
  updateRoomInProject: vi.fn(),
  addRoomToProject: vi.fn(),
  deleteRoomFromProject: vi.fn(),
  reorderRoomsInProject: vi.fn(),
  createNewObject: vi.fn(),
  addObjectToProject: vi.fn(),
  copyObjectInProject: vi.fn(),
  updateObjectInProject: vi.fn(),
  deleteObjectFromProject: vi.fn(),
  getFirstObject: vi.fn(),
}));

import { StorageManager } from '../../../src/utils/storage';
import { ApiStorageProvider } from '../../../src/api/storage';
import { saveTotals } from '../../../src/api/totals';
import { needsMigration, runMigrations } from '../../../src/utils/migration';
import { saveQueue } from '../../../src/utils/saveQueue';
import { migrateProjectToObjects } from '../../../src/utils/projectObjects';

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

describe('useProjectDomain (Zustand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetStore();

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
      await useProjectStore.getState().initialize([project], false);

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].name).toBe('Test Project');
      expect(state.activeProjectId).toBe('p1');
    });

    it('should set empty activeProjectId when no projects', async () => {
      await useProjectStore.getState().initialize([], false);

      const state = useProjectStore.getState();
      expect(state.activeProjectId).toBe('');
      expect(state.activeProject).toBeNull();
    });

    it('should compute activeProject based on activeProjectId', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      const state = useProjectStore.getState();
      expect(state.activeProject).toBeDefined();
      expect(state.activeProject!.id).toBe('p1');
    });

    it('should set isLoading to false after load', async () => {
      await useProjectStore.getState().initialize([], false);
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('should load projects from localStorage when not authenticated', async () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      mockStorageManager.loadProjects.mockReturnValue(savedProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('saved-1');

      await useProjectStore.getState().initialize([], false);

      expect(mockStorageManager.loadProjects).toHaveBeenCalled();
      expect(useProjectStore.getState().projects[0].name).toBe('Saved Project');
    });

    it('should load projects from server when authenticated', async () => {
      const serverProjects = [createTestProject('server-1', 'Server Project')];
      mockApiProvider.loadProjectsAsync.mockResolvedValue(serverProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('server-1');

      await useProjectStore.getState().initialize([], true);

      expect(mockApiProvider.loadProjectsAsync).toHaveBeenCalled();
      expect(useProjectStore.getState().projects).toHaveLength(1);
    });

    it('should handle error during load', async () => {
      mockStorageManager.loadProjects.mockImplementation(() => {
        throw new Error('Load error');
      });

      await useProjectStore.getState().initialize([], false);

      const state = useProjectStore.getState();
      expect(state.error).toEqual({
        type: 'unknown',
        message: 'Ошибка загрузки данных',
      });
      expect(state.isLoading).toBe(false);
    });

    it('should use first project as active when saved active not found', async () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      mockStorageManager.loadProjects.mockReturnValue(savedProjects);
      mockStorageManager.loadActiveProject.mockReturnValue('non-existent');

      await useProjectStore.getState().initialize([], false);

      expect(useProjectStore.getState().activeProjectId).toBe('saved-1');
    });

    it('should save initial projects to localStorage on first run', async () => {
      const initialProjects = [createTestProject('p1', 'First Project')];
      mockStorageManager.loadProjects.mockReturnValue(null);
      mockStorageManager.loadActiveProject.mockReturnValue(null);

      await useProjectStore.getState().initialize(initialProjects, false);

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
      expect(mockStorageManager.saveActiveProject).toHaveBeenCalledWith('p1');
    });

    it('should run migration when needed and authenticated', async () => {
      (needsMigration as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runMigrations as ReturnType<typeof vi.fn>).mockResolvedValue({
        migrated: 1,
        duplicatesRemoved: 1,
      });
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      await useProjectStore.getState().initialize([], true);

      expect(runMigrations).toHaveBeenCalled();
    });

    it('should handle migration error gracefully', async () => {
      (needsMigration as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runMigrations as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Migration failed'));
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      await useProjectStore.getState().initialize([], true);

      expect(useProjectStore.getState().error).toBeNull();
    });

    it('should fallback to localStorage when server has no projects', async () => {
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);
      const localProjects = [createTestProject('local-1', 'Local Project')];
      mockStorageManager.loadProjects.mockReturnValue(localProjects);

      await useProjectStore.getState().initialize([], true);

      expect(useProjectStore.getState().projects[0].name).toBe('Local Project');
    });
  });

  describe('setActiveProjectId', () => {
    it('should update active project id and save', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      useProjectStore.getState().setActiveProjectId('p2');

      const state = useProjectStore.getState();
      expect(state.activeProjectId).toBe('p2');
      expect(mockStorageManager.saveActiveProject).toHaveBeenCalledWith('p2');
    });

    it('should update activeProject when id changes', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      useProjectStore.getState().setActiveProjectId('p2');

      const state = useProjectStore.getState();
      expect(state.activeProject!.id).toBe('p2');
      expect(state.activeProject!.name).toBe('Project 2');
    });
  });

  describe('createProject', () => {
    it('should create local project when not authenticated', async () => {
      await useProjectStore.getState().initialize([], false);

      const newProject = await useProjectStore.getState().createProject({
        name: 'New Project',
        city: 'Moscow',
      });

      expect(newProject).toBeDefined();
      expect(newProject.name).toBe('New Project');
      expect(newProject.city).toBe('Moscow');
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().activeProjectId).toBe(newProject.id);
    });

    it('should create project with objects when provided', async () => {
      await useProjectStore.getState().initialize([], false);

      const newProject = await useProjectStore.getState().createProject({
        name: 'New Project',
        objects: ['Объект 1', 'Объект 2'],
      });

      expect(newProject.objects).toHaveLength(2);
      expect(newProject.objects![0].name).toBe('Объект 1');
      expect(newProject.objects![1].name).toBe('Объект 2');
    });

    it('should create project with default object when no objects specified', async () => {
      await useProjectStore.getState().initialize([], false);

      const newProject = await useProjectStore.getState().createProject({ name: 'Test' });

      expect(newProject.objects).toHaveLength(1);
      expect(newProject.objects![0].name).toBe('Основной объект');
    });

    it('should create project on server when authenticated', async () => {
      const serverProject = createTestProject('uuid-aaaa-bbbb-cccc', 'Server Project');
      mockApiProvider.createProjectAsync.mockResolvedValue(serverProject);
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      await useProjectStore.getState().initialize([], true);

      await useProjectStore.getState().createProject({
        name: 'Server Project',
        city: 'Moscow',
      });

      expect(mockApiProvider.createProjectAsync).toHaveBeenCalledWith({
        name: 'Server Project',
        city: 'Moscow',
      });
    });

    it('should create server project with objects', async () => {
      const serverProject = createTestProject('uuid-aaaa', 'Server');
      serverProject.id = 'uuid-aaaa';
      mockApiProvider.createProjectAsync.mockResolvedValue(serverProject);
      mockApiProvider.saveProjectsAsync.mockResolvedValue([serverProject]);
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa');

      await useProjectStore.getState().initialize([], true);

      await useProjectStore.getState().createProject({
        name: 'Server',
        objects: ['Flat 1'],
      });

      expect(mockApiProvider.saveProjectsAsync).toHaveBeenCalled();
    });

    it('should set isSyncing during creation and reset after', async () => {
      await useProjectStore.getState().initialize([], false);

      expect(useProjectStore.getState().isSyncing).toBe(false);

      await useProjectStore.getState().createProject({ name: 'Test' });

      expect(useProjectStore.getState().isSyncing).toBe(false);
    });

    it('should throw and reset isSyncing on error', async () => {
      mockApiProvider.createProjectAsync.mockRejectedValue(new Error('Server error'));
      mockApiProvider.loadProjectsAsync.mockResolvedValue([]);

      await useProjectStore.getState().initialize([], true);

      await expect(
        useProjectStore.getState().createProject({ name: 'Fail' })
      ).rejects.toThrow('Server error');

      expect(useProjectStore.getState().isSyncing).toBe(false);
    });
  });

  describe('deleteProject', () => {
    it('should remove project from list', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      await useProjectStore.getState().deleteProject('p2');

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('p1');
    });

    it('should switch active project when deleting active one', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      expect(useProjectStore.getState().activeProjectId).toBe('p1');

      await useProjectStore.getState().deleteProject('p1');

      expect(useProjectStore.getState().activeProjectId).toBe('p2');
    });

    it('should clear activeProjectId when deleting last project', async () => {
      const project = createTestProject('p1', 'Only Project');
      await useProjectStore.getState().initialize([project], false);

      await useProjectStore.getState().deleteProject('p1');

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.activeProjectId).toBe('');
    });

    it('should delete project on server when authenticated', async () => {
      const serverProject = createTestProject('uuid-aaaa-bbbb-cccc', 'Server');
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      await useProjectStore.getState().initialize([serverProject], true);

      await useProjectStore.getState().deleteProject('uuid-aaaa-bbbb-cccc');

      expect(mockApiProvider.deleteProjectAsync).toHaveBeenCalledWith('uuid-aaaa-bbbb-cccc');
    });

    it('should handle server deletion error gracefully', async () => {
      const proj1 = createTestProject('uuid-aaaa-bbbb-cccc', 'Server');
      const proj2 = createTestProject('uuid-dddd-eeee-ffff', 'Other');
      mockApiProvider.loadProjectsAsync.mockResolvedValue([proj1, proj2]);
      mockApiProvider.deleteProjectAsync.mockRejectedValue(new Error('Server delete error'));
      mockStorageManager.loadActiveProject.mockReturnValue('uuid-aaaa-bbbb-cccc');

      await useProjectStore.getState().initialize([proj1, proj2], true);

      await useProjectStore.getState().deleteProject('uuid-aaaa-bbbb-cccc');

      expect(useProjectStore.getState().saveError).toBe(
        'Не удалось удалить проект на сервере. Проект удалён локально.'
      );
    });

    it('should set isSyncing during deletion', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      expect(useProjectStore.getState().isSyncing).toBe(false);

      await useProjectStore.getState().deleteProject('p2');

      expect(useProjectStore.getState().isSyncing).toBe(false);
    });
  });

  describe('updateProjects', () => {
    it('should update projects list and schedule save', async () => {
      await useProjectStore.getState().initialize([], false);

      const newProjects = [createTestProject('p1', 'Updated')];
      useProjectStore.getState().updateProjects(newProjects);

      expect(useProjectStore.getState().projects).toEqual(newProjects);

      vi.advanceTimersByTime(3000);

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
    });
  });

  describe('updateActiveProject', () => {
    it('should update only the active project in projects list', async () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      await useProjectStore.getState().initialize(projects, false);

      const updatedProject = { ...projects[0], name: 'Updated Project 1' };
      useProjectStore.getState().updateActiveProject(updatedProject);

      const state = useProjectStore.getState();
      expect(state.projects[0].name).toBe('Updated Project 1');
      expect(state.projects[1].name).toBe('Project 2');
    });

    it('should handle multiple rapid updates', async () => {
      const project = createTestProject('p1', 'Project 1');
      await useProjectStore.getState().initialize([project], false);

      useProjectStore.getState().updateActiveProject({ ...project, name: 'Update 1' });
      useProjectStore.getState().updateActiveProject({ ...project, name: 'Update 2' });
      useProjectStore.getState().updateActiveProject({ ...project, name: 'Update 3' });

      expect(useProjectStore.getState().projects[0].name).toBe('Update 3');
    });
  });

  describe('scheduleSave', () => {
    it('should debounce saves', async () => {
      await useProjectStore.getState().initialize([], false);

      mockStorageManager.saveProjects.mockClear();

      useProjectStore.getState().scheduleSave([createTestProject('p1', 'A')]);
      useProjectStore.getState().scheduleSave([createTestProject('p2', 'B')]);
      useProjectStore.getState().scheduleSave([createTestProject('p3', 'C')]);

      expect(mockStorageManager.saveProjects).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);

      expect(mockStorageManager.saveProjects).toHaveBeenCalled();
    });
  });

  describe('scheduleTotalsSave', () => {
    it('should not save totals when not authenticated', async () => {
      await useProjectStore.getState().initialize([], false);

      const project = createTestProject('p1', 'Test');
      useProjectStore.getState().scheduleTotalsSave(project);

      vi.advanceTimersByTime(3000);

      expect(saveTotals).not.toHaveBeenCalled();
    });

    it('should save totals when authenticated and project has server id', async () => {
      const serverProject = createTestProject('p1', 'Server');
      serverProject.id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue(serverProject.id);

      await useProjectStore.getState().initialize([serverProject], true);

      (saveTotals as ReturnType<typeof vi.fn>).mockClear();

      useProjectStore.getState().scheduleTotalsSave(serverProject);

      vi.advanceTimersByTime(3000);

      await vi.waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });

    it('should handle totals save error', async () => {
      const serverProject = createTestProject('p1', 'Server');
      serverProject.id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockApiProvider.loadProjectsAsync.mockResolvedValue([serverProject]);
      mockStorageManager.loadActiveProject.mockReturnValue(serverProject.id);

      await useProjectStore.getState().initialize([serverProject], true);

      (saveTotals as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Totals save error'));

      useProjectStore.getState().scheduleTotalsSave(serverProject);

      vi.advanceTimersByTime(3000);

      await vi.waitFor(() => {
        expect(useProjectStore.getState().totalsSaveError).toBe('Totals save error');
      });
    });
  });

  describe('setIsAuthenticated', () => {
    it('should update isAuthenticated state', async () => {
      await useProjectStore.getState().initialize([], false);
      expect(useProjectStore.getState().isAuthenticated).toBe(false);

      useProjectStore.getState().setIsAuthenticated(true);
      expect(useProjectStore.getState().isAuthenticated).toBe(true);
    });
  });
});
