import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, resetStore } from '../../../src/store/useProjectStore';
import type { ProjectData } from '../../../src/types';

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

vi.mock('../../../src/utils/saveQueue', () => ({
  saveQueue: {
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
    enqueue: vi.fn(),
  },
}));

vi.mock('../../../src/utils/projectObjects', () => ({
  getAllRooms: vi.fn(() => []),
  migrateProjectToObjects: vi.fn((p: ProjectData) => ({ ...p, objects: p.objects || [] })),
  getObjectFromProject: vi.fn(),
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

vi.mock('../../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn(() => null),
    loadActiveProject: vi.fn(() => null),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
    saveProject: vi.fn(),
  },
}));

vi.mock('../../../src/api/storage', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      loadProjectsAsync: vi.fn(() => Promise.resolve([])),
      saveProjectsAsync: vi.fn(() => Promise.resolve([])),
      saveProjectAsync: vi.fn(() => Promise.resolve({})),
      createProjectAsync: vi.fn(),
      deleteProjectAsync: vi.fn(),
      markProjectDeleted: vi.fn(),
      getRoomSyncErrors: vi.fn(() => new Map()),
    })),
    resetInstance: vi.fn(),
  },
}));

vi.mock('../../../src/api/totals', () => ({ saveTotals: vi.fn() }));
vi.mock('../../../src/utils/migration', () => ({ runMigrations: vi.fn(), needsMigration: vi.fn(() => false) }));
vi.mock('../../../src/utils/idMapper', () => ({
  idMapper: { getServerId: vi.fn(), addMapping: vi.fn(), clear: vi.fn() },
  IdMapper: { isServerId: vi.fn(), isLocalId: vi.fn() },
  isServerId: vi.fn(),
}));
vi.mock('../../../src/utils/geometry', () => ({ calculateRoomMetrics: vi.fn(() => ({ floorArea: 0 })) }));
vi.mock('../../../src/utils/costs', () => ({ calculateRoomCosts: vi.fn(() => ({ totalWork: 0, totalMaterial: 0, totalTools: 0 })) }));
vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

import { saveQueue } from '../../../src/utils/saveQueue';

describe('useSyncDomain (Zustand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetStore();
    useProjectStore.setState({
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initSyncListeners function', () => {
    expect(useProjectStore.getState().initSyncListeners).toBeTypeOf('function');
  });

  it('should call initSyncListeners and return cleanup without error', () => {
    const cleanup = useProjectStore.getState().initSyncListeners();
    expect(cleanup).toBeTypeOf('function');
    cleanup();
  });

  it('should register visibilitychange event listener', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const cleanup = useProjectStore.getState().initSyncListeners();
    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    addSpy.mockRestore();
    cleanup();
  });

  it('should remove visibilitychange listener on cleanup', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const cleanup = useProjectStore.getState().initSyncListeners();
    cleanup();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('should call scheduleSave when visibility changes and has pending data', () => {
    const scheduleSave = vi.fn();
    const pendingProjects: ProjectData[] = [
      { id: 'p1', name: 'Test', objects: [] },
    ];

    (saveQueue.hasPendingData as boolean) = false;

    useProjectStore.setState({ scheduleSave, isAuthenticated: true });
    const cleanup = useProjectStore.getState().initSyncListeners();

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue(pendingProjects);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(scheduleSave).toHaveBeenCalledWith(pendingProjects);

    (saveQueue.hasPendingData as boolean) = false;
    cleanup();
  });

  it('should not call scheduleSave when no pending data', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = false;

    useProjectStore.setState({ scheduleSave, isAuthenticated: true });
    const cleanup = useProjectStore.getState().initSyncListeners();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(scheduleSave).not.toHaveBeenCalled();
    cleanup();
  });

  it('should not call scheduleSave when visibility is not visible', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = false;

    useProjectStore.setState({ scheduleSave, isAuthenticated: true });
    const cleanup = useProjectStore.getState().initSyncListeners();

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue([]);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(scheduleSave).not.toHaveBeenCalled();

    (saveQueue.hasPendingData as boolean) = false;
    cleanup();
  });

  it('should not call scheduleSave when getPendingData returns non-array', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue('not-an-array');

    useProjectStore.setState({ scheduleSave, isAuthenticated: true });
    const cleanup = useProjectStore.getState().initSyncListeners();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(scheduleSave).not.toHaveBeenCalled();

    (saveQueue.hasPendingData as boolean) = false;
    cleanup();
  });
});
