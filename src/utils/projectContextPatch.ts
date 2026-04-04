/**
 * Quick migration patch for ProjectContext
 * Provides backward-compatible methods for existing code
 */

import type { ProjectData, RoomData, ObjectData } from '../types';

/**
 * Get rooms from project (works with both old and new structure)
 */
export function getRooms(project: ProjectData): RoomData[] {
  // New structure: rooms in objects
  if (project.objects && project.objects.length > 0) {
    return project.objects.flatMap(obj => obj.rooms);
  }
  // Old structure: rooms directly in project
  return project.rooms || [];
}

/**
 * Get first object or create if not exists
 */
export function getOrCreateFirstObject(project: ProjectData): ObjectData {
  if (project.objects && project.objects.length > 0) {
    return project.objects[0];
  }
  
  // Create first object from project rooms
  const firstObject: ObjectData = {
    id: crypto.randomUUID(),
    projectId: project.id,
    name: project.name,
    city: project.city,
    rooms: project.rooms || [],
    version: project.version,
    sortOrder: 0,
  };
  
  return firstObject;
}

/**
 * Update project with new rooms array
 */
export function setProjectRooms(project: ProjectData, rooms: RoomData[]): ProjectData {
  if (project.objects && project.objects.length > 0) {
    // Update first object's rooms
    const newObjects = [...project.objects];
    newObjects[0] = {
      ...newObjects[0],
      rooms,
    };
    return { ...project, objects: newObjects };
  }
  
  // Old structure
  return { ...project, rooms };
}
