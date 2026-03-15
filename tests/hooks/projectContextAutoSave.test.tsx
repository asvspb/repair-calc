/**
 * Тесты для автосохранения рассчитанных данных в ProjectContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ProjectProvider, useProjectContext } from '../../src/contexts/ProjectContext';
import { AuthProvider } from '../../src/contexts/AuthContext';
import type { ProjectData, RoomData } from '../../src/types';

// Мокаем API модули
vi.mock('../../src/api/totals', () => ({
  saveTotals: vi.fn(),
}));

vi.mock('../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      loadProjectsAsync: vi.fn().mockResolvedValue([]),
      saveProjectsAsync: vi.fn().mockResolvedValue(undefined),
    })),
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

import { saveTotals } from '../../src/api/totals';
import { StorageManager } from '../../src/utils/storage';

// Мокаем setTimeout/clearTimeout для debounce
vi.useFakeTimers();

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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <ProjectProvider initialProjects={[createTestProject('p1', 'Test Project')]}>
      {children}
    </ProjectProvider>
  </AuthProvider>
);

describe('ProjectContext - Auto-save totals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (StorageManager.loadActiveProject as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (saveTotals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('saveCalculatedTotals', () => {
    it('should calculate and save totals when room is updated', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      // Wait for initialization
      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      // Update room
      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
        width: 5,
      };

      await act(async () => {
        result.current.updateRoom(updatedRoom);
      });

      // Fast-forward debounce timer (2 seconds)
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Verify saveTotals was called
      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });

      const callArgs = (saveTotals as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe('p1');
      expect(callArgs[1]).toHaveProperty('total_area');
      expect(callArgs[1]).toHaveProperty('total_works');
      expect(callArgs[1]).toHaveProperty('total_materials');
      expect(callArgs[1]).toHaveProperty('total_tools');
      expect(callArgs[1]).toHaveProperty('grand_total');
    });

    it('should not save totals for unauthenticated user', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };

      await act(async () => {
        result.current.updateRoom(updatedRoom);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // For unauthenticated user, saveTotals should not be called
      expect(saveTotals).not.toHaveBeenCalled();
    });

    it('should set error state if save fails', async () => {
      (saveTotals as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      // Mock authenticated user by setting token
      localStorage.setItem('token', 'test-token');

      const updatedRoom: RoomData = {
        ...createTestRoom('room-1', 'Living Room'),
        length: 6,
      };

      await act(async () => {
        result.current.updateRoom(updatedRoom);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.totalsSaveError).toBe('Network error');
      });
    });
  });

  describe('scheduleTotalsSave debounce', () => {
    it('should debounce multiple rapid updates', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      // Multiple rapid updates
      await act(async () => {
        result.current.updateRoom({
          ...createTestRoom('room-1', 'Living Room'),
          length: 5,
        });
        result.current.updateRoom({
          ...createTestRoom('room-1', 'Living Room'),
          length: 6,
        });
        result.current.updateRoom({
          ...createTestRoom('room-1', 'Living Room'),
          length: 7,
        });
      });

      // Fast-forward only 1 second (should not trigger yet)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(saveTotals).not.toHaveBeenCalled();

      // Fast-forward remaining time
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should only be called once for the last update
      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalledTimes(1);
      });
    });

    it('should cancel previous timer on new update', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      // First update
      await act(async () => {
        result.current.updateRoom({
          ...createTestRoom('room-1', 'Living Room'),
          length: 5,
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Second update before first timer completes
      await act(async () => {
        result.current.updateRoom({
          ...createTestRoom('room-1', 'Living Room'),
          length: 6,
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Should only be called once for the second update
      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('updateActiveProject', () => {
    it('should trigger totals save when project is updated', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
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

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });
  });

  describe('updateRoomById', () => {
    it('should trigger totals save when room is updated by ID', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.updateRoomById('room-1', (prev) => ({
          ...prev,
          length: 6,
        }));
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });
  });

  describe('addRoom', () => {
    it('should trigger totals save when room is added', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      const newRoom = createTestRoom('room-2', 'New Room');

      await act(async () => {
        result.current.addRoom(newRoom);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });
  });

  describe('deleteRoom', () => {
    it('should trigger totals save when room is deleted', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.deleteRoom('room-1');
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });
  });

  describe('reorderRooms', () => {
    it('should trigger totals save when rooms are reordered', async () => {
      localStorage.setItem('token', 'test-token');

      const { result } = renderHook(() => useProjectContext(), { wrapper });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      const project = result.current.activeProject;
      if (project) {
        await act(async () => {
          result.current.reorderRooms([...project.rooms].reverse());
        });
      }

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(saveTotals).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('should clear pending save on unmount', () => {
      localStorage.setItem('token', 'test-token');

      const { unmount } = renderHook(() => useProjectContext(), { wrapper });

      unmount();

      // Should not throw errors
      expect(() => {
        vi.advanceTimersByTime(2000);
      }).not.toThrow();
    });
  });
});
