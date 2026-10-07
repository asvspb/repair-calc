/** Generic array/field utilities for room data updates. */

import type { RoomData, GeometryMode } from '@shared/types';

/**
 * Generic function to update a room field with mode-specific data synchronization.
 */
export function updateRoomField<K extends keyof RoomData>(
  room: RoomData,
  field: K,
  value: RoomData[K],
): RoomData {
  const updatedRoom = { ...room, [field]: value };
  return syncModeData(updatedRoom, room.geometryMode, field);
}

/**
 * Sync mode-specific data when updating room fields.
 */
export function syncModeData(
  room: RoomData,
  _mode: GeometryMode,
  _field: keyof RoomData,
): RoomData {
  // Note: This is called after field update, mode-specific sync is handled
  // by the specific update functions below for complex nested updates
  return room;
}

/**
 * Update a simple field (length/width) with simpleModeData synchronization.
 */
export function updateSimpleField(
  room: RoomData,
  field: 'length' | 'width',
  value: number,
): RoomData {
  const updatedRoom = { ...room, [field]: value };

  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      ...(room.simpleModeData || {
        length: room.length,
        width: room.width,
        windows: [...room.windows],
        doors: [...room.doors],
      }),
      [field]: value,
    };
  }

  return updatedRoom;
}

/**
 * Generic helper to update an item in an array field.
 */
export function updateArrayItem<T extends { id: string }>(
  array: T[],
  id: string,
  field: keyof T,
  value: T[keyof T],
): T[] {
  return array.map(item => (item.id === id ? { ...item, [field]: value } : item));
}

/**
 * Generic helper to add an item to an array field.
 */
export function addArrayItem<T extends { id: string }>(array: T[], item: T): T[] {
  return [...array, item];
}

/**
 * Generic helper to remove an item from an array field.
 */
export function removeArrayItem<T extends { id: string }>(array: T[], id: string): T[] {
  return array.filter(item => item.id !== id);
}
