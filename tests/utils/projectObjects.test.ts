import { describe, it, expect } from 'vitest';
import {
  createNewObject,
  addObjectToProject,
  copyObjectInProject,
  updateObjectInProject,
  deleteObjectFromProject,
  getFirstObject,
  getObjectFromProject,
} from '../../src/utils/projectObjects';
import type { ProjectData, ObjectData, RoomData } from '../../src/types';

// Helper to create a test project
function createTestProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 'test-project-id',
    name: 'Test Project',
    ...overrides,
  };
}

// Helper to create a test object
function createTestObject(overrides: Partial<ObjectData> = {}): ObjectData {
  return {
    id: 'test-object-id',
    name: 'Test Object',
    rooms: [],
    ...overrides,
  };
}

// Helper to create a test room
function createTestRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'test-room-id',
    name: 'Test Room',
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
    ...overrides,
  };
}

describe('createNewObject', () => {
  it('should create object with generated id', () => {
    const obj = createNewObject('project-1', { name: 'New Object' });
    
    expect(obj.id).toBeDefined();
    expect(obj.id).toMatch(/^local-obj-/);
    expect(obj.name).toBe('New Object');
    expect(obj.rooms).toEqual([]);
  });

  it('should create object with city', () => {
    const obj = createNewObject('project-1', { name: 'New Object', city: 'Moscow' });
    
    expect(obj.city).toBe('Moscow');
  });

  it('should create object with projectId', () => {
    const obj = createNewObject('project-1', { name: 'New Object' });
    
    expect(obj.projectId).toBe('project-1');
  });
});

describe('addObjectToProject', () => {
  it('should add object to project without objects', () => {
    const project = createTestProject();
    const obj = createTestObject({ id: 'new-obj-id', name: 'New Object' });
    
    const result = addObjectToProject(project, obj);
    
    expect(result.objects).toHaveLength(1);
    expect(result.objects![0].id).toBe('new-obj-id');
    expect(result.objects![0].name).toBe('New Object');
    expect(result.objects![0].sortOrder).toBe(0);
  });

  it('should add object to existing objects array', () => {
    const existingObj = createTestObject({ id: 'existing-obj' });
    const project = createTestProject({ objects: [existingObj] });
    const newObj = createTestObject({ id: 'new-obj', name: 'New Object' });
    
    const result = addObjectToProject(project, newObj);
    
    expect(result.objects).toHaveLength(2);
    expect(result.objects![1].id).toBe('new-obj');
    expect(result.objects![1].name).toBe('New Object');
    expect(result.objects![1].sortOrder).toBe(1);
  });

  it('should preserve other project properties', () => {
    const project = createTestProject({ 
      name: 'Original Name', 
      city: 'Original City' 
    });
    const obj = createTestObject();
    
    const result = addObjectToProject(project, obj);
    
    expect(result.name).toBe('Original Name');
    expect(result.city).toBe('Original City');
  });
});

describe('copyObjectInProject', () => {
  it('should copy object with new id', () => {
    const room = createTestRoom({ id: 'room-1', name: 'Room 1' });
    const obj = createTestObject({ id: 'obj-1', name: 'Object 1', rooms: [room] });
    const project = createTestProject({ objects: [obj] });
    
    const result = copyObjectInProject(project, 'obj-1');
    
    expect(result).not.toBeNull();
    expect(result!.newObjectId).not.toBe('obj-1');
    expect(result!.project.objects).toHaveLength(2);
  });

  it('should copy object with "(копия)" suffix', () => {
    const obj = createTestObject({ id: 'obj-1', name: 'Object 1' });
    const project = createTestProject({ objects: [obj] });
    
    const result = copyObjectInProject(project, 'obj-1');
    
    const copiedObj = result!.project.objects![1];
    expect(copiedObj.name).toBe('Object 1 (копия)');
  });

  it('should copy all rooms', () => {
    const room1 = createTestRoom({ id: 'room-1', name: 'Room 1' });
    const room2 = createTestRoom({ id: 'room-2', name: 'Room 2' });
    const obj = createTestObject({ id: 'obj-1', rooms: [room1, room2] });
    const project = createTestProject({ objects: [obj] });
    
    const result = copyObjectInProject(project, 'obj-1');
    
    const copiedObj = result!.project.objects![1];
    expect(copiedObj.rooms).toHaveLength(2);
    // Rooms should have new IDs
    expect(copiedObj.rooms![0].id).not.toBe('room-1');
    expect(copiedObj.rooms![1].id).not.toBe('room-2');
  });

  it('should return null if object not found', () => {
    const project = createTestProject({ objects: [] });
    
    const result = copyObjectInProject(project, 'non-existent');
    
    expect(result).toBeNull();
  });
});

describe('updateObjectInProject', () => {
  it('should update object name', () => {
    const obj = createTestObject({ id: 'obj-1', name: 'Old Name' });
    const project = createTestProject({ objects: [obj] });
    
    const result = updateObjectInProject(project, 'obj-1', { name: 'New Name' });
    
    expect(result.objects![0].name).toBe('New Name');
  });

  it('should update object city', () => {
    const obj = createTestObject({ id: 'obj-1', city: 'Old City' });
    const project = createTestProject({ objects: [obj] });
    
    const result = updateObjectInProject(project, 'obj-1', { city: 'New City' });
    
    expect(result.objects![0].city).toBe('New City');
  });

  it('should not modify other objects', () => {
    const obj1 = createTestObject({ id: 'obj-1', name: 'Object 1' });
    const obj2 = createTestObject({ id: 'obj-2', name: 'Object 2' });
    const project = createTestProject({ objects: [obj1, obj2] });
    
    const result = updateObjectInProject(project, 'obj-1', { name: 'Updated' });
    
    expect(result.objects![0].name).toBe('Updated');
    expect(result.objects![1].name).toBe('Object 2');
  });

  it('should return unchanged project if object not found', () => {
    const project = createTestProject({ objects: [] });
    
    const result = updateObjectInProject(project, 'non-existent', { name: 'New Name' });
    
    expect(result.objects).toHaveLength(0);
  });
});

describe('deleteObjectFromProject', () => {
  it('should delete object from project', () => {
    const obj1 = createTestObject({ id: 'obj-1' });
    const obj2 = createTestObject({ id: 'obj-2' });
    const project = createTestProject({ objects: [obj1, obj2] });
    
    const result = deleteObjectFromProject(project, 'obj-1');
    
    expect(result!.objects).toHaveLength(1);
    expect(result!.objects![0].id).toBe('obj-2');
  });

  it('should return null when trying to delete last object', () => {
    const obj = createTestObject({ id: 'obj-1' });
    const project = createTestProject({ objects: [obj] });
    
    const result = deleteObjectFromProject(project, 'obj-1');
    
    expect(result).toBeNull();
  });

  it('should return null when trying to delete from empty project', () => {
    const project = createTestProject({ objects: [] });
    
    const result = deleteObjectFromProject(project, 'non-existent');
    
    expect(result).toBeNull();
  });

  it('should return project unchanged if object not found and other objects exist', () => {
    const obj1 = createTestObject({ id: 'obj-1' });
    const obj2 = createTestObject({ id: 'obj-2' });
    const project = createTestProject({ objects: [obj1, obj2] });
    
    const result = deleteObjectFromProject(project, 'non-existent');
    
    // Object not found, but there are still 2 objects in project
    expect(result!.objects).toHaveLength(2);
  });
});

describe('getFirstObject', () => {
  it('should return first object', () => {
    const obj1 = createTestObject({ id: 'obj-1' });
    const obj2 = createTestObject({ id: 'obj-2' });
    const project = createTestProject({ objects: [obj1, obj2] });
    
    const result = getFirstObject(project);
    
    expect(result).toEqual(obj1);
  });

  it('should return null for project without objects', () => {
    const project = createTestProject({ objects: [] });
    
    const result = getFirstObject(project);
    
    expect(result).toBeNull();
  });

  it('should return null for project with undefined objects', () => {
    const project = createTestProject();
    
    const result = getFirstObject(project);
    
    expect(result).toBeNull();
  });
});

describe('getObjectFromProject', () => {
  it('should return object by id', () => {
    const obj1 = createTestObject({ id: 'obj-1' });
    const obj2 = createTestObject({ id: 'obj-2' });
    const project = createTestProject({ objects: [obj1, obj2] });
    
    const result = getObjectFromProject(project, 'obj-2');
    
    expect(result).toEqual(obj2);
  });

  it('should return null for non-existent object', () => {
    const obj = createTestObject({ id: 'obj-1' });
    const project = createTestProject({ objects: [obj] });
    
    const result = getObjectFromProject(project, 'non-existent');
    
    expect(result).toBeNull();
  });

  it('should return null for project without objects', () => {
    const project = createTestProject({ objects: [] });
    
    const result = getObjectFromProject(project, 'any-id');
    
    expect(result).toBeNull();
  });
});