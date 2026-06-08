import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoomDomain } from '../../../src/hooks/domains/useRoomDomain';
import type { RoomData, ProjectData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
}));

function createTestRoom(id: string, name: string): RoomData {
  return {
    id,
    name,
    length: 5,
    width: 4,
    height: 3,
    windows: [],
    doors: [],
    works: [],
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    geometryMode: 'simple',
  };
}

function createTestProject(id: string, name: string, rooms: RoomData[] = []): ProjectData {
  return {
    id,
    name,
    objects: [
      {
        id: `obj-${id}`,
        projectId: id,
        name,
        rooms,
        sortOrder: 0,
      },
    ],
  };
}

function createDefaultDeps(overrides: Partial<{
  activeProjectId: string;
  activeProject: ProjectData | null;
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
  scheduleSave: (projects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
  updateActiveProject: (project: ProjectData) => void;
  isAuthenticated: boolean;
}> = {}) {
  const scheduleSave = vi.fn();
  const scheduleTotalsSave = vi.fn();
  const updateActiveProject = vi.fn();
  const setProjects = vi.fn();

  const activeProject = overrides.activeProject !== undefined
    ? overrides.activeProject
    : createTestProject('p1', 'Test Project', [createTestRoom('room-1', 'Room 1')]);

  return {
    activeProjectId: overrides.activeProjectId ?? 'p1',
    activeProject,
    setProjects,
    scheduleSave,
    scheduleTotalsSave,
    updateActiveProject,
    isAuthenticated: overrides.isAuthenticated ?? false,
  };
}

describe('useRoomDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addRoom', () => {
    it('should add room to active project', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useRoomDomain(deps));

      const newRoom = createTestRoom('room-2', 'New Room');

      act(() => {
        result.current.addRoom(newRoom);
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'p1',
          objects: expect.arrayContaining([
            expect.objectContaining({
              rooms: expect.arrayContaining([
                expect.objectContaining({ id: 'room-2', name: 'New Room' }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should not add room when no active project', () => {
      const deps = createDefaultDeps({ activeProject: null });
      const { result } = renderHook(() => useRoomDomain(deps));

      const newRoom = createTestRoom('room-2', 'New Room');

      act(() => {
        result.current.addRoom(newRoom);
      });

      expect(deps.updateActiveProject).not.toHaveBeenCalled();
    });

    it('should generate default room values when added', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useRoomDomain(deps));

      const newRoom: RoomData = {
        id: 'room-new',
        name: 'Kitchen',
        length: 0,
        width: 0,
        height: 0,
        windows: [],
        doors: [],
        works: [],
        segments: [],
        obstacles: [],
        wallSections: [],
        subSections: [],
        geometryMode: 'simple',
      };

      act(() => {
        result.current.addRoom(newRoom);
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({
              rooms: expect.arrayContaining([
                expect.objectContaining({ id: 'room-new', name: 'Kitchen' }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe('deleteRoom', () => {
    it('should delete room from active project', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.deleteRoom('room-1');
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'p1',
          objects: expect.arrayContaining([
            expect.objectContaining({
              rooms: [],
            }),
          ]),
        })
      );
    });

    it('should not delete room when no active project', () => {
      const deps = createDefaultDeps({ activeProject: null });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.deleteRoom('room-1');
      });

      expect(deps.updateActiveProject).not.toHaveBeenCalled();
    });
  });

  describe('updateRoom', () => {
    it('should update room in active project', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useRoomDomain(deps));

      const updatedRoom = createTestRoom('room-1', 'Updated Room');
      updatedRoom.length = 10;

      act(() => {
        result.current.updateRoom(updatedRoom);
      });

      expect(deps.setProjects).toHaveBeenCalledWith(expect.any(Function));

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      const newState = setStateFn(prevState);

      expect(newState[0].objects[0].rooms[0].name).toBe('Updated Room');
      expect(newState[0].objects[0].rooms[0].length).toBe(10);
      expect(deps.scheduleSave).toHaveBeenCalled();
    });

    it('should not update when active project not found in setProjects', () => {
      const deps = createDefaultDeps({ activeProjectId: 'nonexistent' });
      const { result } = renderHook(() => useRoomDomain(deps));

      const updatedRoom = createTestRoom('room-1', 'Updated');

      act(() => {
        result.current.updateRoom(updatedRoom);
      });

      expect(deps.setProjects).toHaveBeenCalledWith(expect.any(Function));

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      const newState = setStateFn(prevState);

      expect(newState).toEqual(prevState);
    });

    it('should schedule totals save when authenticated', () => {
      const deps = createDefaultDeps({ isAuthenticated: true });
      const { result } = renderHook(() => useRoomDomain(deps));

      const updatedRoom = createTestRoom('room-1', 'Updated');

      act(() => {
        result.current.updateRoom(updatedRoom);
      });

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      setStateFn(prevState);

      expect(deps.scheduleTotalsSave).toHaveBeenCalled();
    });
  });

  describe('updateRoomById', () => {
    it('should update room by id using updater function', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.updateRoomById('room-1', (prev) => ({
          ...prev,
          name: 'Renamed Room',
          length: 99,
        }));
      });

      expect(deps.setProjects).toHaveBeenCalledWith(expect.any(Function));

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      const newState = setStateFn(prevState);

      expect(newState[0].objects[0].rooms[0].name).toBe('Renamed Room');
      expect(newState[0].objects[0].rooms[0].length).toBe(99);
    });

    it('should not update when active project not found', () => {
      const deps = createDefaultDeps({ activeProjectId: 'nonexistent' });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.updateRoomById('room-1', (prev) => ({
          ...prev,
          name: 'Renamed',
        }));
      });

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      const newState = setStateFn(prevState);

      expect(newState).toEqual(prevState);
    });

    it('should schedule totals save when authenticated', () => {
      const deps = createDefaultDeps({ isAuthenticated: true });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.updateRoomById('room-1', (prev) => ({
          ...prev,
          name: 'Changed',
        }));
      });

      const setStateFn = deps.setProjects.mock.calls[0][0];
      const prevState = [createTestProject('p1', 'Test', [createTestRoom('room-1', 'Room 1')])];
      setStateFn(prevState);

      expect(deps.scheduleTotalsSave).toHaveBeenCalled();
    });
  });

  describe('reorderRooms', () => {
    it('should reorder rooms in active project', () => {
      const room1 = createTestRoom('room-1', 'Room 1');
      const room2 = createTestRoom('room-2', 'Room 2');
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', 'Test', [room1, room2]),
      });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.reorderRooms([room2, room1]);
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({
              rooms: [room2, room1],
            }),
          ]),
        })
      );
    });

    it('should not reorder rooms when no active project', () => {
      const deps = createDefaultDeps({ activeProject: null });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.reorderRooms([]);
      });

      expect(deps.updateActiveProject).not.toHaveBeenCalled();
    });

    it('should not reorder rooms when no objects in project', () => {
      const project: ProjectData = {
        id: 'p1',
        name: 'No Objects',
        objects: [],
      };
      const deps = createDefaultDeps({ activeProject: project });
      const { result } = renderHook(() => useRoomDomain(deps));

      act(() => {
        result.current.reorderRooms([createTestRoom('r1', 'R1')]);
      });

      expect(deps.updateActiveProject).not.toHaveBeenCalled();
    });
  });
});
