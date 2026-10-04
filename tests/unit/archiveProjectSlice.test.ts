/**
 * Тесты slice-экшенов архива (T3, TASK-BATCH-001):
 * fetchArchivedProjects / restoreProject / permanentDeleteProject (src/store/createArchiveSlice.ts,
 * вынесено из createProjectSlice в TASK-BATCH-014).
 *
 * Мокаются: api/projects, storage, apiStorageProvider, logger, migration, projectObjects,
 * saveQueue. idMapper — РЕАЛЬНЫЙ (localStorage мокается в tests/setup.ts): заодно
 * проверяется очистка маппингов idMapper.clearProject при hard-delete.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { idMapper } from '../../src/utils/idMapper';
import * as projectsApi from '../../src/api/projects';
import type { ProjectData, RoomData } from '../../src/types';

vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn(),
    loadProjectsAsync: vi.fn(),
    loadActiveProject: vi.fn(),
    loadActiveProjectAsync: vi.fn(),
    saveProjects: vi.fn(),
    saveProject: vi.fn(),
    saveActiveProject: vi.fn(),
  },
}));

vi.mock('../../src/api/storage', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      loadProjectsAsync: vi.fn(),
      saveProjectsAsync: vi.fn(),
      saveProjectAsync: vi.fn(),
      createProjectAsync: vi.fn(),
      deleteProjectAsync: vi.fn(),
      markProjectDeleted: vi.fn(),
    })),
    resetInstance: vi.fn(),
  },
}));

vi.mock('../../src/api/totals', () => ({
  saveTotals: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logStart: vi.fn(() => Date.now()),
  logEnd: vi.fn(),
  logStateChange: vi.fn(),
  logWarning: vi.fn(),
  logDebug: vi.fn(),
}));

vi.mock('../../src/utils/migration', () => ({
  runMigrations: vi.fn(),
  needsMigration: vi.fn(() => false),
}));

vi.mock('../../src/utils/saveQueue', () => ({
  saveQueue: {
    enqueue: vi.fn((task: () => Promise<void>) => task()),
    cancelPending: vi.fn(),
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
  },
}));

vi.mock('../../src/utils/projectObjects', () => ({
  getAllRooms: vi.fn(() => []),
  migrateProjectToObjects: vi.fn((p: ProjectData) => ({ ...p, objects: p.objects || [] })),
  getObjectFromProject: vi.fn(
    (project: ProjectData, id: string) => project.objects?.find(o => o.id === id) || null,
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

vi.mock('../../src/api/projects', () => ({
  getArchivedProjects: vi.fn(),
  restoreProject: vi.fn(),
  permanentDeleteProject: vi.fn(),
  apiToClientProject: vi.fn(
    (p: { id: string; name: string; objectsCount?: number; roomsCount?: number }) => ({
      id: p.id,
      name: p.name,
      objects: [] as ProjectData['objects'],
      ...(p.objectsCount !== undefined
        ? { objectsCount: p.objectsCount, roomsCount: p.roomsCount }
        : {}),
    }),
  ),
  ProjectsApiError: class ProjectsApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = 'ProjectsApiError';
    }
  },
}));

const mockedApi = vi.mocked(projectsApi, true);

function makeRoom(id: string): RoomData {
  return {
    id,
    name: `Room ${id}`,
    geometryMode: 'simple',
    length: 3,
    width: 4,
    height: 2.7,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [],
    doors: [],
    works: [],
  };
}

function makeProject(id: string, overrides: Partial<ProjectData> = {}): ProjectData {
  return { id, name: `Project ${id}`, objects: [], ...overrides };
}

describe('project slice: archive actions (T3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetStore();
    idMapper.clear();
    localStorage.clear();
    useProjectStore.setState({ isAuthenticated: false, deletingIds: [] });
  });

  afterEach(() => {
    resetStore();
    idMapper.clear();
    vi.useRealTimers();
  });

  describe('fetchArchivedProjects', () => {
    it('авторизованному возвращает список с агрегатами objectsCount/roomsCount', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      mockedApi.getArchivedProjects.mockResolvedValueOnce({
        status: 'success',
        data: [{ id: 'a1', name: 'Архив', objectsCount: 2, roomsCount: 5 }],
      });

      const result = await useProjectStore.getState().fetchArchivedProjects();

      expect(mockedApi.getArchivedProjects).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { id: 'a1', name: 'Архив', objects: [], objectsCount: 2, roomsCount: 5 },
      ]);
    });

    it('гостю возвращает пустой список и не дёргает api', async () => {
      useProjectStore.setState({ isAuthenticated: false });

      const result = await useProjectStore.getState().fetchArchivedProjects();

      expect(result).toEqual([]);
      expect(mockedApi.getArchivedProjects).not.toHaveBeenCalled();
    });
  });

  describe('restoreProject', () => {
    it('добавляет восстановленный проект в state.projects', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      const other = makeProject('p-other');
      useProjectStore.setState({ projects: [other] });
      mockedApi.restoreProject.mockResolvedValueOnce({
        status: 'success',
        data: { id: 'a1', name: 'Restored' },
      });

      const restored = await useProjectStore.getState().restoreProject('a1');

      expect(mockedApi.restoreProject).toHaveBeenCalledWith('a1');
      expect(restored).toMatchObject({ id: 'a1', name: 'Restored' });
      expect(useProjectStore.getState().projects.map(p => p.id)).toEqual(['p-other', 'a1']);
    });

    it('заменяет существующий проект с тем же id', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      const stale = makeProject('a1', { name: 'Old' });
      useProjectStore.setState({ projects: [stale] });
      mockedApi.restoreProject.mockResolvedValueOnce({
        status: 'success',
        data: { id: 'a1', name: 'Restored' },
      });

      await useProjectStore.getState().restoreProject('a1');

      const projects = useProjectStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Restored');
    });

    it('гостю бросает ошибку и не дёргает api', async () => {
      useProjectStore.setState({ isAuthenticated: false, projects: [makeProject('p1')] });

      await expect(useProjectStore.getState().restoreProject('p1')).rejects.toThrow(
        'Гостевой режим',
      );
      expect(mockedApi.restoreProject).not.toHaveBeenCalled();
      expect(useProjectStore.getState().projects.map(p => p.id)).toEqual(['p1']);
    });

    it('при 400 (не в архиве) ошибка доходит до UI, состояние не тронуто', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      const stale = makeProject('a1', { name: 'Old' });
      useProjectStore.setState({ projects: [stale] });
      mockedApi.restoreProject.mockRejectedValueOnce(
        new projectsApi.ProjectsApiError('Project is not archived', 400),
      );

      await expect(useProjectStore.getState().restoreProject('a1')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(useProjectStore.getState().projects).toEqual([stale]);
    });
  });

  describe('permanentDeleteProject', () => {
    it('вызывает api по serverId, чистит state и маппинги проекта и потомков', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      const withTree = makeProject('p1', {
        objects: [{ id: 'o1', projectId: 'p1', name: 'O1', rooms: [makeRoom('r1')] }],
      });
      const survivor = makeProject('p2');
      useProjectStore.setState({ projects: [withTree, survivor] });

      idMapper.addMapping('p1', 'srv-p1');
      idMapper.addMapping('o1', 'srv-o1');
      idMapper.addMapping('r1', 'srv-r1');
      idMapper.addMapping('p2', 'srv-p2');

      mockedApi.permanentDeleteProject.mockResolvedValueOnce({
        status: 'success',
        data: { deleted: { objects: 1, rooms: 1 } },
      });

      const result = await useProjectStore.getState().permanentDeleteProject('p1');

      expect(mockedApi.permanentDeleteProject).toHaveBeenCalledTimes(1);
      expect(mockedApi.permanentDeleteProject).toHaveBeenCalledWith('srv-p1');
      expect(result).toEqual({ objects: 1, rooms: 1 });

      const state = useProjectStore.getState();
      expect(state.projects.map(p => p.id)).toEqual(['p2']);
      expect(state.deletingIds).toEqual([]);

      // маппинги проекта и потомков вычищены, чужие не тронуты
      expect(idMapper.getServerId('p1')).toBeNull();
      expect(idMapper.getServerId('o1')).toBeNull();
      expect(idMapper.getServerId('r1')).toBeNull();
      expect(idMapper.getServerId('p2')).toBe('srv-p2');
    });

    it('при 409 (проект активен) ошибка доходит до UI, состояние не тронуто', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      const archived = makeProject('p1');
      useProjectStore.setState({ projects: [archived] });
      idMapper.addMapping('p1', 'srv-p1');
      mockedApi.permanentDeleteProject.mockRejectedValueOnce(
        new projectsApi.ProjectsApiError('Archive the project first', 409),
      );

      await expect(useProjectStore.getState().permanentDeleteProject('p1')).rejects.toMatchObject({
        statusCode: 409,
      });

      const state = useProjectStore.getState();
      expect(state.projects).toEqual([archived]);
      expect(state.deletingIds).toEqual([]);
      expect(idMapper.getServerId('p1')).toBe('srv-p1');
    });

    it('гейтит повторный вызов: api вызывается один раз, оба await получают результат', async () => {
      useProjectStore.setState({ isAuthenticated: true });
      useProjectStore.setState({ projects: [makeProject('p1')] });

      let resolveApi!: (value: {
        status: string;
        data: { deleted: { objects: number; rooms: number } };
      }) => void;
      mockedApi.permanentDeleteProject.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveApi = resolve;
          }),
      );

      const store = useProjectStore.getState();
      const first = store.permanentDeleteProject('p1');
      const second = store.permanentDeleteProject('p1');

      expect(mockedApi.permanentDeleteProject).toHaveBeenCalledTimes(1);
      expect(useProjectStore.getState().deletingIds).toEqual(['p1']);

      resolveApi({ status: 'success', data: { deleted: { objects: 0, rooms: 0 } } });
      await expect(first).resolves.toEqual({ objects: 0, rooms: 0 });
      await expect(second).resolves.toEqual({ objects: 0, rooms: 0 });

      expect(useProjectStore.getState().deletingIds).toEqual([]);
    });

    it('гостю бросает ошибку и не дёргает api', async () => {
      useProjectStore.setState({ isAuthenticated: false });

      await expect(useProjectStore.getState().permanentDeleteProject('p1')).rejects.toThrow(
        'Гостевой режим',
      );
      expect(mockedApi.permanentDeleteProject).not.toHaveBeenCalled();
    });
  });

  describe('idMapper.clearProject', () => {
    it('удаляет маппинги проекта и переданных потомков, возвращает их число', () => {
      idMapper.addMapping('p1', 'srv-p1');
      idMapper.addMapping('o1', 'srv-o1');
      idMapper.addMapping('r1', 'srv-r1');
      idMapper.addMapping('other', 'srv-other');

      const removed = idMapper.clearProject('p1', ['o1', 'r1']);

      expect(removed).toBe(3);
      expect(idMapper.getServerId('p1')).toBeNull();
      expect(idMapper.getServerId('o1')).toBeNull();
      expect(idMapper.getServerId('r1')).toBeNull();
      expect(idMapper.getServerId('other')).toBe('srv-other');
    });

    it('для несуществующих id возвращает 0 и не падает', () => {
      expect(idMapper.clearProject('ghost', ['ghost-obj'])).toBe(0);
    });
  });
});
