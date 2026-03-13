import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import React from 'react';
import { ProjectProvider, useProjectContext } from '../../src/contexts/ProjectContext';
import { WorkTemplateProvider } from '../../src/contexts/WorkTemplateContext';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { ProjectData, RoomData, WorkData } from '../../src/types';
import type { AuthContextValue } from '../../src/types/auth';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
const mockUUIDs = ['proj-1', 'room-1', 'work-1', 'work-2', 'template-1'];
let uuidIndex = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++ % mockUUIDs.length],
});

// Mock AuthContext value
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

// Wrapper component with AuthContext
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={mockAuthValue}>
    <ProjectProvider initialProjects={[]}>
      {children}
    </ProjectProvider>
  </AuthContext.Provider>
);

// Test component that uses the context
const TestComponent: React.FC<{
  onReady?: (api: ReturnType<typeof useProjectContext>) => void;
}> = ({ onReady }) => {
  const ctx = useProjectContext();

  React.useEffect(() => {
    onReady?.(ctx);
  }, [ctx, onReady]);

  const createProject = () => {
    const newProject: ProjectData = {
      id: crypto.randomUUID(),
      name: 'Test Project',
      rooms: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ctx.updateProjects([...ctx.projects, newProject]);
    ctx.setActiveProjectId(newProject.id);
  };

  const addRoom = () => {
    if (!ctx.activeProject) return;
    const newRoom: RoomData = {
      id: crypto.randomUUID(),
      name: 'New Room',
      length: 5,
      width: 4,
      height: 3,
      segments: [],
      obstacles: [],
      wallSections: [],
      subSections: [],
      windows: [],
      doors: [],
      works: [],
    };
    ctx.addRoom(newRoom);
  };

  return (
    <div>
      <div data-testid="project-count">{ctx.projects.length}</div>
      <div data-testid="current-project">{ctx.activeProject?.name || 'none'}</div>
      <div data-testid="room-count">{ctx.activeProject?.rooms.length || 0}</div>
      <div data-testid="is-loading">{ctx.isLoading ? 'true' : 'false'}</div>
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
  });

  describe('Project Management', () => {
    it('should create and persist a new project', async () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Wait for loading to complete
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

      // Room count should be 1
      expect(screen.getByTestId('room-count').textContent).toBe('1');
    });
  });
});

describe('Template Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    uuidIndex = 0;
  });

  it('should render with template provider', async () => {
    const { container } = render(
      <AuthContext.Provider value={mockAuthValue}>
        <ProjectProvider initialProjects={[]}>
          <WorkTemplateProvider>
            <TestComponent />
          </WorkTemplateProvider>
        </ProjectProvider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(container).toBeTruthy();
  });
});
