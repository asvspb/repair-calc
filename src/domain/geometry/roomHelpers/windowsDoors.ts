/** Window and door operations (simple mode). */

import type { RoomData, Opening } from '@shared/types';
import { addArrayItem, removeArrayItem, updateArrayItem } from './arrayUtils';

// ============================================================
// Window operations (simple mode)
// ============================================================

export function addWindow(room: RoomData): RoomData {
  const newWindow: Opening = {
    id: Math.random().toString(),
    width: 1.5,
    height: 1.5,
    comment: '',
  };
  const updatedRoom = { ...room, windows: addArrayItem(room.windows, newWindow) };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      windows: addArrayItem(room.simpleModeData?.windows || room.windows, newWindow),
    };
  }

  return updatedRoom;
}

export function removeWindow(room: RoomData, id: string): RoomData {
  const updatedRoom = { ...room, windows: removeArrayItem(room.windows, id) };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      windows: removeArrayItem(room.simpleModeData?.windows || room.windows, id),
    };
  }

  return updatedRoom;
}

export function updateWindow(
  room: RoomData,
  id: string,
  field: keyof Opening,
  value: number | string,
): RoomData {
  const updatedRoom = {
    ...room,
    windows: updateArrayItem(room.windows, id, field, value),
  };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      windows: updateArrayItem(room.simpleModeData?.windows || room.windows, id, field, value),
    };
  }

  return updatedRoom;
}

// ============================================================
// Door operations (simple mode)
// ============================================================

export function addDoor(room: RoomData): RoomData {
  const newDoor: Opening = {
    id: Math.random().toString(),
    width: 0.9,
    height: 2.0,
    comment: '',
  };
  const updatedRoom = { ...room, doors: addArrayItem(room.doors, newDoor) };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      doors: addArrayItem(room.simpleModeData?.doors || room.doors, newDoor),
    };
  }

  return updatedRoom;
}

export function removeDoor(room: RoomData, id: string): RoomData {
  const updatedRoom = { ...room, doors: removeArrayItem(room.doors, id) };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      doors: removeArrayItem(room.simpleModeData?.doors || room.doors, id),
    };
  }

  return updatedRoom;
}

export function updateDoor(
  room: RoomData,
  id: string,
  field: keyof Opening,
  value: number | string,
): RoomData {
  const updatedRoom = {
    ...room,
    doors: updateArrayItem(room.doors, id, field, value),
  };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      doors: updateArrayItem(room.simpleModeData?.doors || room.doors, id, field, value),
    };
  }

  return updatedRoom;
}
