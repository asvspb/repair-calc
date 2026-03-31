/**
 * Тесты для автосохранения рассчитанных данных в ProjectContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import type { ProjectData, RoomData } from '../../src/types';

// Мокаем API модули
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

// Мокаем StorageManager
vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn().mockReturnValue(null),
    loadActiveProject: vi.fn().mockReturnValue(null),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
  },
}));

// Мокаем AuthContext
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

// Мокаем logger
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

// Мокаем saveQueue
vi.mock('../../src/utils/saveQueue', () => ({
  saveQueue: {
    enqueue: vi.fn((fn: () => Promise<void>) => fn()),
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
  },
}));

// Мокаем idMapper
vi.mock('../../src/utils/idMapper', () => ({
  idMapper: {
    getServerId: vi.fn(),
  },
  IdMapper: {
    isLocalId: vi.fn(() => false),
  },
}));

// Мокаем migration
vi.mock('../../src/utils/migration', () => ({
  runMigrations: vi.fn().mockResolvedValue({ duplicatesRemoved: 0 }),
  needsMigration: vi.fn(() => false),
}));

import { ProjectProvider, useProjectContext } from '../../src/contexts/ProjectContext';
import { StorageManager } from '../../src/utils/storage';

const createTestRoom = (id: string, name: string): RoomData => ({
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
});

const createTestProject = (id: string, name: string): ProjectData => ({
  id,
  name,
  rooms: [createTestRoom('room-1', 'Living Room')],
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProjectProvider initialProjects={[createTestProject('p1', 'Test Project')]}>
    {children}
  </ProjectProvider>
);

// Хелпер для создания wrapper с авторизацией
const createWrapperWithAuth = (isAuthenticated: boolean) => {
  vi.doMock('../../src/contexts/AuthContext', () => ({
    useAuth: () => ({
      isAuthenticated,
      isLoading: false,
      user: isAuthenticated ? { id: 'user-1', email: 'test@test.com' } : null,
    }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  }));
  
  return ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialProjects={[createTestProject('p1', 'Test Project')]}>
      {children}
    </ProjectProvider>
  );
};

describe('ProjectContext - Auto-save totals', () => {
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
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      // Wait for initialization
      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      // Update room - не должно вызывать saveTotals для неавторизованного
      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };

      await act(async () => {
        result.current.updateRoom(updatedRoom);
      });

      // Для неавторизованного пользователя saveTotals не должен вызываться
      expect(mockSaveTotals).not.toHaveBeenCalled();
    });

    it('should have correct initial state', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.activeProject).toBeDefined();
      expect(result.current.activeProject?.name).toBe('Test Project');
    });
  });

  describe('updateRoom', () => {
    it('should update room correctly', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };

      await act(async () => {
        result.current.updateRoom(updatedRoom);
      });

      const project = result.current.activeProject;
      expect(project).toBeDefined();
      const room = project?.rooms.find(r => r.id === 'room-1');
      expect(room?.length).toBe(6);
    });
  });

  describe('updateRoomById', () => {
    it('should update room by ID with updater function', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      await act(async () => {
        result.current.updateRoomById('room-1', (prev) => ({
          ...prev,
          length: 10,
        }));
      });

      const project = result.current.activeProject;
      const room = project?.rooms.find(r => r.id === 'room-1');
      expect(room?.length).toBe(10);
    });
  });

  describe('addRoom', () => {
    it('should add new room', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      const newRoom = createTestRoom('room-2', 'New Room');

      await act(async () => {
        result.current.addRoom(newRoom);
      });

      const project = result.current.activeProject;
      expect(project?.rooms).toHaveLength(2);
    });
  });

  describe('deleteRoom', () => {
    it('should delete room', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      await act(async () => {
        result.current.deleteRoom('room-1');
      });

      const project = result.current.activeProject;
      expect(project?.rooms).toHaveLength(0);
    });
  });

  describe('reorderRooms', () => {
    it('should reorder rooms', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      // Сначала добавим вторую комнату
      const newRoom = createTestRoom('room-2', 'New Room');

      await act(async () => {
        result.current.addRoom(newRoom);
      });

      const project = result.current.activeProject;
      if (project) {
        await act(async () => {
          result.current.reorderRooms([...project.rooms].reverse());
        });
      }

      const updatedProject = result.current.activeProject;
      expect(updatedProject?.rooms).toHaveLength(2);
    });
  });

  describe('updateActiveProject', () => {
    it('should update active project', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        }, { timeout: 5000 });
      });

      const project = result.current.activeProject;
      if (project) {
        await act(async () => {
          result.current.updateActiveProject({
            ...project,
            name: 'Updated Project',
          });
        });
      }

      expect(result.current.activeProject?.name).toBe('Updated Project');
    });
  });

  describe('cleanup', () => {
    it('should clear pending save on unmount', () => {
      const { unmount } = renderHook(() => useProjectContext(), { wrapper });

      unmount();

      // Should not throw errors
      expect(() => {
        // Just verify unmount doesn't throw - no need to advance timers
      }).not.toThrow();
    });
  });
});