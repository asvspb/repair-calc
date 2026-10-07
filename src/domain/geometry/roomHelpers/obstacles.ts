/** Obstacle operations (advanced mode). */

import type { RoomData, Obstacle } from '@shared/types';
import { generateId } from '../../factories/projectFactory';
import { addArrayItem, removeArrayItem, updateArrayItem } from './arrayUtils';

// ============================================================
// Obstacle operations (advanced mode)
// ============================================================

export function createObstacle(): Obstacle {
  return {
    id: generateId(),
    name: 'Колонна',
    type: 'column',
    area: 0.25,
    perimeter: 2,
    operation: 'subtract',
  };
}

export function addObstacle(room: RoomData): RoomData {
  const newObstacle = createObstacle();
  const updatedRoom = {
    ...room,
    obstacles: addArrayItem(room.obstacles, newObstacle),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      obstacles: addArrayItem(room.advancedModeData?.obstacles || room.obstacles, newObstacle),
    };
  }

  return updatedRoom;
}

export function removeObstacle(room: RoomData, id: string): RoomData {
  const updatedRoom = {
    ...room,
    obstacles: removeArrayItem(room.obstacles, id),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      obstacles: removeArrayItem(room.advancedModeData?.obstacles || room.obstacles, id),
    };
  }

  return updatedRoom;
}

export function updateObstacle(
  room: RoomData,
  id: string,
  field: keyof Obstacle,
  value: string | number,
): RoomData {
  const updatedRoom = {
    ...room,
    obstacles: updateArrayItem(room.obstacles, id, field, value),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      obstacles: updateArrayItem(
        room.advancedModeData?.obstacles || room.obstacles,
        id,
        field,
        value,
      ),
    };
  }

  return updatedRoom;
}
