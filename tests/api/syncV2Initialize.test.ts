/**
 * Тесты развилки инициализации SYNC-V2 (batch г; спека devAI/spec/SPEC-SYNC-V2.md §4, §5(г)):
 * - VITE_SYNC_V2=true: первый запуск — полный pull (без since) + putLastSyncAt (серверный
 *   timestamp), legacy-провайдер не вызывается;
 * - инкрементальный pull: since из Dexie; LWW-слияние mergePull — сервер новее → dirty снят
 *   (acknowledgeFlushed с serverWins), клиент новее → локальная остаётся, dirty сохранена;
 * - ошибка pull → откат на локальную копию, lastSyncAt не двигается;
 * - без флага — legacy путь (ApiStorageProvider.loadProjectsAsync), syncPull не вызывается.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { initializeProjects } from '../../src/store/projectInitialize';
import type { ProjectData, RoomData } from '../../src/types';
import { syncPull, apiToClientProject } from '../../src/features/projects/api/projects';
import { getLastSyncAt, putLastSyncAt } from '../../src/api/storage/dexieDb';
import { ApiStorageProvider } from '../../src/api/storage';
import { StorageManager } from '../../src/utils/storage';

vi.mock('../../src/api/storage/dexieDb', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/api/storage/dexieDb')>();
  return {
    ...actual,
    getLastSyncAt: vi.fn().mockResolvedValue(null),
    putLastSyncAt: vi.fn().mockResolvedValue(undefined),
    putSyncStateEntry: vi.fn().mockResolvedValue(undefined),
    getAllSyncStateEntries: vi.fn().mockResolvedValue([]),
    deleteSyncStateEntry: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/features/projects/api/projects', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/features/projects/api/projects')>();
  return {
    ...actual,
    syncPull: vi.fn(),
    apiToClientProject: vi.fn(),
  };
});

vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
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

const mockedSyncPull = vi.mocked(syncPull);
const mockedApiToClient = vi.mocked(apiToClientProject);
const mockedGetLastSyncAt = vi.mocked(getLastSyncAt);
const mockedPutLastSyncAt = vi.mocked(putLastSyncAt);
const mockedLoadLocal = vi.mocked(StorageManager.loadProjectsAsync);

function uuid(n: number): string {
  return `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
}

function clientRoom(id: string, updatedAt?: string): RoomData {
  return {
    id,
    name: 'Room',
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
    updatedAt,
  } as RoomData;
}

function clientProject(id: string, updatedAt?: string, rooms: RoomData[] = []): ProjectData {
  return {
    id,
    name: `Project ${id}`,
    updatedAt,
    objects: [{ id: `${id}-obj`, projectId: id, name: 'Object', rooms, updatedAt }],
  } as ProjectData;
}

function serverProject(id: string, updatedAt: string, roomUpdatedAt?: string) {
  return {
    id,
    name: `Project ${id}`,
    updated_at: updatedAt,
    objects: [
      {
        id: `${id}-obj`,
        name: 'Object',
        updated_at: updatedAt,
        rooms: [{ id: `${id}-room`, name: 'Room', updated_at: roomUpdatedAt ?? updatedAt }],
      },
    ],
  };
}

/** Лёгкий apiToClientProject: mergePull оперирует id/updatedAt/objects/rooms */
function fakeToClient(api: {
  id: string;
  name: string;
  updated_at: string;
  objects: Array<{
    id: string;
    name: string;
    updated_at: string;
    rooms?: Array<{ id: string; name: string; updated_at: string }>;
  }>;
}): ProjectData {
  return {
    id: api.id,
    name: api.name,
    updatedAt: api.updated_at,
    objects: (api.objects ?? []).map(obj => ({
      id: obj.id,
      projectId: api.id,
      name: obj.name,
      updatedAt: obj.updated_at,
      rooms: (obj.rooms ?? []).map(room => clientRoom(room.id, room.updated_at)),
    })),
  } as ProjectData;
}

async function runInitialize(): Promise<void> {
  await initializeProjects(
    patch => useProjectStore.setState(patch as never),
    [],
    true,
    () => useProjectStore.getState(),
  );
}

describe('SYNC-V2 развилка инициализации (batch г)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    // resetStore не сбрасывает счётчик конфликтов — гасим перенос между тестами
    useProjectStore.setState({ conflictsResolved: 0, dirtyCount: 0, status: 'idle' });
    mockedApiToClient.mockImplementation(fakeToClient as never);
    mockedGetLastSyncAt.mockResolvedValue(null);
    mockedSyncPull.mockResolvedValue({
      status: 'success',
      data: { projects: [], timestamp: 1700000000000 },
    });
    mockedLoadLocal.mockResolvedValue([]);
    vi.stubEnv('VITE_SYNC_V2', 'true');
  });

  it('первый запуск: полный pull без since, lastSyncAt = серверный timestamp, legacy не зовётся', async () => {
    mockedSyncPull.mockResolvedValue({
      status: 'success',
      data: {
        projects: [serverProject(uuid(1), '2026-10-05T10:00:00.000Z')],
        timestamp: 1700000000000,
      },
    });

    await runInitialize();

    expect(mockedSyncPull).toHaveBeenCalledWith(undefined);
    expect(mockedPutLastSyncAt).toHaveBeenCalledWith(new Date(1700000000000).toISOString());
    expect(providerMocks.loadProjectsAsync).not.toHaveBeenCalled();

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].updatedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(state.projects[0].objects?.[0].rooms?.[0].updatedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(state.isLoading).toBe(false);
  });

  it('инкрементальный pull: since из Dexie; сервер новее — dirty снят, конфликт учтён', async () => {
    mockedGetLastSyncAt.mockResolvedValue('2026-10-05T09:00:00.000Z');
    mockedSyncPull.mockResolvedValue({
      status: 'success',
      data: {
        projects: [serverProject(uuid(1), '2026-10-05T12:00:00.000Z')],
        timestamp: 1700000000000,
      },
    });

    // dirty-версия локально старее серверной
    mockedLoadLocal.mockResolvedValue([clientProject(uuid(1), '2026-10-05T10:00:00.000Z')]);
    useProjectStore.setState({
      dirty: {
        project: { [uuid(1)]: { updatedAt: '2026-10-05T10:00:00.000Z', op: 'upsert' } },
        object: {},
        room: {},
      },
      dirtyCount: 1,
    });

    await runInitialize();

    expect(mockedSyncPull).toHaveBeenCalledWith('2026-10-05T09:00:00.000Z');
    const state = useProjectStore.getState();
    expect(state.projects[0].updatedAt).toBe('2026-10-05T12:00:00.000Z');
    expect(state.dirty.project[uuid(1)]).toBeUndefined();
    expect(state.dirtyCount).toBe(0);
    expect(state.conflictsResolved).toBe(1);
  });

  it('инкрементальный pull: клиент новее — локальная остаётся, dirty сохранена', async () => {
    mockedGetLastSyncAt.mockResolvedValue('2026-10-05T09:00:00.000Z');
    mockedSyncPull.mockResolvedValue({
      status: 'success',
      data: {
        projects: [serverProject(uuid(1), '2026-10-05T08:00:00.000Z')],
        timestamp: 1700000000000,
      },
    });

    const localNewer = clientProject(uuid(1), '2026-10-05T11:00:00.000Z');
    mockedLoadLocal.mockResolvedValue([localNewer]);
    useProjectStore.setState({
      dirty: {
        project: { [uuid(1)]: { updatedAt: '2026-10-05T11:00:00.000Z', op: 'upsert' } },
        object: {},
        room: {},
      },
      dirtyCount: 1,
    });

    await runInitialize();

    const state = useProjectStore.getState();
    expect(state.projects[0].updatedAt).toBe('2026-10-05T11:00:00.000Z');
    expect(state.dirty.project[uuid(1)]).toBeDefined();
    expect(state.conflictsResolved).toBe(0);
  });

  it('ошибка pull → откат на локальную копию, lastSyncAt не двигается', async () => {
    mockedSyncPull.mockRejectedValue(new TypeError('Failed to fetch'));
    const localCopy = [clientProject(uuid(1), '2026-10-05T07:00:00.000Z')];
    mockedLoadLocal.mockResolvedValue(localCopy);

    await runInitialize();

    expect(mockedPutLastSyncAt).not.toHaveBeenCalled();
    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].updatedAt).toBe('2026-10-05T07:00:00.000Z');
  });

  it('без флага — legacy путь: ApiStorageProvider.loadProjectsAsync, syncPull не зовётся', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'false');
    const legacyProject = clientProject(uuid(1), '2026-10-05T10:00:00.000Z');
    providerMocks.loadProjectsAsync.mockResolvedValue([legacyProject]);

    await runInitialize();

    expect(providerMocks.loadProjectsAsync).toHaveBeenCalledTimes(1);
    expect(mockedSyncPull).not.toHaveBeenCalled();
    expect(mockedPutLastSyncAt).not.toHaveBeenCalled();
    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].updatedAt).toBe('2026-10-05T10:00:00.000Z');
  });
});
