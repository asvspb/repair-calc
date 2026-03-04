import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects } from '../../src/hooks/useProjects';
import { StorageManager } from '../../src/utils/storage';
import type { ProjectData, RoomData } from '../../src/types';

// Mock StorageManager
vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    loadProjects: vi.fn(),
    loadActiveProject: vi.fn(),
    saveProjects: vi.fn(),
    saveActiveProject: vi.fn(),
  },
}));

// Mock window.addEventListener
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
window.addEventListener = mockAddEventListener;
window.removeEventListener = mockRemoveEventListener;

// Mock setTimeout/clearTimeout for debounce
vi.useFakeTimers();

describe('useProjects', () => {
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

  const initialProjects = [createTestProject('p1', 'Project 1')];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (StorageManager.loadActiveProject as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should use initial projects when no saved data', () => {
      const { result } = renderHook(() => useProjects(initialProjects));

      expect(result.current.projects).toEqual(initialProjects);
      expect(result.current.activeProjectId).toBe('p1');
      expect(result.current.isLoading).toBe(false);
    });

    it('should load saved projects on mount', () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue(savedProjects);
      (StorageManager.loadActiveProject as ReturnType<typeof vi.fn>).mockReturnValue('saved-1');

      const { result } = renderHook(() => useProjects(initialProjects));

      expect(result.current.projects).toEqual(savedProjects);
      expect(result.current.activeProjectId).toBe('saved-1');
    });

    it('should migrate rooms with missing fields', () => {
      const partialRoom = {
        id: 'room-1',
        name: 'Partial Room',
        length: 5,
        width: 4,
        height: 3,
        geometryMode: 'simple' as const,
        // Missing: segments, obstacles, wallSections, etc.
      };
      const partialProject: ProjectData = {
        id: 'p1',
        name: 'Partial Project',
        rooms: [partialRoom as RoomData],
      };
      (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue([partialProject]);

      const { result } = renderHook(() => useProjects(initialProjects));

      const migratedRoom = result.current.projects[0].rooms[0];
      expect(migratedRoom.segments).toEqual([]);
      expect(migratedRoom.obstacles).toEqual([]);
      expect(migratedRoom.wallSections).toEqual([]);
      expect(migratedRoom.subSections).toEqual([]);
      expect(migratedRoom.windows).toEqual([]);
      expect(migratedRoom.doors).toEqual([]);
      expect(migratedRoom.works).toEqual([]);
    });

    it('should reset to first project if saved active project not found', () => {
      const savedProjects = [createTestProject('saved-1', 'Saved Project')];
      (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockReturnValue(savedProjects);
      (StorageManager.loadActiveProject as ReturnType<typeof vi.fn>).mockReturnValue('non-existent');

      const { result } = renderHook(() => useProjects(initialProjects));

      expect(result.current.activeProjectId).toBe('saved-1');
    });

    it('should handle load error', () => {
      (StorageManager.loadProjects as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Load error');
      });

      const { result } = renderHook(() => useProjects(initialProjects));

      expect(result.current.error).toEqual({
        type: 'unknown',
        message: 'Ошибка загрузки данных',
      });
    });
  });

  describe('setActiveProjectId', () => {
    it('should update active project id and save', () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjects(projects));

      act(() => {
        result.current.setActiveProjectId('p2');
      });

      expect(result.current.activeProjectId).toBe('p2');
      expect(StorageManager.saveActiveProject).toHaveBeenCalledWith('p2');
    });
  });

  describe('updateProjects', () => {
    it('should update projects and schedule save', () => {
      const { result } = renderHook(() => useProjects(initialProjects));

      const newProjects = [createTestProject('p2', 'New Project')];

      act(() => {
        result.current.updateProjects(newProjects);
      });

      expect(result.current.projects).toEqual(newProjects);

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(StorageManager.saveProjects).toHaveBeenCalledWith(newProjects);
    });

    it('should debounce multiple updates', () => {
      const { result } = renderHook(() => useProjects(initialProjects));

      act(() => {
        result.current.updateProjects([createTestProject('p2', 'Update 1')]);
        result.current.updateProjects([createTestProject('p3', 'Update 2')]);
        result.current.updateProjects([createTestProject('p4', 'Update 3')]);
      });

      // Should not save yet
      expect(StorageManager.saveProjects).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should save only once with last value
      expect(StorageManager.saveProjects).toHaveBeenCalledTimes(1);
      expect(StorageManager.saveProjects).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p4', name: 'Update 3' }),
      ]);
    });

    it('should set lastSaved after successful save', () => {
      const { result } = renderHook(() => useProjects(initialProjects));

      expect(result.current.lastSaved).toBeNull();

      act(() => {
        result.current.updateProjects([createTestProject('p2', 'New')]);
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.lastSaved).toBeInstanceOf(Date);
      expect(result.current.saveError).toBeNull();
    });

    it('should set saveError on save failure', () => {
      (StorageManager.saveProjects as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw { type: 'quota_exceeded', message: 'Storage full' };
      });

      const { result } = renderHook(() => useProjects(initialProjects));

      act(() => {
        result.current.updateProjects([createTestProject('p2', 'New')]);
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe('Storage full');
    });
  });

  describe('updateActiveProject', () => {
    it('should update only active project', () => {
      const projects = [
        createTestProject('p1', 'Project 1'),
        createTestProject('p2', 'Project 2'),
      ];
      const { result } = renderHook(() => useProjects(projects));

      const updatedProject = {
        ...projects[0],
        name: 'Updated Project 1',
      };

      act(() => {
        result.current.updateActiveProject(updatedProject);
      });

      expect(result.current.projects[0].name).toBe('Updated Project 1');
      expect(result.current.projects[1].name).toBe('Project 2');
    });

    it('should use functional update to avoid stale closure', () => {
      const { result } = renderHook(() => useProjects(initialProjects));

      // Simulate rapid updates
      act(() => {
        result.current.updateActiveProject({ ...initialProjects[0], name: 'Update 1' });
        result.current.updateActiveProject({ ...initialProjects[0], name: 'Update 2' });
        result.current.updateActiveProject({ ...initialProjects[0], name: 'Update 3' });
      });

      expect(result.current.projects[0].name).toBe('Update 3');
    });
  });

  describe('beforeunload handler', () => {
    it('should save pending changes on beforeunload', () => {
      renderHook(() => useProjects(initialProjects));

      // Find the beforeunload handler
      const beforeUnloadHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'beforeunload'
      )?.[1];

      expect(beforeUnloadHandler).toBeDefined();
    });

    it('should cleanup event listener on unmount', () => {
      const { unmount } = renderHook(() => useProjects(initialProjects));

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });
  });
});