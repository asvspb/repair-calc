/** WallSection operations (advanced mode). */

import type { RoomData, WallSection } from '@shared/types';
import { generateId } from '../../factories/projectFactory';
import { addArrayItem, removeArrayItem, updateArrayItem } from './arrayUtils';

// ============================================================
// WallSection operations (advanced mode)
// ============================================================

export function createWallSection(): WallSection {
  return {
    id: generateId(),
    name: 'Участок с перепадом',
    length: 1,
    height: 3,
  };
}

export function addWallSection(room: RoomData): RoomData {
  const newSection = createWallSection();
  const updatedRoom = {
    ...room,
    wallSections: addArrayItem(room.wallSections, newSection),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      wallSections: addArrayItem(
        room.advancedModeData?.wallSections || room.wallSections,
        newSection,
      ),
    };
  }

  return updatedRoom;
}

export function removeWallSection(room: RoomData, id: string): RoomData {
  const updatedRoom = {
    ...room,
    wallSections: removeArrayItem(room.wallSections, id),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      wallSections: removeArrayItem(room.advancedModeData?.wallSections || room.wallSections, id),
    };
  }

  return updatedRoom;
}

export function updateWallSection(
  room: RoomData,
  id: string,
  field: keyof WallSection,
  value: string | number,
): RoomData {
  const updatedRoom = {
    ...room,
    wallSections: updateArrayItem(room.wallSections, id, field, value),
  };

  if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      ...(room.advancedModeData || {
        segments: [...room.segments],
        obstacles: [...room.obstacles],
        wallSections: [...room.wallSections],
      }),
      wallSections: updateArrayItem(
        room.advancedModeData?.wallSections || room.wallSections,
        id,
        field,
        value,
      ),
    };
  }

  return updatedRoom;
}
