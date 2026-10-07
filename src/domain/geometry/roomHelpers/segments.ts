/** Segment operations (advanced mode). */

import type { RoomData, RoomSegment } from '@shared/types';
import { generateId } from '../../factories/projectFactory';
import { addArrayItem, removeArrayItem, updateArrayItem } from './arrayUtils';

// ============================================================
// Segment operations (advanced mode)
// ============================================================

export function createSegment(): RoomSegment {
  return {
    id: generateId(),
    name: 'Ниша',
    length: 1,
    width: 0.5,
    operation: 'subtract',
  };
}

export function addSegment(room: RoomData): RoomData {
  const newSegment = createSegment();
  const updatedRoom = {
    ...room,
    segments: addArrayItem(room.segments, newSegment),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      segments: addArrayItem(room.advancedModeData?.segments || room.segments, newSegment),
    };
  }

  return updatedRoom;
}

export function removeSegment(room: RoomData, id: string): RoomData {
  const updatedRoom = {
    ...room,
    segments: removeArrayItem(room.segments, id),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      segments: removeArrayItem(room.advancedModeData?.segments || room.segments, id),
    };
  }

  return updatedRoom;
}

export function updateSegment(
  room: RoomData,
  id: string,
  field: keyof RoomSegment,
  value: string | number,
): RoomData {
  const updatedRoom = {
    ...room,
    segments: updateArrayItem(room.segments, id, field, value),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      segments: updateArrayItem(room.advancedModeData?.segments || room.segments, id, field, value),
    };
  }

  return updatedRoom;
}
