/** SubSection operations (extended mode), incl. nested windows/doors. */

import { generateId } from '../../factories/projectFactory';
import type { RoomData, Opening, RoomSubSection } from '@shared/types';
import { addArrayItem, removeArrayItem, updateArrayItem } from './arrayUtils';

// ============================================================
// SubSection operations (extended mode)
// ============================================================

export function createSubSection(): RoomSubSection {
  return {
    id: generateId(),
    name: 'Секция',
    shape: 'rectangle',
    length: 0,
    width: 0,
    windows: [],
    doors: [],
  };
}

export function addSubSection(room: RoomData): RoomData {
  const newSubSection = createSubSection();
  const updatedRoom = {
    ...room,
    subSections: addArrayItem(room.subSections, newSubSection),
  };

  if (room.geometryMode === 'extended') {
    updatedRoom.extendedModeData = {
      ...(room.extendedModeData || { subSections: [...room.subSections] }),
      subSections: addArrayItem(
        room.extendedModeData?.subSections || room.subSections,
        newSubSection,
      ),
    };
  }

  return updatedRoom;
}

export function removeSubSection(room: RoomData, id: string): RoomData {
  const updatedRoom = {
    ...room,
    subSections: removeArrayItem(room.subSections, id),
  };

  if (room.geometryMode === 'extended') {
    updatedRoom.extendedModeData = {
      ...(room.extendedModeData || { subSections: [...room.subSections] }),
      subSections: removeArrayItem(room.extendedModeData?.subSections || room.subSections, id),
    };
  }

  return updatedRoom;
}

export function updateSubSection(
  room: RoomData,
  id: string,
  field: keyof RoomSubSection,
  value: string | number | RoomSubSection['shape'] | Opening[],
): RoomData {
  const updatedRoom = {
    ...room,
    subSections: updateArrayItem(room.subSections, id, field, value),
  };

  if (room.geometryMode === 'extended') {
    updatedRoom.extendedModeData = {
      ...(room.extendedModeData || { subSections: [...room.subSections] }),
      subSections: updateArrayItem(
        room.extendedModeData?.subSections || room.subSections,
        id,
        field,
        value,
      ),
    };
  }

  return updatedRoom;
}

// ============================================================
// SubSection window/door operations
// ============================================================

export function updateSubSectionArray<K extends 'windows' | 'doors'>(
  room: RoomData,
  subSectionId: string,
  arrayKey: K,
  updater: (array: Opening[]) => Opening[],
): RoomData {
  const updatedRoom = {
    ...room,
    subSections: room.subSections.map(s => {
      if (s.id !== subSectionId) return s;
      return { ...s, [arrayKey]: updater(s[arrayKey] || []) };
    }),
  };

  if (room.geometryMode === 'extended') {
    updatedRoom.extendedModeData = {
      ...(room.extendedModeData || { subSections: [...room.subSections] }),
      subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, [arrayKey]: updater(s[arrayKey] || []) };
      }),
    };
  }

  return updatedRoom;
}

export function addSubSectionWindow(room: RoomData, subSectionId: string): RoomData {
  const newWindow: Opening = {
    id: Math.random().toString(),
    width: 1.5,
    height: 1.5,
    comment: '',
  };
  return updateSubSectionArray(room, subSectionId, 'windows', arr => [...arr, newWindow]);
}

export function removeSubSectionWindow(
  room: RoomData,
  subSectionId: string,
  windowId: string,
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'windows', arr =>
    removeArrayItem(arr, windowId),
  );
}

export function updateSubSectionWindow(
  room: RoomData,
  subSectionId: string,
  windowId: string,
  field: keyof Opening,
  value: number | string,
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'windows', arr =>
    updateArrayItem(arr, windowId, field, value),
  );
}

export function addSubSectionDoor(room: RoomData, subSectionId: string): RoomData {
  const newDoor: Opening = {
    id: Math.random().toString(),
    width: 0.9,
    height: 2.0,
    comment: '',
  };
  return updateSubSectionArray(room, subSectionId, 'doors', arr => [...arr, newDoor]);
}

export function removeSubSectionDoor(
  room: RoomData,
  subSectionId: string,
  doorId: string,
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'doors', arr => removeArrayItem(arr, doorId));
}

export function updateSubSectionDoor(
  room: RoomData,
  subSectionId: string,
  doorId: string,
  field: keyof Opening,
  value: number | string,
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'doors', arr =>
    updateArrayItem(arr, doorId, field, value),
  );
}
