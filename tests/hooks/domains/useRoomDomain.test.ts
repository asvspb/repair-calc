import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore, resetStore } from '../../../src/store/useProjectStore';
import type { RoomData, ProjectData, ObjectData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('../../../src/utils/projectObjects', () => {
  const actual = {
    getAllRooms: vi.fn(() => []),
    migrateProjectToObjects: vi.fn((p: ProjectData) => ({ ...p, objects: p.objects || [] })),
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
  ApiStorageProvider: { getInstance: vi.fn(), resetInstance: vi.fn() },
}));

vi.mock('../../../src/api/totals', () => ({ saveTotals: vi.fn() }));
vi.mock('../../../src/utils/migration', () => ({ runMigrations: vi.fn(), needsMigration: vi.fn(() => false) }));
vi.mock('../../../src/utils/idMapper', () => ({
  idMapper: { getServerId: vi.fn(), addMapping: vi.fn(), clear: vi.fn() },
  IdMapper: { isServerId: vi.fn(), isLocalId: vi.fn() },
  isServerId: vi.fn(),
}));
vi.mock('../../../src/utils/saveQueue', () => ({
  saveQueue: { enqueue: vi.fn((task: () => Promise<void>) => task()), hasPendingData: false, getPendingData: vi.fn() },
}));
vi.mock('../../../src/utils/geometry', () => ({ calculateRoomMetrics: vi.fn(() => ({ floorArea: 0 })) }));
vi.mock('../../../src/utils/costs', () => ({ calculateRoomCosts: vi.fn(() => ({ totalWork: 0, totalMaterial: 0, totalTools: 0 })) }));
vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

function createTestRoom(id: string, name: string): RoomData {
  return {
    id, name, length: 5, width: 4, height: 3,
    windows: [], doors: [], works: [], segments: [],
    obstacles: [], wallSections: [], subSections: [],
    geometryMode: 'simple',
  };
}

function createTestProject(id: string, name: string, rooms: RoomData[] = []): ProjectData {
  return {
    id, name,
    objects: [{
      id: `obj-${id}`, projectId: id, name, rooms, sortOrder: 0,
    }],
  };
}

function setupStore(overrides: { project?: ProjectData; isAuthenticated?: boolean } = {}) {
  const project = overrides.project ?? createTestProject('p1', 'Test Project', [createTestRoom('room-1', 'Room 1')]);
  const isAuthenticated = overrides.isAuthenticated ?? false;
  useProjectStore.setState({
    projects: [project],
    activeProjectId: project.id,
    activeProject: project,
    isAuthenticated,
    isLoading: false,
    activeObjectId: null,
    activeObject: project.objects?.[0] || null,
  });
}

describe('useRoomDomain (Zustand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('addRoom', () => {
    it('should add room to active project', () => {
      setupStore();
      const newRoom = createTestRoom('room-2', 'New Room');

      useProjectStore.getState().addRoom(newRoom);

      const state = useProjectStore.getState();
      const activeObj = state.activeProject?.objects?.[0];
      expect(activeObj?.rooms).toHaveLength(2);
      expect(activeObj?.rooms.find(r => r.id === 'room-2')).toBeDefined();
    });

    it('should not add room when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });
      const projectCount = useProjectStore.getState().projects.length;

      useProjectStore.getState().addRoom(createTestRoom('room-2', 'New Room'));

      expect(useProjectStore.getState().projects.length).toBe(projectCount);
    });
  });

  describe('deleteRoom', () => {
    it('should delete room from active project', () => {
      setupStore();

      useProjectStore.getState().deleteRoom('room-1');

      const activeObj = useProjectStore.getState().activeProject?.objects?.[0];
      expect(activeObj?.rooms).toHaveLength(0);
    });

    it('should not delete room when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });

      useProjectStore.getState().deleteRoom('room-1');

      expect(useProjectStore.getState().projects.length).toBe(0);
    });
  });

  describe('updateRoom', () => {
    it('should update room in active project', () => {
      setupStore();
      const updatedRoom = createTestRoom('room-1', 'Updated Room');
      updatedRoom.length = 10;

      useProjectStore.getState().updateRoom(updatedRoom);

      const state = useProjectStore.getState();
      const room = state.activeProject?.objects?.[0]?.rooms.find((r: RoomData) => r.id === 'room-1');
      expect(room?.name).toBe('Updated Room');
      expect(room?.length).toBe(10);
    });

    it('should not update when active project not found', () => {
      setupStore({ project: createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')]) });
      useProjectStore.setState({ activeProjectId: 'nonexistent' });

      const updatedRoom = createTestRoom('room-1', 'Updated');
      useProjectStore.getState().updateRoom(updatedRoom);

      const state = useProjectStore.getState();
      const originalRoom = state.projects[0].objects[0].rooms[0];
      expect(originalRoom.name).toBe('Room 1');
    });
  });

  describe('updateRoomById', () => {
    it('should update room by id using updater function', () => {
      setupStore();

      useProjectStore.getState().updateRoomById('room-1', (prev) => ({
        ...prev, name: 'Renamed Room', length: 99,
      }));

      const state = useProjectStore.getState();
      const room = state.activeProject?.objects?.[0]?.rooms.find((r: RoomData) => r.id === 'room-1');
      expect(room?.name).toBe('Renamed Room');
      expect(room?.length).toBe(99);
    });

    it('should not update when active project not found', () => {
      setupStore();
      useProjectStore.setState({ activeProjectId: 'nonexistent' });

      useProjectStore.getState().updateRoomById('room-1', (prev) => ({
        ...prev, name: 'Renamed',
      }));

      const state = useProjectStore.getState();
      expect(state.projects[0].objects[0].rooms[0].name).toBe('Room 1');
    });
  });

  describe('reorderRooms', () => {
    it('should reorder rooms in active project', () => {
      const room1 = createTestRoom('room-1', 'Room 1');
      const room2 = createTestRoom('room-2', 'Room 2');
      setupStore({ project: createTestProject('p1', 'Test', [room1, room2]) });

      useProjectStore.getState().reorderRooms([room2, room1]);

      const state = useProjectStore.getState();
      const rooms = state.activeProject?.objects?.[0]?.rooms;
      expect(rooms?.[0].id).toBe('room-2');
      expect(rooms?.[1].id).toBe('room-1');
    });

    it('should not reorder rooms when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });

      useProjectStore.getState().reorderRooms([]);

      expect(useProjectStore.getState().projects.length).toBe(0);
    });

    it('should not reorder rooms when no objects in project', () => {
      const project: ProjectData = { id: 'p1', name: 'No Objects', objects: [] };
      setupStore({ project });

      useProjectStore.getState().reorderRooms([createTestRoom('r1', 'R1')]);

      expect(useProjectStore.getState().projects[0].objects).toHaveLength(0);
    });
  });
});
