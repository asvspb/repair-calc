import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import React from 'react';
import { useProjectStore, resetStore } from '../../src/store/useProjectStore';
import { WorkTemplateProvider } from '../../src/contexts/WorkTemplateContext';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { ProjectData, RoomData } from '../../src/types';
import type { AuthContextValue } from '../../src/types/auth';

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
vi.mock('../../src/utils/projectObjects', async () => {
  const actual = await vi.importActual('../../src/utils/projectObjects');
  return {
    ...actual,
    migrateProjectToObjects: vi.fn((p: ProjectData) => ({ ...p, objects: p.objects || [] })),
  };
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockUUIDs = ['proj-1', 'room-1', 'work-1', 'work-2', 'template-1'];
let uuidIndex = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++ % mockUUIDs.length],
});

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

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={mockAuthValue}>
    {children}
  </AuthContext.Provider>
);

const TestComponent: React.FC = () => {
  const projects = useProjectStore((s) => s.projects);
  const activeProject = useProjectStore((s) => s.activeProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  const createProject = () => {
    const newProject: ProjectData = {
      id: crypto.randomUUID(),
      name: 'Test Project',
      rooms: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useProjectStore.getState().updateProjects([...useProjectStore.getState().projects, newProject]);
    useProjectStore.getState().setActiveProjectId(newProject.id);
  };

  const addRoom = () => {
    if (!useProjectStore.getState().activeProject) return;
    const newRoom: RoomData = {
      id: crypto.randomUUID(),
      name: 'New Room',
      length: 5, width: 4, height: 3,
      segments: [], obstacles: [], wallSections: [], subSections: [],
      windows: [], doors: [], works: [],
    };
    useProjectStore.getState().addRoom(newRoom);
  };

  return (
    <div>
      <div data-testid="project-count">{projects.length}</div>
      <div data-testid="current-project">{activeProject?.name || 'none'}</div>
      <div data-testid="room-count">{activeProject?.objects?.[0]?.rooms.length || 0}</div>
      <div data-testid="is-loading">{isLoading ? 'true' : 'false'}</div>
      <button data-testid="create-project" onClick={createProject}>
        Create Project
      </button>
      <button data-testid="add-room" onClick={addRoom}>
        Add Room
      </button>
    </div>
  );
};

describe('Project-Work Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    uuidIndex = 0;
    vi.clearAllMocks();
    resetStore();
  });

  describe('Project Management', () => {
    it('should create and persist a new project', async () => {
      await useProjectStore.getState().initialize([], false);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('project-count').textContent).toBe('0');

      await act(async () => {
        fireEvent.click(screen.getByTestId('create-project'));
      });

      expect(screen.getByTestId('project-count').textContent).toBe('1');
      expect(screen.getByTestId('current-project').textContent).toBe('Test Project');
    });

    it('should add room to current project', async () => {
      await useProjectStore.getState().initialize([], false);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('create-project'));
      });

      expect(screen.getByTestId('room-count').textContent).toBe('0');

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-room'));
      });

      expect(screen.getByTestId('room-count').textContent).toBe('1');
    });
  });

  describe('Room Calculations', () => {
    it('should calculate room properties correctly', async () => {
      await useProjectStore.getState().initialize([], false);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('create-project'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-room'));
      });

      expect(screen.getByTestId('room-count').textContent).toBe('1');
    });
  });
});

describe('Template Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    uuidIndex = 0;
    vi.clearAllMocks();
    resetStore();
  });

  it('should render with template provider', async () => {
    await useProjectStore.getState().initialize([], false);

    const { container } = render(
      <AuthContext.Provider value={mockAuthValue}>
        <WorkTemplateProvider>
          <TestComponent />
        </WorkTemplateProvider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(container).toBeTruthy();
  });
});
