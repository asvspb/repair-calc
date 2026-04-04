/**
 * Helper functions for Object-based project structure
 * Provides migration and utility functions for new data model
 */

import type { ProjectData, ObjectData, RoomData } from '../types';

/**
 * Миграция проекта со старой структурой (rooms напрямую в проекте)
 * в новую структуру (objects[].rooms)
 */
export function migrateProjectToObjects(project: ProjectData): ProjectData {
  // Если уже есть objects — миграция не нужна
  if (project.objects && project.objects.length > 0) {
    return project;
  }

  // Если есть rooms — создаём первый объект
  if (project.rooms && project.rooms.length > 0) {
    const firstObject: ObjectData = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: project.name,
      city: project.city,
      rooms: project.rooms,
      useAiPricing: project.useAiPricing,
      lastAiPriceUpdate: project.lastAiPriceUpdate,
      version: project.version,
      sortOrder: 0,
    };

    return {
      ...project,
      objects: [firstObject],
      // Оставляем rooms для обратной совместимости, но помечаем как undefined
      rooms: undefined,
    };
  }

  // Если нет ни rooms ни objects — создаём пустой проект с objects
  return {
    ...project,
    objects: [],
    rooms: undefined,
  };
}

/**
 * Получение активной комнаты из проекта с объектами
 */
export function getRoomFromProject(project: ProjectData, roomId: string): RoomData | null {
  if (!project.objects) return null;
  
  for (const object of project.objects) {
    const room = object.rooms.find(r => r.id === roomId);
    if (room) return room;
  }
  
  return null;
}

/**
 * Обновление комнаты в проекте с объектами
 */
export function updateRoomInProject(
  project: ProjectData,
  roomId: string,
  updater: (room: RoomData) => RoomData
): ProjectData {
  if (!project.objects) return project;
  
  const newObjects = project.objects.map(object => {
    const roomIndex = object.rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return object;
    
    const updatedRoom = updater(object.rooms[roomIndex]);
    const newRooms = [...object.rooms];
    newRooms[roomIndex] = updatedRoom;
    
    return {
      ...object,
      rooms: newRooms,
    };
  });
  
  return {
    ...project,
    objects: newObjects,
  };
}

/**
 * Добавление комнаты в первый объект проекта
 * 
 * IMPORTANT: This function should only be called when objects already exist.
 * For server projects, the server creates the first object on project creation.
 * For local projects, ensure objects array is initialized via migrateProjectToObjects().
 * 
 * If objects array is empty, creates a new object with a LOCAL ID format.
 * This ID will be replaced with a server-generated ID when the project is synced.
 */
export function addRoomToProject(project: ProjectData, room: RoomData): ProjectData {
  if (!project.objects || project.objects.length === 0) {
    // Create first object with LOCAL ID (will be replaced on server sync)
    // Using 'local-' prefix to distinguish from server UUIDs
    const firstObject: ObjectData = {
      id: `local-obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: project.id,
      name: project.name,
      city: project.city,
      rooms: [room],
      version: project.version,
      sortOrder: 0,
    };

    return {
      ...project,
      objects: [firstObject],
    };
  }

  // Add room to first object
  const newObjects = [...project.objects];
  newObjects[0] = {
    ...newObjects[0],
    rooms: [...newObjects[0].rooms, room],
  };

  return {
    ...project,
    objects: newObjects,
  };
}

/**
 * Удаление комнаты из проекта
 */
export function deleteRoomFromProject(project: ProjectData, roomId: string): ProjectData {
  if (!project.objects) return project;
  
  const newObjects = project.objects.map(object => ({
    ...object,
    rooms: object.rooms.filter(r => r.id !== roomId),
  }));
  
  return {
    ...project,
    objects: newObjects,
  };
}

/**
 * Расчёт общей площади всех комнат во всех объектах
 */
export function calculateTotalArea(project: ProjectData): number {
  if (!project.objects) return 0;
  
  return project.objects.reduce((total, object) => {
    const objectArea = object.rooms.reduce((sum, room) => {
      return sum + (room.length * room.width);
    }, 0);
    return total + objectArea;
  }, 0);
}

/**
 * Получение всех комнат проекта (плоский список)
 */
export function getAllRooms(project: ProjectData): RoomData[] {
  if (project.objects && project.objects.length > 0) {
    return project.objects.flatMap(object => object.rooms);
  }
  // Backward compatibility for old structure
  return project.rooms || [];
}

/**
 * Переупорядочивание комнат в объекте
 */
export function reorderRoomsInProject(
  project: ProjectData,
  objectId: string,
  newRooms: RoomData[]
): ProjectData {
  if (!project.objects) return project;

  return {
    ...project,
    objects: project.objects.map(obj =>
      obj.id === objectId
        ? { ...obj, rooms: newRooms }
        : obj
    ),
  };
}

/**
 * Получение объекта по ID
 */
export function getObjectFromProject(project: ProjectData, objectId: string): ObjectData | null {
  if (!project.objects) return null;

  return project.objects.find(o => o.id === objectId) || null;
}
