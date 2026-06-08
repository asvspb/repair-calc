import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProjectData, RoomData } from '../../src/types';

const mockSaveTotals = vi.fn();
vi.mock('../../src/api/totals', () => ({
  saveTotals: (...args: unknown[]) => mockSaveTotals(...args),
}));

vi.mock('../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      loadProjectsAsync: vi.fn().mockResolvedValue([]),
      saveProjectsAsync: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../../src/api/httpClient', () => ({
  httpClient: {
    request: vi.fn().mockResolvedValue({ data: [] }),
  },
  ApiError: class ApiError extends Error {
    constructor(public message: string, public statusCode: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn().mockReturnValue(null),
    loadActiveProject: vi.fn().mockReturnValue(null),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
  },
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  }),
}));

vi.mock('../../src/utils/logger', () => ({
  logApiRequest: vi.fn(() => Date.now()),
  logApiSuccess: vi.fn(),
  logApiError: vi.fn(),
  logDebug: vi.fn(),
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logStart: vi.fn(() => Date.now()),
  logEnd: vi.fn(),
  logStateChange: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('../../src/utils/saveQueue', () => ({
  saveQueue: {
    enqueue: vi.fn((fn: () => Promise<void>) => fn()),
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
  },
}));

vi.mock('../../src/utils/idMapper', () => ({
  idMapper: { getServerId: vi.fn() },
  IdMapper: { isLocalId: vi.fn(() => false) },
}));

vi.mock('../../src/utils/migration', () => ({
  runMigrations: vi.fn().mockResolvedValue({ duplicatesRemoved: 0 }),
  needsMigration: vi.fn(() => false),
}));

vi.mock('../../src/utils/projectObjects', () => {
  const actual = {
    getAllRooms: vi.fn(() => []),
    migrateProjectToObjects: vi.fn((p: ProjectData) => ({ ...p, objects: p.objects || [] })),
    getObjectFromProject: vi.fn(),
    updateRoomInProject: vi.fn(),
    addRoomToProject: vi.fn(),
    deleteRoomFromProject: vi.fn(),
    reorderRoomsInProject: vi.fn(),
  };

  const { updateRoomInProject, addRoomToProject, deleteRoomFromProject, reorderRoomsInProject } = actual;

  updateRoomInProject.mockImplementation((project: ProjectData, roomId: string, updater: (room: RoomData) => RoomData) => {
    const newObjects = project.objects.map(obj => ({
      ...obj,
      rooms: obj.rooms.map((r: RoomData) => r.id === roomId ? updater(r) : r),
    }));
    return { ...project, objects: newObjects };
  });

  addRoomToProject.mockImplementation((project: ProjectData, room: RoomData) => {
    const newObjects = project.objects.map((obj, i: number) =>
      i === 0 ? { ...obj, rooms: [...obj.rooms, room] } : obj
    );
    return { ...project, objects: newObjects };
  });

  deleteRoomFromProject.mockImplementation((project: ProjectData, roomId: string) => {
    const newObjects = project.objects.map(obj => ({
      ...obj,
      rooms: obj.rooms.filter((r: RoomData) => r.id !== roomId),
    }));
    return { ...project, objects: newObjects };
  });

  reorderRoomsInProject.mockImplementation((project: ProjectData, objectId: string, rooms: RoomData[]) => {
    const newObjects = project.objects.map(obj =>
      obj.id === objectId ? { ...obj, rooms } : obj
    );
    return { ...project, objects: newObjects };
  });

  return actual;
});

vi.mock('../../src/utils/geometry', () => ({ calculateRoomMetrics: vi.fn(() => ({ floorArea: 0 })) }));
vi.mock('../../src/utils/costs', () => ({ calculateRoomCosts: vi.fn(() => ({ totalWork: 0, totalMaterial: 0, totalTools: 0 })) }));

import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { StorageManager } from '../../src/utils/storage';

const createTestRoom = (id: string, name: string): RoomData => ({
  id, name, length: 5, width: 4, height: 3,
  windows: [], doors: [], works: [], segments: [],
  obstacles: [], wallSections: [], subSections: [],
  geometryMode: 'simple',
});

const createTestProject = (id: string, name: string): ProjectData => ({
  id, name,
  objects: [{
    id: 'obj-1',
    projectId: id,
    name,
    rooms: [createTestRoom('room-1', 'Living Room')],
  }],
});

async function setupStore(isAuthenticated = false) {
  resetStore();
  const project = createTestProject('p1', 'Test Project');
  await useProjectStore.getState().initialize([project], isAuthenticated);
}

describe('ProjectContext - Auto-save totals (Zustand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (StorageManager.loadActiveProject as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockSaveTotals.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('saveCalculatedTotals', () => {
    it('should not save totals for unauthenticated user', async () => {
      await setupStore(false);

      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };
      useProjectStore.getState().updateRoom(updatedRoom);

      expect(mockSaveTotals).not.toHaveBeenCalled();
    });

    it('should have correct initial state', async () => {
      await setupStore(false);

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.activeProject).toBeDefined();
      expect(state.activeProject?.name).toBe('Test Project');
    });
  });

  describe('updateRoom', () => {
    it('should update room correctly', async () => {
      await setupStore(false);

      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };
      useProjectStore.getState().updateRoom(updatedRoom);

      const project = useProjectStore.getState().activeProject;
      expect(project).toBeDefined();
      const room = project?.objects?.[0]?.rooms.find(r => r.id === 'room-1');
      expect(room?.length).toBe(6);
    });
  });

  describe('updateRoomById', () => {
    it('should update room by ID with updater function', async () => {
      await setupStore(false);

      useProjectStore.getState().updateRoomById('room-1', (prev) => ({
        ...prev, length: 10,
      }));

      const project = useProjectStore.getState().activeProject;
      const room = project?.objects?.[0]?.rooms.find(r => r.id === 'room-1');
      expect(room?.length).toBe(10);
    });
  });

  describe('addRoom', () => {
    it('should add new room', async () => {
      await setupStore(false);

      const newRoom = createTestRoom('room-2', 'New Room');
      useProjectStore.getState().addRoom(newRoom);

      const project = useProjectStore.getState().activeProject;
      expect(project?.objects?.[0]?.rooms).toHaveLength(2);
    });
  });

  describe('deleteRoom', () => {
    it('should delete room', async () => {
      await setupStore(false);

      useProjectStore.getState().deleteRoom('room-1');

      const project = useProjectStore.getState().activeProject;
      expect(project?.objects?.[0]?.rooms).toHaveLength(0);
    });
  });

  describe('reorderRooms', () => {
    it('should reorder rooms', async () => {
      await setupStore(false);

      const newRoom = createTestRoom('room-2', 'New Room');
      useProjectStore.getState().addRoom(newRoom);

      const project = useProjectStore.getState().activeProject;
      if (project && project.objects?.[0]?.rooms) {
        useProjectStore.getState().reorderRooms([...project.objects[0].rooms].reverse());
      }

      const updatedProject = useProjectStore.getState().activeProject;
      expect(updatedProject?.objects?.[0]?.rooms).toHaveLength(2);
    });
  });

  describe('updateActiveProject', () => {
    it('should update active project', async () => {
      await setupStore(false);

      const project = useProjectStore.getState().activeProject;
      if (project) {
        useProjectStore.getState().updateActiveProject({
          ...project,
          name: 'Updated Project',
        });
      }

      expect(useProjectStore.getState().activeProject?.name).toBe('Updated Project');
    });
  });

  describe('cleanup', () => {
    it('should reset store without errors', () => {
      resetStore();
      expect(() => { resetStore(); }).not.toThrow();
    });
  });
});
