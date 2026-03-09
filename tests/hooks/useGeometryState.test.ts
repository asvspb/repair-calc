import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeometryState } from '../../src/hooks/useGeometryState';
import type { RoomData } from '../../src/types';

// Мок для sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

describe('useGeometryState', () => {
  // Базовая комната для тестов
  const createMockRoom = (overrides: Partial<RoomData> = {}): RoomData => ({
    id: 'room-1',
    name: 'Test Room',
    height: 2.8,
    geometryMode: 'simple',
    length: 5,
    width: 4,
    windows: [],
    doors: [],
    subSections: [],
    segments: [],
    obstacles: [],
    wallSections: [],
    works: [],
    simpleModeData: undefined,
    extendedModeData: undefined,
    advancedModeData: undefined,
    ...overrides,
  });

  let mockRoom: RoomData;
  let mockUpdateRoom: ReturnType<typeof vi.fn>;
  let mockUpdateRoomById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    mockRoom = createMockRoom();
    mockUpdateRoom = vi.fn();
    mockUpdateRoomById = vi.fn();
  });

  // ============================================
  // UI State Tests
  // ============================================
  describe('UI State', () => {
    it('should initialize with collapsed states from sessionStorage', () => {
      sessionStorageMock.setItem('simpleMode_geometry_collapsed', 'true');
      sessionStorageMock.setItem('extendedMode_geometry_collapsed', 'true');
      sessionStorageMock.setItem('subSections_expanded', 'false');

      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      expect(result.current.isGeometryCollapsed).toBe(true);
      expect(result.current.isExtendedGeometryCollapsed).toBe(true);
      expect(result.current.subSectionsExpanded).toBe(false);
    });

    it('should toggle geometry collapse state', () => {
      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      expect(result.current.isGeometryCollapsed).toBe(false);

      act(() => {
        result.current.toggleGeometryCollapse();
      });

      expect(result.current.isGeometryCollapsed).toBe(true);
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'simpleMode_geometry_collapsed',
        'true'
      );
    });

    it('should toggle extended geometry collapse state', () => {
      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      expect(result.current.isExtendedGeometryCollapsed).toBe(false);

      act(() => {
        result.current.toggleExtendedGeometryCollapse();
      });

      expect(result.current.isExtendedGeometryCollapsed).toBe(true);
    });

    it('should toggle subSections expanded state', () => {
      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      expect(result.current.subSectionsExpanded).toBe(true);

      act(() => {
        result.current.toggleSubSectionsExpand();
      });

      expect(result.current.subSectionsExpanded).toBe(false);
    });
  });

  // ============================================
  // Simple Mode Handlers Tests
  // ============================================
  describe('Simple Mode Handlers', () => {
    describe('updateSimpleField', () => {
      it('should update length field', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSimpleField('length', 10);
        });

        expect(mockUpdateRoomById).toHaveBeenCalledWith('room-1', expect.any(Function));

        // Проверяем, что updater функция работает правильно
        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.length).toBe(10);
      });

      it('should update width field', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSimpleField('width', 8);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.width).toBe(8);
      });
    });

    describe('Window handlers', () => {
      it('should add a new window', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addWindow();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.windows).toHaveLength(1);
        expect(updatedRoom.windows[0].width).toBe(1.5);
        expect(updatedRoom.windows[0].height).toBe(1.5);
      });

      it('should remove a window', () => {
        const roomWithWindow = createMockRoom({
          windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWindow, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeWindow('win-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWindow);
        expect(updatedRoom.windows).toHaveLength(0);
      });

      it('should update window field', () => {
        const roomWithWindow = createMockRoom({
          windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWindow, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateWindow('win-1', 'width', 2);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWindow);
        expect(updatedRoom.windows[0].width).toBe(2);
      });
    });

    describe('Door handlers', () => {
      it('should add a new door', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addDoor();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.doors).toHaveLength(1);
        expect(updatedRoom.doors[0].width).toBe(0.9);
        expect(updatedRoom.doors[0].height).toBe(2.0);
      });

      it('should remove a door', () => {
        const roomWithDoor = createMockRoom({
          doors: [{ id: 'door-1', width: 0.9, height: 2.0, comment: '' }],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithDoor, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeDoor('door-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithDoor);
        expect(updatedRoom.doors).toHaveLength(0);
      });

      it('should update door field', () => {
        const roomWithDoor = createMockRoom({
          doors: [{ id: 'door-1', width: 0.9, height: 2.0, comment: '' }],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithDoor, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateDoor('door-1', 'height', 2.2);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithDoor);
        expect(updatedRoom.doors[0].height).toBe(2.2);
      });
    });
  });

  // ============================================
  // Extended Mode Handlers Tests
  // ============================================
  describe('Extended Mode Handlers', () => {
    describe('SubSection handlers', () => {
      it('should add a new subSection', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addSubSection();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.subSections).toHaveLength(1);
        expect(updatedRoom.subSections[0].name).toBe('Секция');
        expect(updatedRoom.subSections[0].shape).toBe('rectangle');
      });

      it('should remove a subSection', () => {
        const roomWithSubSection = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithSubSection, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeSubSection('sub-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithSubSection);
        expect(updatedRoom.subSections).toHaveLength(0);
      });

      it('should update subSection field', () => {
        const roomWithSubSection = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithSubSection, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSubSection('sub-1', 'length', 5);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithSubSection);
        expect(updatedRoom.subSections[0].length).toBe(5);
      });

      it('should update extendedModeData when in extended mode', () => {
        const extendedRoom = createMockRoom({
          geometryMode: 'extended',
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(extendedRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSubSection('sub-1', 'length', 5);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(extendedRoom);
        expect(updatedRoom.extendedModeData?.subSections[0].length).toBe(5);
      });
    });

    describe('SubSection Window handlers', () => {
      const roomWithSubSection = createMockRoom({
        subSections: [
          {
            id: 'sub-1',
            name: 'Section 1',
            shape: 'rectangle',
            length: 3,
            width: 2,
            windows: [],
            doors: [],
          },
        ],
      });

      it('should add window to subSection', () => {
        const { result } = renderHook(() =>
          useGeometryState(roomWithSubSection, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addSubSectionWindow('sub-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithSubSection);
        expect(updatedRoom.subSections[0].windows).toHaveLength(1);
      });

      it('should remove window from subSection', () => {
        const roomWithWindow = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
              doors: [],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWindow, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeSubSectionWindow('sub-1', 'win-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWindow);
        expect(updatedRoom.subSections[0].windows).toHaveLength(0);
      });

      it('should update subSection window field', () => {
        const roomWithWindow = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
              doors: [],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWindow, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSubSectionWindow('sub-1', 'win-1', 'width', 2);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWindow);
        expect(updatedRoom.subSections[0].windows[0].width).toBe(2);
      });
    });

    describe('SubSection Door handlers', () => {
      it('should add door to subSection', () => {
        const testRoom = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [],
            },
          ],
        });
        
        const { result } = renderHook(() =>
          useGeometryState(testRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addSubSectionDoor('sub-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(testRoom);
        expect(updatedRoom.subSections[0].doors).toHaveLength(1);
      });

      it('should remove door from subSection', () => {
        const roomWithDoor = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [{ id: 'door-1', width: 0.9, height: 2.0, comment: '' }],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithDoor, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeSubSectionDoor('sub-1', 'door-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithDoor);
        expect(updatedRoom.subSections[0].doors).toHaveLength(0);
      });

      it('should update subSection door field', () => {
        const roomWithDoor = createMockRoom({
          subSections: [
            {
              id: 'sub-1',
              name: 'Section 1',
              shape: 'rectangle',
              length: 3,
              width: 2,
              windows: [],
              doors: [{ id: 'door-1', width: 0.9, height: 2.0, comment: '' }],
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithDoor, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSubSectionDoor('sub-1', 'door-1', 'width', 1.0);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithDoor);
        expect(updatedRoom.subSections[0].doors[0].width).toBe(1.0);
      });
    });
  });

  // ============================================
  // Advanced Mode Handlers Tests
  // ============================================
  describe('Advanced Mode Handlers', () => {
    describe('Segment handlers', () => {
      it('should add a new segment', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addSegment();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.segments).toHaveLength(1);
        expect(updatedRoom.segments[0].name).toBe('Ниша');
        expect(updatedRoom.segments[0].operation).toBe('subtract');
      });

      it('should remove a segment', () => {
        const roomWithSegment = createMockRoom({
          segments: [
            {
              id: 'seg-1',
              name: 'Ниша',
              length: 1,
              width: 0.5,
              operation: 'subtract',
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithSegment, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeSegment('seg-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithSegment);
        expect(updatedRoom.segments).toHaveLength(0);
      });

      it('should update segment field', () => {
        const roomWithSegment = createMockRoom({
          segments: [
            {
              id: 'seg-1',
              name: 'Ниша',
              length: 1,
              width: 0.5,
              operation: 'subtract',
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithSegment, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSegment('seg-1', 'length', 2);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithSegment);
        expect(updatedRoom.segments[0].length).toBe(2);
      });

      it('should update advancedModeData when in advanced mode', () => {
        const advancedRoom = createMockRoom({
          geometryMode: 'advanced',
          segments: [
            {
              id: 'seg-1',
              name: 'Ниша',
              length: 1,
              width: 0.5,
              operation: 'subtract',
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(advancedRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateSegment('seg-1', 'length', 2);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(advancedRoom);
        expect(updatedRoom.advancedModeData?.segments[0].length).toBe(2);
      });
    });

    describe('Obstacle handlers', () => {
      it('should add a new obstacle', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addObstacle();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.obstacles).toHaveLength(1);
        expect(updatedRoom.obstacles[0].name).toBe('Колонна');
        expect(updatedRoom.obstacles[0].type).toBe('column');
      });

      it('should remove an obstacle', () => {
        const roomWithObstacle = createMockRoom({
          obstacles: [
            {
              id: 'obs-1',
              name: 'Колонна',
              type: 'column',
              area: 0.25,
              perimeter: 2,
              operation: 'subtract',
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithObstacle, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeObstacle('obs-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithObstacle);
        expect(updatedRoom.obstacles).toHaveLength(0);
      });

      it('should update obstacle field', () => {
        const roomWithObstacle = createMockRoom({
          obstacles: [
            {
              id: 'obs-1',
              name: 'Колонна',
              type: 'column',
              area: 0.25,
              perimeter: 2,
              operation: 'subtract',
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithObstacle, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateObstacle('obs-1', 'area', 0.5);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithObstacle);
        expect(updatedRoom.obstacles[0].area).toBe(0.5);
      });
    });

    describe('WallSection handlers', () => {
      it('should add a new wall section', () => {
        const { result } = renderHook(() =>
          useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.addWallSection();
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(mockRoom);
        expect(updatedRoom.wallSections).toHaveLength(1);
        expect(updatedRoom.wallSections[0].name).toBe('Участок с перепадом');
      });

      it('should remove a wall section', () => {
        const roomWithWallSection = createMockRoom({
          wallSections: [
            {
              id: 'ws-1',
              name: 'Участок с перепадом',
              length: 1,
              height: 3,
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWallSection, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.removeWallSection('ws-1');
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWallSection);
        expect(updatedRoom.wallSections).toHaveLength(0);
      });

      it('should update wall section field', () => {
        const roomWithWallSection = createMockRoom({
          wallSections: [
            {
              id: 'ws-1',
              name: 'Участок с перепадом',
              length: 1,
              height: 3,
            },
          ],
        });

        const { result } = renderHook(() =>
          useGeometryState(roomWithWallSection, mockUpdateRoom, mockUpdateRoomById)
        );

        act(() => {
          result.current.updateWallSection('ws-1', 'height', 3.5);
        });

        const updater = mockUpdateRoomById.mock.calls[0][1];
        const updatedRoom = updater(roomWithWallSection);
        expect(updatedRoom.wallSections[0].height).toBe(3.5);
      });
    });
  });

  // ============================================
  // Mode Switching Tests
  // ============================================
  describe('handleGeometryModeChange', () => {
    it('should return same room if mode is the same', () => {
      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('simple');
      });

      // updateRoomById вызывается, но должен вернуть ту же комнату без изменений
      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(mockRoom);
      expect(updatedRoom).toBe(mockRoom);
    });

    it('should change mode from simple to extended', () => {
      const { result } = renderHook(() =>
        useGeometryState(mockRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('extended');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(mockRoom);
      expect(updatedRoom.geometryMode).toBe('extended');
    });

    it('should save simpleModeData when switching from simple mode', () => {
      const roomWithData = createMockRoom({
        length: 5,
        width: 4,
        windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
        doors: [],
      });

      const { result } = renderHook(() =>
        useGeometryState(roomWithData, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('extended');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(roomWithData);
      expect(updatedRoom.simpleModeData).toBeDefined();
      expect(updatedRoom.simpleModeData?.length).toBe(5);
      expect(updatedRoom.simpleModeData?.width).toBe(4);
      expect(updatedRoom.simpleModeData?.windows).toHaveLength(1);
    });

    it('should restore simpleModeData when switching back to simple mode', () => {
      const roomWithSavedData = createMockRoom({
        geometryMode: 'extended',
        simpleModeData: {
          length: 6,
          width: 5,
          windows: [{ id: 'win-1', width: 2, height: 1.5, comment: '' }],
          doors: [],
        },
        subSections: [
          {
            id: 'sub-1',
            name: 'Section 1',
            shape: 'rectangle',
            length: 3,
            width: 2,
            windows: [],
            doors: [],
          },
        ],
      });

      const { result } = renderHook(() =>
        useGeometryState(roomWithSavedData, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('simple');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(roomWithSavedData);
      expect(updatedRoom.geometryMode).toBe('simple');
      expect(updatedRoom.length).toBe(6);
      expect(updatedRoom.width).toBe(5);
      expect(updatedRoom.windows).toHaveLength(1);
    });

    it('should save extendedModeData when switching from extended mode', () => {
      const extendedRoom = createMockRoom({
        geometryMode: 'extended',
        subSections: [
          {
            id: 'sub-1',
            name: 'Section 1',
            shape: 'rectangle',
            length: 3,
            width: 2,
            windows: [],
            doors: [],
          },
        ],
      });

      const { result } = renderHook(() =>
        useGeometryState(extendedRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('simple');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(extendedRoom);
      expect(updatedRoom.extendedModeData).toBeDefined();
      expect(updatedRoom.extendedModeData?.subSections).toHaveLength(1);
    });

    it('should save advancedModeData when switching from advanced mode', () => {
      const advancedRoom = createMockRoom({
        geometryMode: 'advanced',
        segments: [
          {
            id: 'seg-1',
            name: 'Ниша',
            length: 1,
            width: 0.5,
            operation: 'subtract',
          },
        ],
        obstacles: [],
        wallSections: [],
      });

      const { result } = renderHook(() =>
        useGeometryState(advancedRoom, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('simple');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(advancedRoom);
      expect(updatedRoom.advancedModeData).toBeDefined();
      expect(updatedRoom.advancedModeData?.segments).toHaveLength(1);
    });

    it('should restore advancedModeData when switching to advanced mode', () => {
      const roomWithSavedAdvanced = createMockRoom({
        geometryMode: 'simple',
        advancedModeData: {
          segments: [
            {
              id: 'seg-1',
              name: 'Ниша',
              length: 1,
              width: 0.5,
              operation: 'subtract',
            },
          ],
          obstacles: [
            {
              id: 'obs-1',
              name: 'Колонна',
              type: 'column',
              area: 0.25,
              perimeter: 2,
              operation: 'subtract',
            },
          ],
          wallSections: [],
        },
      });

      const { result } = renderHook(() =>
        useGeometryState(roomWithSavedAdvanced, mockUpdateRoom, mockUpdateRoomById)
      );

      act(() => {
        result.current.handleGeometryModeChange('advanced');
      });

      const updater = mockUpdateRoomById.mock.calls[0][1];
      const updatedRoom = updater(roomWithSavedAdvanced);
      expect(updatedRoom.geometryMode).toBe('advanced');
      expect(updatedRoom.segments).toHaveLength(1);
      expect(updatedRoom.obstacles).toHaveLength(1);
    });
  });
});