import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useObjectDomain } from '../../../src/hooks/domains/useObjectDomain';
import type { ObjectData, ProjectData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logStateChange: vi.fn(),
  logWarning: vi.fn(),
}));

function createTestObject(id: string, name: string, rooms: unknown[] = []): ObjectData {
  return {
    id,
    projectId: 'p1',
    name,
    rooms: rooms as ObjectData['rooms'],
    sortOrder: 0,
  };
}

function createTestProject(id: string, objects: ObjectData[] = []): ProjectData {
  return {
    id,
    name: 'Test Project',
    objects,
  };
}

function createDefaultDeps(overrides: Partial<{
  activeProject: ProjectData | null;
  updateActiveProject: (project: ProjectData) => void;
}> = {}) {
  const updateActiveProject = vi.fn();

  const obj1 = createTestObject('obj-1', 'Object 1');
  const obj2 = createTestObject('obj-2', 'Object 2');
  const activeProject = overrides.activeProject !== undefined
    ? overrides.activeProject
    : createTestProject('p1', [obj1, obj2]);

  return {
    activeProject,
    updateActiveProject,
  };
}

describe('useObjectDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return null activeObject when no activeObjectId set and no objects', () => {
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', []),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      expect(result.current.activeObjectId).toBeNull();
      expect(result.current.activeObject).toBeNull();
    });

    it('should default to first object when no activeObjectId set', () => {
      const obj1 = createTestObject('obj-1', 'First');
      const obj2 = createTestObject('obj-2', 'Second');
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', [obj1, obj2]),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      expect(result.current.activeObjectId).toBeNull();
      expect(result.current.activeObject).toBeDefined();
      expect(result.current.activeObject!.id).toBe('obj-1');
    });

    it('should return null activeObject when no activeProject', () => {
      const updateActiveProject = vi.fn();
      const { result } = renderHook(() =>
        useObjectDomain({ activeProject: null, updateActiveProject })
      );

      expect(result.current.activeObject).toBeNull();
    });
  });

  describe('setActiveObjectId', () => {
    it('should update active object id', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.setActiveObjectId('obj-2');
      });

      expect(result.current.activeObjectId).toBe('obj-2');
    });

    it('should set to null', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.setActiveObjectId(null);
      });

      expect(result.current.activeObjectId).toBeNull();
    });

    it('should update activeObject when id is set', () => {
      const obj1 = createTestObject('obj-1', 'First');
      const obj2 = createTestObject('obj-2', 'Second');
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', [obj1, obj2]),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.setActiveObjectId('obj-2');
      });

      expect(result.current.activeObject!.id).toBe('obj-2');
      expect(result.current.activeObject!.name).toBe('Second');
    });
  });

  describe('createObject', () => {
    it('should create a new object in active project', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      let newId: string = '';
      act(() => {
        newId = result.current.createObject({ name: 'New Object', city: 'Moscow' });
      });

      expect(newId).toBeTruthy();
      expect(result.current.activeObjectId).toBe(newId);
      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({ name: 'New Object' }),
          ]),
        })
      );
    });

    it('should return empty string when no active project', () => {
      const updateActiveProject = vi.fn();
      const { result } = renderHook(() =>
        useObjectDomain({ activeProject: null, updateActiveProject })
      );

      let newId: string = '';
      act(() => {
        newId = result.current.createObject({ name: 'Test' });
      });

      expect(newId).toBe('');
      expect(updateActiveProject).not.toHaveBeenCalled();
    });

    it('should create object with city', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.createObject({ name: 'With City', city: 'SPb' });
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({ city: 'SPb', name: 'With City' }),
          ]),
        })
      );
    });
  });

  describe('updateObject', () => {
    it('should update object data', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.updateObject('obj-1', { name: 'Updated Name' });
      });

      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({ id: 'obj-1', name: 'Updated Name' }),
          ]),
        })
      );
    });

    it('should not update when no active project', () => {
      const updateActiveProject = vi.fn();
      const { result } = renderHook(() =>
        useObjectDomain({ activeProject: null, updateActiveProject })
      );

      act(() => {
        result.current.updateObject('obj-1', { name: 'Test' });
      });

      expect(updateActiveProject).not.toHaveBeenCalled();
    });
  });

  describe('deleteObject', () => {
    it('should delete object from project', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      let deleted: boolean = false;
      act(() => {
        deleted = result.current.deleteObject('obj-2');
      });

      expect(deleted).toBe(true);
      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({ id: 'obj-1' }),
          ]),
        })
      );
    });

    it('should return false when trying to delete last object', () => {
      const onlyObj = createTestObject('obj-only', 'Only Object');
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', [onlyObj]),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      let deleted: boolean = true;
      act(() => {
        deleted = result.current.deleteObject('obj-only');
      });

      expect(deleted).toBe(false);
      expect(deps.updateActiveProject).not.toHaveBeenCalled();
    });

    it('should switch active object when deleting active one', () => {
      const obj1 = createTestObject('obj-1', 'Object 1');
      const obj2 = createTestObject('obj-2', 'Object 2');
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', [obj1, obj2]),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      act(() => {
        result.current.setActiveObjectId('obj-1');
      });

      act(() => {
        result.current.deleteObject('obj-1');
      });

      expect(result.current.activeObjectId).toBe('obj-2');
    });

    it('should return false when no active project', () => {
      const updateActiveProject = vi.fn();
      const { result } = renderHook(() =>
        useObjectDomain({ activeProject: null, updateActiveProject })
      );

      let deleted: boolean = true;
      act(() => {
        deleted = result.current.deleteObject('obj-1');
      });

      expect(deleted).toBe(false);
    });
  });

  describe('copyObject', () => {
    it('should copy object and return new id', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      let newId: string | null = null;
      act(() => {
        newId = result.current.copyObject('obj-1');
      });

      expect(newId).toBeTruthy();
      expect(deps.updateActiveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({ id: 'obj-1' }),
            expect.objectContaining({ id: 'obj-2' }),
            expect.objectContaining({ name: 'Object 1 (копия)' }),
          ]),
        })
      );
    });

    it('should return null when no active project', () => {
      const updateActiveProject = vi.fn();
      const { result } = renderHook(() =>
        useObjectDomain({ activeProject: null, updateActiveProject })
      );

      let newId: string | null = 'initial';
      act(() => {
        newId = result.current.copyObject('obj-1');
      });

      expect(newId).toBeNull();
      expect(updateActiveProject).not.toHaveBeenCalled();
    });

    it('should return null when object not found', () => {
      const deps = createDefaultDeps();
      const { result } = renderHook(() => useObjectDomain(deps));

      let newId: string | null = 'initial';
      act(() => {
        newId = result.current.copyObject('nonexistent');
      });

      expect(newId).toBeNull();
    });

    it('should copy object with rooms', () => {
      const obj = createTestObject('obj-1', 'With Rooms', [
        { id: 'room-1', name: 'Room 1' },
      ]);
      const deps = createDefaultDeps({
        activeProject: createTestProject('p1', [obj]),
      });
      const { result } = renderHook(() => useObjectDomain(deps));

      let newId: string | null = null;
      act(() => {
        newId = result.current.copyObject('obj-1');
      });

      expect(newId).toBeTruthy();

      const updatedProject = deps.updateActiveProject.mock.calls[0][0] as ProjectData;
      const copiedObject = updatedProject.objects.find((o) => o.id === newId);
      expect(copiedObject).toBeDefined();
      expect(copiedObject!.rooms).toHaveLength(1);
    });
  });
});
