/**
 * Тесты флашера SYNC-V2 batch (б) (спека devAI/spec/SPEC-SYNC-V2.md §2.2, §2.3, §5(б)):
 * - под флагом по умолчанию не активен (VITE_SYNC_V2 не задан);
 * - оффлайн-сценарий: dirty копится, flush по debounce падает по сети — dirty остаётся,
 *   `online` → flush, dirty снимается;
 * - дедуп по сущности (одна мутация в пачке на несколько правок);
 * - порядок parent-before-child (project → object → room);
 * - батчинг ≥ N изменений (51 → 50 + 1);
 * - ошибки сети оставляют dirty, валидация (4xx) снимает с логом;
 * - гость не инициирует push.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { clearSaveTimers } from '../../src/store/createSyncSlice';
import type { ProjectData } from '../../src/types';
import type { FlusherDeps, FlusherSnapshot } from '../../src/api/storage/syncFlusher';
import {
  FLUSH_BATCH_SIZE,
  FLUSH_DEBOUNCE_MS,
  buildPushChanges,
  flushOnce,
  notifyDirtyChanged,
  startFlusher,
  stopFlusher,
} from '../../src/api/storage/syncFlusher';
import { syncPush } from '../../src/api/sync';
import { ProjectsApiError } from '../../src/api/projects';

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

vi.mock('../../src/api/sync', () => ({
  syncPush: vi.fn(),
}));

import { deleteSyncStateEntry } from '../../src/api/storage/dexieDb';

const mockedSyncPush = vi.mocked(syncPush);

function uuid(n: number): string {
  return `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
}

function makeProject(id: string): ProjectData {
  return {
    id,
    name: `Project ${id}`,
    objects: [
      {
        id: `${id}-obj`,
        projectId: id,
        name: 'Object',
        rooms: [
          {
            id: `${id}-room`,
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
          },
        ],
      },
    ],
  };
}

function seedStore(projects: ProjectData[], isAuthenticated: boolean) {
  resetStore();
  useProjectStore.setState({
    projects,
    activeProjectId: projects[0]?.id ?? '',
    activeProject: projects[0] ?? null,
    isAuthenticated,
    isLoading: false,
    dirty: { project: {}, object: {}, room: {} },
    dirtyCount: 0,
    status: 'idle',
  });
}

function snapshotFromStore(): FlusherSnapshot {
  const s = useProjectStore.getState();
  return { isAuthenticated: s.isAuthenticated, dirty: s.dirty, projects: s.projects };
}

interface DepsBundle {
  deps: FlusherDeps;
  ended: Array<Error | null>;
  resolved: Array<Array<{ entityKind: string; entityId: string; gaveUp: boolean }>>;
}

function makeDeps(): DepsBundle {
  const bundle: DepsBundle = {
    deps: {
      getSnapshot: snapshotFromStore,
      onFlushStart: () => useProjectStore.setState({ status: 'flushing' }),
      onFlushEnd: error => {
        useProjectStore.setState({ status: error ? 'error' : 'idle' });
        bundle.ended.push(error);
      },
      onEntitiesResolved: entries => {
        useProjectStore.getState().acknowledgeFlushed(entries);
        bundle.resolved.push(entries);
      },
    },
    ended: [],
    resolved: [],
  };
  return bundle;
}

/**
 * Прогон одного флаша. flushQueue — модульный синглтон: lastRequestTime переживает
 * тесты, а fake-часы сбрасываются, поэтому промотка итеративная — до завершения флаша
 * (гостю/флаг-off хватает одной итерации).
 */
async function runFlush(deps: FlusherDeps): Promise<void> {
  let done = false;
  const promise = flushOnce(deps).finally(() => {
    done = true;
  });
  for (let i = 0; i < 20 && !done; i++) {
    await vi.advanceTimersByTimeAsync(15000);
  }
  await promise;
}

describe('SYNC-V2 флашер (batch б)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(deleteSyncStateEntry).mockResolvedValue(undefined);
    mockedSyncPush.mockResolvedValue({ synced: [], conflicts: [] });
  });

  afterEach(() => {
    stopFlusher();
    clearSaveTimers();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('под флагом по умолчанию не активен: без VITE_SYNC_V2 нет ни flush, ни debounce-push', async () => {
    seedStore([makeProject(uuid(1))], true);
    useProjectStore.getState().updateActiveProject({
      ...useProjectStore.getState().projects[0],
      name: 'edit',
    });

    const { deps, ended } = makeDeps();
    await runFlush(deps);
    notifyDirtyChanged();
    await vi.advanceTimersByTimeAsync(FLUSH_DEBOUNCE_MS + 100);

    expect(mockedSyncPush).not.toHaveBeenCalled();
    expect(ended).toHaveLength(0);
    expect(useProjectStore.getState().dirtyCount).toBe(1);
  });

  it('оффлайн-сценарий: dirty копится, падение сети оставляет dirty, online → flush снимает', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], true);

    const { deps } = makeDeps();
    startFlusher(deps);

    // оффлайн-редактирование: две мутации копятся в dirty
    const p = useProjectStore.getState().projects[0];
    useProjectStore.getState().updateActiveProject({ ...p, name: 'offline-1' });
    useProjectStore.getState().updateActiveProject({ ...p, name: 'offline-2' });
    expect(useProjectStore.getState().dirtyCount).toBe(1);

    // debounce-флаш уходит в сеть и падает (нет сети) — dirty остаётся
    mockedSyncPush.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(FLUSH_DEBOUNCE_MS + 100);
    expect(mockedSyncPush).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().dirtyCount).toBe(1);
    expect(useProjectStore.getState().status).toBe('error');

    // сеть вернулась: online-триггер → flush → dirty снята + Dexie-запись удалена
    mockedSyncPush.mockResolvedValueOnce({ synced: [uuid(1)], conflicts: [] });
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(600);

    expect(mockedSyncPush).toHaveBeenCalledTimes(2);
    expect(useProjectStore.getState().dirtyCount).toBe(0);
    expect(useProjectStore.getState().status).toBe('idle');
    expect(deleteSyncStateEntry).toHaveBeenCalledWith(`project:${uuid(1)}`);
  });

  it('дедуп: несколько правок одной сущности дают одно изменение в пачке с clientUpdatedAt', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], true);

    const p = useProjectStore.getState().projects[0];
    useProjectStore.getState().updateActiveProject({ ...p, name: 'раз' });
    useProjectStore.getState().updateActiveProject({ ...p, name: 'два' });

    mockedSyncPush.mockResolvedValueOnce({ synced: [uuid(1)], conflicts: [] });
    const { deps } = makeDeps();
    await runFlush(deps);

    expect(mockedSyncPush).toHaveBeenCalledTimes(1);
    const batch = mockedSyncPush.mock.calls[0][0];
    expect(batch).toHaveLength(1);
    expect(batch[0].entity).toBe('project');
    expect(batch[0].entityId).toBe(uuid(1));
    expect(batch[0].data.clientUpdatedAt).toBe(useProjectStore.getState().projects[0].updatedAt);
  });

  it('порядок parent-before-child: project → object → room', () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], true);

    const p = useProjectStore.getState().projects[0];
    useProjectStore.getState().updateActiveProject({ ...p, name: 'p' });
    useProjectStore.getState().updateObject(`${uuid(1)}-obj`, { name: 'o' });
    useProjectStore.getState().updateRoom({ ...p.objects[0].rooms[0], name: 'r' });

    const { changes } = buildPushChanges(snapshotFromStore());
    expect(changes.map(c => `${c.entity}:${c.entityId}`)).toEqual([
      `project:${uuid(1)}`,
      `object:${uuid(1)}-obj`,
      `room:${uuid(1)}-room`,
    ]);
  });

  it('батчинг: 51 dirty-проект → две пачки 50 + 1', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    const many = Array.from({ length: FLUSH_BATCH_SIZE + 1 }, (_, i) => makeProject(uuid(i + 1)));
    seedStore(many, true);

    useProjectStore.getState().updateProjects(many.map(p => ({ ...p, name: `${p.name}!` })));
    expect(useProjectStore.getState().dirtyCount).toBe(FLUSH_BATCH_SIZE + 1);

    mockedSyncPush.mockResolvedValue({ synced: [], conflicts: [] });
    const { deps } = makeDeps();
    await runFlush(deps);

    expect(mockedSyncPush).toHaveBeenCalledTimes(2);
    expect(mockedSyncPush.mock.calls[0][0]).toHaveLength(FLUSH_BATCH_SIZE);
    expect(mockedSyncPush.mock.calls[1][0]).toHaveLength(1);
  });

  it('ошибка сети/429 оставляет dirty; 4xx-валидация снимает пачку с логом', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], true);
    useProjectStore
      .getState()
      .updateActiveProject({ ...useProjectStore.getState().projects[0], name: 'x' });

    // сеть — dirty остаётся
    mockedSyncPush.mockRejectedValueOnce(new TypeError('network down'));
    const { deps, resolved } = makeDeps();
    await runFlush(deps);
    expect(useProjectStore.getState().dirtyCount).toBe(1);
    expect(useProjectStore.getState().status).toBe('error');

    // 429 — dirty остаётся: транспорт ретраит с backoff (2000+4000+8000 мс), затем сдаётся
    for (let i = 0; i < 4; i++) {
      mockedSyncPush.mockRejectedValueOnce(new ProjectsApiError('rate limited', 429));
    }
    await runFlush(deps);
    expect(useProjectStore.getState().dirtyCount).toBe(1);

    // 400-валидация — пачка снимается
    mockedSyncPush.mockRejectedValueOnce(new ProjectsApiError('validation failed', 400));
    await runFlush(deps);
    expect(useProjectStore.getState().dirtyCount).toBe(0);
    expect(useProjectStore.getState().status).toBe('idle');
    expect(resolved.at(-1)?.every(e => e.gaveUp)).toBe(true);
  });

  it('гость: isAuthenticated=false — push не выполняется', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], false);
    useProjectStore
      .getState()
      .updateActiveProject({ ...useProjectStore.getState().projects[0], name: 'guest' });

    const { deps } = makeDeps();
    await runFlush(deps);
    expect(mockedSyncPush).not.toHaveBeenCalled();
    expect(useProjectStore.getState().dirtyCount).toBe(1);
  });

  it('конфликт из ответа сервера снимает сущность с логом (LWW-слияние — batch в)', async () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([makeProject(uuid(1))], true);
    useProjectStore
      .getState()
      .updateActiveProject({ ...useProjectStore.getState().projects[0], name: 'x' });

    mockedSyncPush.mockResolvedValueOnce({
      synced: [],
      conflicts: [
        { id: uuid(1), entity: 'project', entityId: uuid(1), serverVersion: 5, clientVersion: 1 },
      ],
    });
    const { deps, resolved } = makeDeps();
    await runFlush(deps);

    expect(useProjectStore.getState().dirtyCount).toBe(0);
    expect(resolved.at(-1)).toEqual([{ entityKind: 'project', entityId: uuid(1), gaveUp: true }]);
  });

  it('локальные сущности без состояния в дереве не попадают в пачку и снимаются как gaveUp', () => {
    vi.stubEnv('VITE_SYNC_V2', 'true');
    seedStore([], true);
    useProjectStore.setState({
      dirty: {
        project: { 'ghost-id': { updatedAt: '2026-10-04T10:00:00.000Z', op: 'upsert' } },
        object: {},
        room: {},
      },
      dirtyCount: 1,
    });

    const { changes, missing } = buildPushChanges(snapshotFromStore());
    expect(changes).toHaveLength(0);
    expect(missing).toEqual([{ entityKind: 'project', entityId: 'ghost-id' }]);
  });
});
