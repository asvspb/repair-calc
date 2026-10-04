/**
 * Тесты dirty-модели SYNC-V2 batch (а) (спека devAI/spec/SPEC-SYNC-V2.md §2.1, §5(а)):
 * - мутации project/object/room ставят dirty + updatedAt;
 * - дедуп: повторная мутация заменяет запись, dirtyCount не растёт;
 * - персист в Dexie syncState (markDirty → putSyncStateEntry);
 * - восстановление карты из Dexie (restoreDirtyState);
 * - гость: ноль сетевых вызовов (ApiStorageProvider не используется).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { clearSaveTimers } from '../../src/store/createSyncSlice';
import type { ProjectData } from '../../src/types';

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

const providerMocks = {
  loadProjectsAsync: vi.fn(),
  saveProjectsAsync: vi.fn(),
  saveProjectAsync: vi.fn(),
  createProjectAsync: vi.fn(),
  deleteProjectAsync: vi.fn(),
  markProjectDeleted: vi.fn(),
};

vi.mock('../../src/api/storage', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => providerMocks),
    resetInstance: vi.fn(),
  },
}));

vi.mock('../../src/api/storage/dexieDb', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/api/storage/dexieDb')>();
  return {
    ...actual,
    putSyncStateEntry: vi.fn().mockResolvedValue(undefined),
    getAllSyncStateEntries: vi.fn().mockResolvedValue([]),
    deleteSyncStateEntry: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/utils/saveQueue', () => ({
  saveQueue: {
    enqueue: vi.fn(),
    cancelPending: vi.fn(),
    hasPendingData: false,
    getPendingData: vi.fn(),
  },
}));

import {
  putSyncStateEntry,
  getAllSyncStateEntries,
  syncStateKey,
} from '../../src/api/storage/dexieDb';

function makeProject(id: string): ProjectData {
  return {
    id,
    name: `Project ${id}`,
    objects: [
      {
        id: `${id}-obj-1`,
        projectId: id,
        name: 'Object 1',
        rooms: [
          {
            id: `${id}-room-1`,
            name: 'Room 1',
            geometryMode: 'simple',
            length: 5,
            width: 4,
            height: 2.7,
            segments: [],
            obstacles: [],
            wallSections: [],
            subSections: [],
            windows: [],
            doors: [],
            works: [],
          },
        ],
      },
    ],
  };
}

function seedStore(projects: ProjectData[]) {
  resetStore();
  useProjectStore.setState({
    projects,
    activeProjectId: projects[0]?.id ?? '',
    activeProject: projects[0] ?? null,
    activeObjectId: null,
    activeObject: null,
    isAuthenticated: false,
    isLoading: false,
    dirty: { project: {}, object: {}, room: {} },
    dirtyCount: 0,
  });
}

describe('SYNC-V2 dirty-флаги (batch а)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(putSyncStateEntry).mockResolvedValue(undefined);
    vi.mocked(getAllSyncStateEntries).mockResolvedValue([]);
  });

  afterEach(() => {
    clearSaveTimers();
    vi.useRealTimers();
  });

  it('updateActiveProject ставит dirty на проект + updatedAt на сущность', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().updateActiveProject({ ...project, name: 'Переименован' });

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(Object.keys(dirty.project)).toEqual(['p-1']);
    expect(dirty.project['p-1'].op).toBe('upsert');
    expect(dirtyCount).toBe(1);

    const updated = useProjectStore.getState().projects.find(p => p.id === 'p-1');
    expect(updated?.name).toBe('Переименован');
    expect(updated?.updatedAt).toBe(dirty.project['p-1'].updatedAt);
    expect(new Date(dirty.project['p-1'].updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('markDirty персистит запись в Dexie syncState с ключом kind:id', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().updateActiveProject({ ...project, name: 'x' });

    expect(putSyncStateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        key: syncStateKey('project', 'p-1'),
        entityKind: 'project',
        entityId: 'p-1',
        op: 'upsert',
      }),
    );
  });

  it('дедуп: повторная мутация той же сущности не увеличивает dirtyCount', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().updateActiveProject({ ...project, name: 'раз' });
    useProjectStore.getState().updateActiveProject({ ...project, name: 'два' });

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(dirtyCount).toBe(1);
    expect(Object.keys(dirty.project)).toEqual(['p-1']);
    expect(dirty.project['p-1'].updatedAt).toBe(useProjectStore.getState().projects[0].updatedAt);
  });

  it('updateRoom ставит dirty на комнату + updatedAt на сущность', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    const room = project.objects[0].rooms[0];
    useProjectStore.getState().updateRoom({ ...room, name: 'Гостиная' });

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(Object.keys(dirty.room)).toEqual(['p-1-room-1']);
    expect(dirtyCount).toBe(1);
    const updatedRoom = useProjectStore
      .getState()
      .projects[0].objects[0].rooms.find(r => r.id === 'p-1-room-1');
    expect(updatedRoom?.name).toBe('Гостиная');
    expect(updatedRoom?.updatedAt).toBe(dirty.room['p-1-room-1'].updatedAt);
  });

  it('addRoom ставит dirty (upsert) на новую комнату', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().addRoom({
      id: 'p-1-room-2',
      name: 'Спальня',
      geometryMode: 'simple',
      length: 3,
      width: 3,
      height: 2.7,
      segments: [],
      obstacles: [],
      wallSections: [],
      subSections: [],
      windows: [],
      doors: [],
      works: [],
    });

    const { dirty } = useProjectStore.getState();
    expect(dirty.room['p-1-room-2']?.op).toBe('upsert');
  });

  it('updateObject ставит dirty на объект + updatedAt на сущность', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().updateObject('p-1-obj-1', { name: 'Квартира' });

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(Object.keys(dirty.object)).toEqual(['p-1-obj-1']);
    // объект + содержащий проект (updateObject идёт через updateActiveProject)
    expect(dirtyCount).toBe(2);
    expect(Object.keys(dirty.project)).toEqual(['p-1']);
    const updatedObject = useProjectStore
      .getState()
      .projects[0].objects.find(o => o.id === 'p-1-obj-1');
    expect(updatedObject?.name).toBe('Квартира');
    expect(updatedObject?.updatedAt).toBe(dirty.object['p-1-obj-1'].updatedAt);
  });

  it('updateProjects (bulk) ставит dirty только на изменившиеся проекты', () => {
    const p1 = makeProject('p-1');
    const p2 = makeProject('p-2');
    seedStore([p1, p2]);

    useProjectStore.getState().updateProjects([{ ...p1, name: 'Изменён' }, p2]);

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(Object.keys(dirty.project)).toEqual(['p-1']);
    expect(dirtyCount).toBe(1);
  });

  it('restoreDirtyState восстанавливает карту из Dexie syncState', async () => {
    seedStore([]);
    vi.mocked(getAllSyncStateEntries).mockResolvedValue([
      {
        key: 'project:p-9',
        entityKind: 'project',
        entityId: 'p-9',
        updatedAt: '2026-10-04T10:00:00.000Z',
        op: 'upsert',
      },
      {
        key: 'room:r-9',
        entityKind: 'room',
        entityId: 'r-9',
        updatedAt: '2026-10-04T10:01:00.000Z',
        op: 'upsert',
      },
    ]);

    await useProjectStore.getState().restoreDirtyState();

    const { dirty, dirtyCount } = useProjectStore.getState();
    expect(dirty.project['p-9']?.updatedAt).toBe('2026-10-04T10:00:00.000Z');
    expect(dirty.room['r-9']?.updatedAt).toBe('2026-10-04T10:01:00.000Z');
    expect(dirtyCount).toBe(2);
  });

  it('гость: мутации не инициируют сетевых вызовов', () => {
    const project = makeProject('p-1');
    seedStore([project]);

    useProjectStore.getState().updateActiveProject({ ...project, name: 'guest edit' });
    useProjectStore.getState().updateRoom({ ...project.objects[0].rooms[0], name: 'x' });
    useProjectStore.getState().updateObject('p-1-obj-1', { name: 'y' });
    useProjectStore.getState().markDirty('project', 'p-1', '2026-10-04T10:00:00.000Z');

    expect(providerMocks.saveProjectsAsync).not.toHaveBeenCalled();
    expect(providerMocks.saveProjectAsync).not.toHaveBeenCalled();
    expect(providerMocks.loadProjectsAsync).not.toHaveBeenCalled();
  });
});
