import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { WorkTemplateProvider } from '../../src/contexts/WorkTemplateContext';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { RoomData, RoomSubSection } from '../../src/types';
import type { AuthContextValue } from '../../src/types/auth';
import { createNewProject, createNewRoom } from '../../src/utils/factories';

vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn(() => null),
    loadActiveProject: vi.fn(() => null),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
    saveProject: vi.fn(),
  },
}));

vi.mock('../../src/api/storage', () => ({
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

vi.mock('../../src/api/totals', () => ({ saveTotals: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
  logUserAction: vi.fn(), logSuccess: vi.fn(), logError: vi.fn(),
  logStart: vi.fn(() => Date.now()), logEnd: vi.fn(), logStateChange: vi.fn(),
  logWarning: vi.fn(), logDebug: vi.fn(),
}));
vi.mock('../../src/utils/migration', () => ({ runMigrations: vi.fn(), needsMigration: vi.fn(() => false) }));
vi.mock('../../src/utils/idMapper', () => ({
  idMapper: { getServerId: vi.fn(), addMapping: vi.fn(), clear: vi.fn() },
  IdMapper: { isServerId: vi.fn(), isLocalId: vi.fn() },
  isServerId: vi.fn(),
}));
vi.mock('../../src/utils/saveQueue', () => ({
  saveQueue: { enqueue: vi.fn((task: () => Promise<void>) => task()), hasPendingData: false, getPendingData: vi.fn() },
}));
vi.mock('../../src/utils/geometry', () => ({ calculateRoomMetrics: vi.fn(() => ({ floorArea: 0 })) }));
vi.mock('../../src/utils/costs', () => ({ calculateRoomCosts: vi.fn(() => ({ totalWork: 0, totalMaterial: 0, totalTools: 0 })) }));

const TEST_PROJECTS = [
  {
    ...createNewProject(),
    name: 'Test Project',
  }
];

const mockAuthValue: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      <WorkTemplateProvider>
        {children}
      </WorkTemplateProvider>
    </AuthContext.Provider>
  );
}

describe('Extended Mode - Section Dimensions Data Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  const createExtendedRoom = (): RoomData => ({
    ...createNewRoom(),
    name: 'Test Room',
    geometryMode: 'extended',
    subSections: [],
    extendedModeData: {
      subSections: []
    }
  });

  async function initStore() {
    await useProjectStore.getState().initialize(TEST_PROJECTS, false);
  }

  it('should preserve dimensions when adding second section', async () => {
    await initStore();

    const room = createExtendedRoom();
    useProjectStore.getState().addRoom(room);

    const roomId = useProjectStore.getState().activeProject?.objects?.[0]?.rooms[0].id;
    expect(roomId).toBeDefined();

    const section1: RoomSubSection = {
      id: 's1',
      name: 'Section 1',
      shape: 'rectangle',
      length: 5,
      width: 4,
      windows: [],
      doors: [],
    };

    const currentRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom) {
      useProjectStore.getState().updateRoom({ ...currentRoom, subSections: [section1] });
    }

    let updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].length).toBe(5);
    expect(updatedRoom?.subSections[0].width).toBe(4);

    const section2: RoomSubSection = {
      id: 's2',
      name: 'Section 2',
      shape: 'rectangle',
      length: 3,
      width: 3,
      windows: [],
      doors: [],
    };

    const currentRoom2 = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom2) {
      useProjectStore.getState().updateRoom({
        ...currentRoom2,
        subSections: [section1, section2]
      });
    }

    updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);

    expect(updatedRoom?.subSections[0].length).toBe(5);
    expect(updatedRoom?.subSections[0].width).toBe(4);
    expect(updatedRoom?.subSections[1].length).toBe(3);
    expect(updatedRoom?.subSections[1].width).toBe(3);
  });

  it('should preserve trapezoid dimensions when updating another section', async () => {
    await initStore();

    const room = createExtendedRoom();
    useProjectStore.getState().addRoom(room);

    const roomId = useProjectStore.getState().activeProject?.objects?.[0]?.rooms[0].id!;

    const section1: RoomSubSection = {
      id: 's1', name: 'Trapezoid 1', shape: 'trapezoid',
      base1: 6, base2: 4, depth: 5, side1: 5, side2: 5,
      length: 0, width: 0, windows: [], doors: [],
    };

    const section2: RoomSubSection = {
      id: 's2', name: 'Trapezoid 2', shape: 'trapezoid',
      base1: 8, base2: 6, depth: 4, side1: 6, side2: 6,
      length: 0, width: 0, windows: [], doors: [],
    };

    const currentRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom) {
      useProjectStore.getState().updateRoom({ ...currentRoom, subSections: [section1, section2] });
    }

    let updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].base1).toBe(6);
    expect(updatedRoom?.subSections[0].base2).toBe(4);
    expect(updatedRoom?.subSections[0].depth).toBe(5);
    expect(updatedRoom?.subSections[1].base1).toBe(8);
    expect(updatedRoom?.subSections[1].base2).toBe(6);
    expect(updatedRoom?.subSections[1].depth).toBe(4);

    const updatedSection1 = { ...section1, base1: 10 };
    const currentRoom2 = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom2) {
      useProjectStore.getState().updateRoom({
        ...currentRoom2,
        subSections: [updatedSection1, section2]
      });
    }

    updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].base1).toBe(10);
    expect(updatedRoom?.subSections[1].base1).toBe(8);
    expect(updatedRoom?.subSections[1].base2).toBe(6);
    expect(updatedRoom?.subSections[1].depth).toBe(4);
  });

  it('should handle shape change without losing data', async () => {
    await initStore();

    const room = createExtendedRoom();
    useProjectStore.getState().addRoom(room);

    const roomId = useProjectStore.getState().activeProject?.objects?.[0]?.rooms[0].id!;

    const section: RoomSubSection = {
      id: 's1', name: 'Section', shape: 'rectangle',
      length: 5, width: 4, windows: [], doors: [],
    };

    const currentRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom) {
      useProjectStore.getState().updateRoom({ ...currentRoom, subSections: [section] });
    }

    let updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].shape).toBe('rectangle');
    expect(updatedRoom?.subSections[0].length).toBe(5);

    const updatedSection = {
      ...section,
      shape: 'trapezoid' as const,
      base1: 6, base2: 4, depth: 5, side1: 5, side2: 5,
    };

    const currentRoom2 = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    if (currentRoom2) {
      useProjectStore.getState().updateRoom({
        ...currentRoom2,
        subSections: [updatedSection]
      });
    }

    updatedRoom = useProjectStore.getState().activeProject?.objects?.[0]?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].shape).toBe('trapezoid');
    expect(updatedRoom?.subSections[0].base1).toBe(6);
    expect(updatedRoom?.subSections[0].base2).toBe(4);
    expect(updatedRoom?.subSections[0].depth).toBe(5);
  });
});
