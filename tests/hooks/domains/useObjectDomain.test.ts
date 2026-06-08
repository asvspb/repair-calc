import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore, resetStore } from '../../../src/store/useProjectStore';
import type { ObjectData, ProjectData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logStateChange: vi.fn(),
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

  const { createNewObject, addObjectToProject, copyObjectInProject, updateObjectInProject, deleteObjectFromProject, getFirstObject } = actual;

  createNewObject.mockImplementation((projectId: string, data: { name: string; city?: string }) => ({
    id: `obj-${Date.now()}`,
    projectId,
    name: data.name,
    city: data.city,
    rooms: [],
    sortOrder: 0,
  }));

  addObjectToProject.mockImplementation((project: ProjectData, newObject: ObjectData) => ({
    ...project,
    objects: [...project.objects, newObject],
  }));

  updateObjectInProject.mockImplementation((project: ProjectData, objectId: string, data: Partial<ObjectData>) => ({
    ...project,
    objects: project.objects.map((o: ObjectData) => o.id === objectId ? { ...o, ...data } : o),
  }));

  deleteObjectFromProject.mockImplementation((project: ProjectData, objectId: string) => {
    if (project.objects.length <= 1) return null;
    return {
      ...project,
      objects: project.objects.filter((o: ObjectData) => o.id !== objectId),
    };
  });

  copyObjectInProject.mockImplementation((project: ProjectData, objectId: string) => {
    const source = project.objects.find((o: ObjectData) => o.id === objectId);
    if (!source) return null;
    const newId = `obj-copy-${Date.now()}`;
    const copied = { ...source, id: newId, name: `${source.name} (копия)` };
    return { project: { ...project, objects: [...project.objects, copied] }, newObjectId: newId };
  });

  getFirstObject.mockImplementation((project: ProjectData) => project.objects?.[0] || null);

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

function createTestObject(id: string, name: string, rooms: unknown[] = []): ObjectData {
  return { id, projectId: 'p1', name, rooms: rooms as ObjectData['rooms'], sortOrder: 0 };
}

function createTestProject(id: string, objects: ObjectData[] = []): ProjectData {
  return { id, name: 'Test Project', objects };
}

function setupStore(overrides: { objects?: ObjectData[]; activeObjectId?: string | null } = {}) {
  const obj1 = createTestObject('obj-1', 'Object 1');
  const obj2 = createTestObject('obj-2', 'Object 2');
  const objects = overrides.objects ?? [obj1, obj2];
  const project = createTestProject('p1', objects);
  const activeObjectId = overrides.activeObjectId !== undefined ? overrides.activeObjectId : null;
  const activeObject = activeObjectId
    ? objects.find(o => o.id === activeObjectId) || objects[0]
    : objects[0];

  useProjectStore.setState({
    projects: [project],
    activeProjectId: 'p1',
    activeProject: project,
    activeObjectId,
    activeObject,
    isAuthenticated: false,
    isLoading: false,
  });
}

describe('useObjectDomain (Zustand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('initial state', () => {
    it('should return null activeObject when no objects', () => {
      setupStore({ objects: [] });
      expect(useProjectStore.getState().activeObjectId).toBeNull();
      expect(useProjectStore.getState().activeObject).toBeFalsy();
    });

    it('should default to first object when no activeObjectId set', () => {
      setupStore();
      expect(useProjectStore.getState().activeObjectId).toBeNull();
      expect(useProjectStore.getState().activeObject).toBeDefined();
      expect(useProjectStore.getState().activeObject!.id).toBe('obj-1');
    });

    it('should return null activeObject when no activeProject', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null, activeObjectId: null, activeObject: null });
      expect(useProjectStore.getState().activeObject).toBeNull();
    });
  });

  describe('setActiveObjectId', () => {
    it('should update active object id', () => {
      setupStore();
      useProjectStore.getState().setActiveObjectId('obj-2');
      expect(useProjectStore.getState().activeObjectId).toBe('obj-2');
    });

    it('should set to null', () => {
      setupStore();
      useProjectStore.getState().setActiveObjectId(null);
      expect(useProjectStore.getState().activeObjectId).toBeNull();
    });

    it('should update activeObject when id is set', () => {
      setupStore();
      useProjectStore.getState().setActiveObjectId('obj-2');
      expect(useProjectStore.getState().activeObject!.id).toBe('obj-2');
      expect(useProjectStore.getState().activeObject!.name).toBe('Object 2');
    });
  });

  describe('createObject', () => {
    it('should create a new object in active project', () => {
      setupStore();
      const newId = useProjectStore.getState().createObject({ name: 'New Object', city: 'Moscow' });

      expect(newId).toBeTruthy();
      expect(useProjectStore.getState().activeObjectId).toBe(newId);

      const state = useProjectStore.getState();
      const created = state.activeProject?.objects.find(o => o.id === newId);
      expect(created).toBeDefined();
      expect(created?.name).toBe('New Object');
    });

    it('should return empty string when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });

      const newId = useProjectStore.getState().createObject({ name: 'Test' });
      expect(newId).toBe('');
    });

    it('should create object with city', () => {
      setupStore();
      useProjectStore.getState().createObject({ name: 'With City', city: 'SPb' });

      const state = useProjectStore.getState();
      const created = state.activeProject?.objects.find(o => o.name === 'With City');
      expect(created?.city).toBe('SPb');
    });
  });

  describe('updateObject', () => {
    it('should update object data', () => {
      setupStore();
      useProjectStore.getState().updateObject('obj-1', { name: 'Updated Name' });

      const state = useProjectStore.getState();
      const updated = state.activeProject?.objects.find(o => o.id === 'obj-1');
      expect(updated?.name).toBe('Updated Name');
    });

    it('should not update when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });
      useProjectStore.getState().updateObject('obj-1', { name: 'Test' });

      expect(useProjectStore.getState().projects.length).toBe(0);
    });
  });

  describe('deleteObject', () => {
    it('should delete object from project', () => {
      setupStore();
      const deleted = useProjectStore.getState().deleteObject('obj-2');

      expect(deleted).toBe(true);
      const state = useProjectStore.getState();
      expect(state.activeProject?.objects.find(o => o.id === 'obj-1')).toBeDefined();
      expect(state.activeProject?.objects.find(o => o.id === 'obj-2')).toBeUndefined();
    });

    it('should return false when trying to delete last object', () => {
      const onlyObj = createTestObject('obj-only', 'Only Object');
      setupStore({ objects: [onlyObj] });

      const deleted = useProjectStore.getState().deleteObject('obj-only');
      expect(deleted).toBe(false);
    });

    it('should switch active object when deleting active one', () => {
      setupStore();
      useProjectStore.getState().setActiveObjectId('obj-1');

      useProjectStore.getState().deleteObject('obj-1');
      expect(useProjectStore.getState().activeObjectId).toBe('obj-2');
    });

    it('should return false when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });
      expect(useProjectStore.getState().deleteObject('obj-1')).toBe(false);
    });
  });

  describe('copyObject', () => {
    it('should copy object and return new id', () => {
      setupStore();
      const newId = useProjectStore.getState().copyObject('obj-1');

      expect(newId).toBeTruthy();
      const state = useProjectStore.getState();
      const copied = state.activeProject?.objects.find(o => o.id === newId);
      expect(copied).toBeDefined();
      expect(copied?.name).toContain('копия');
    });

    it('should return null when no active project', () => {
      resetStore();
      useProjectStore.setState({ activeProject: null });
      expect(useProjectStore.getState().copyObject('obj-1')).toBeNull();
    });

    it('should return null when object not found', () => {
      setupStore();
      expect(useProjectStore.getState().copyObject('nonexistent')).toBeNull();
    });

    it('should copy object with rooms', () => {
      const obj = createTestObject('obj-1', 'With Rooms', [{ id: 'room-1', name: 'Room 1' }]);
      setupStore({ objects: [obj] });

      const newId = useProjectStore.getState().copyObject('obj-1');
      expect(newId).toBeTruthy();

      const state = useProjectStore.getState();
      const copied = state.activeProject?.objects.find(o => o.id === newId);
      expect(copied).toBeDefined();
    });
  });
});
