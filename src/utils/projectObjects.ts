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

// ============================================================
// CRUD операции для объектов
// ============================================================

/**
 * Создание нового пустого объекта
 */
export function createNewObject(
  projectId: string,
  data: { name: string; city?: string }
): ObjectData {
  return {
    id: `local-obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    name: data.name,
    city: data.city,
    rooms: [],
    sortOrder: 0,
  };
}

/**
 * Добавление объекта в проект
 */
export function addObjectToProject(
  project: ProjectData,
  newObject: ObjectData
): ProjectData {
  // Ensure objects array exists
  const existingObjects = project.objects || [];
  
  // Set sort order to be last
  const objectWithOrder = {
    ...newObject,
    sortOrder: existingObjects.length,
  };

  return {
    ...project,
    objects: [...existingObjects, objectWithOrder],
  };
}

/**
 * Копирование объекта со всеми комнатами
 */
export function copyObjectInProject(
  project: ProjectData,
  sourceObjectId: string
): { project: ProjectData; newObjectId: string } | null {
  const sourceObject = getObjectFromProject(project, sourceObjectId);
  if (!sourceObject) {
    return null;
  }

  // Создаём копию с новыми ID
  const newObjectId = `local-obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();
  
  const newRooms = sourceObject.rooms.map((room, index) => ({
    ...room,
    id: `local-room-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  const newObject: ObjectData = {
    ...sourceObject,
    id: newObjectId,
    name: `${sourceObject.name} (копия)`,
    rooms: newRooms,
    sortOrder: (project.objects?.length || 0),
  };

  return {
    project: {
      ...project,
      objects: [...(project.objects || []), newObject],
    },
    newObjectId,
  };
}

/**
 * Обновление данных объекта
 */
export function updateObjectInProject(
  project: ProjectData,
  objectId: string,
  updates: Partial<ObjectData>
): ProjectData {
  if (!project.objects) return project;

  return {
    ...project,
    objects: project.objects.map(obj =>
      obj.id === objectId ? { ...obj, ...updates } : obj
    ),
  };
}

/**
 * Удаление объекта из проекта
 * Возвращает null если это последний объект (нельзя удалить)
 */
export function deleteObjectFromProject(
  project: ProjectData,
  objectId: string
): ProjectData | null {
  if (!project.objects) return null;

  // Нельзя удалить последний объект
  if (project.objects.length <= 1) {
    return null;
  }

  return {
    ...project,
    objects: project.objects.filter(obj => obj.id !== objectId),
  };
}

/**
 * Переупорядочивание объектов
 */
export function reorderObjectsInProject(
  project: ProjectData,
  newOrder: string[] // массив ID объектов в новом порядке
): ProjectData {
  if (!project.objects) return project;

  const objectMap = new Map(project.objects.map(obj => [obj.id, obj]));
  const reorderedObjects = newOrder
    .map((id, index) => {
      const obj = objectMap.get(id);
      return obj ? { ...obj, sortOrder: index } : null;
    })
    .filter(Boolean) as ObjectData[];

  return {
    ...project,
    objects: reorderedObjects,
  };
}

/**
 * Получение первого объекта проекта (или null)
 */
export function getFirstObject(project: ProjectData): ObjectData | null {
  if (!project.objects || project.objects.length === 0) {
    return null;
  }
  return project.objects[0];
}

/**
 * Подсчёт количества комнат в объекте
 */
export function getRoomCount(project: ProjectData, objectId: string): number {
  const obj = getObjectFromProject(project, objectId);
  return obj?.rooms.length || 0;
}

/**
 * Получение ID объекта, которому принадлежит комната
 */
export function getObjectIdByRoomId(project: ProjectData, roomId: string): string | null {
  if (!project.objects) return null;
  
  for (const obj of project.objects) {
    if (obj.rooms.some(r => r.id === roomId)) {
      return obj.id;
    }
  }
  
  return null;
}
