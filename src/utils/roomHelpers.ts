/**
 * Helper functions for room data updates.
 * Reduces duplication in RoomEditor by providing generic update functions
 * that handle both main fields and mode-specific data synchronization.
 */

import type {
  RoomData,
  Opening,
  RoomSubSection,
  RoomSegment,
  Obstacle,
  WallSection,
  SimpleModeData,
  ExtendedModeData,
  AdvancedModeData,
  GeometryMode,
} from '../types';

/**
 * Generic function to update a room field with mode-specific data synchronization.
 */
export function updateRoomField<K extends keyof RoomData>(
  room: RoomData,
  field: K,
  value: RoomData[K]
): RoomData {
  const updatedRoom = { ...room, [field]: value };
  return syncModeData(updatedRoom, room.geometryMode, field);
}

/**
 * Sync mode-specific data when updating room fields.
 */
function syncModeData(
  room: RoomData,
  mode: GeometryMode,
  _field: keyof RoomData
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
  value: number
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
  value: T[keyof T]
): T[] {
  return array.map(item => (item.id === id ? { ...item, [field]: value } : item));
}

/**
 * Generic helper to add an item to an array field.
 */
export function addArrayItem<T extends { id: string }>(
  array: T[],
  item: T
): T[] {
  return [...array, item];
}

/**
 * Generic helper to remove an item from an array field.
 */
export function removeArrayItem<T extends { id: string }>(
  array: T[],
  id: string
): T[] {
  return array.filter(item => item.id !== id);
}

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
  value: number | string
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
      windows: updateArrayItem(
        room.simpleModeData?.windows || room.windows,
        id,
        field,
        value
      ),
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
  value: number | string
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
      doors: updateArrayItem(
        room.simpleModeData?.doors || room.doors,
        id,
        field,
        value
      ),
    };
  }
  
  return updatedRoom;
}

// ============================================================
// SubSection operations (extended mode)
// ============================================================

export function createSubSection(): RoomSubSection {
  return {
    id: Math.random().toString(36).substring(2, 11),
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
        newSubSection
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
      subSections: removeArrayItem(
        room.extendedModeData?.subSections || room.subSections,
        id
      ),
    };
  }
  
  return updatedRoom;
}

export function updateSubSection(
  room: RoomData,
  id: string,
  field: keyof RoomSubSection,
  value: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]
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
        value
      ),
    };
  }
  
  return updatedRoom;
}

// ============================================================
// SubSection window/door operations
// ============================================================

function updateSubSectionArray<K extends 'windows' | 'doors'>(
  room: RoomData,
  subSectionId: string,
  arrayKey: K,
  updater: (array: Opening[]) => Opening[]
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
  windowId: string
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'windows', arr =>
    removeArrayItem(arr, windowId)
  );
}

export function updateSubSectionWindow(
  room: RoomData,
  subSectionId: string,
  windowId: string,
  field: keyof Opening,
  value: number | string
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'windows', arr =>
    updateArrayItem(arr, windowId, field, value)
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
  doorId: string
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'doors', arr =>
    removeArrayItem(arr, doorId)
  );
}

export function updateSubSectionDoor(
  room: RoomData,
  subSectionId: string,
  doorId: string,
  field: keyof Opening,
  value: number | string
): RoomData {
  return updateSubSectionArray(room, subSectionId, 'doors', arr =>
    updateArrayItem(arr, doorId, field, value)
  );
}

// ============================================================
// Segment operations (advanced mode)
// ============================================================

export function createSegment(): RoomSegment {
  return {
    id: Math.random().toString(36).substring(2, 11),
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
      segments: addArrayItem(
        room.advancedModeData?.segments || room.segments,
        newSegment
      ),
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
      segments: removeArrayItem(
        room.advancedModeData?.segments || room.segments,
        id
      ),
    };
  }
  
  return updatedRoom;
}

export function updateSegment(
  room: RoomData,
  id: string,
  field: keyof RoomSegment,
  value: string | number
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
      segments: updateArrayItem(
        room.advancedModeData?.segments || room.segments,
        id,
        field,
        value
      ),
    };
  }
  
  return updatedRoom;
}

// ============================================================
// Obstacle operations (advanced mode)
// ============================================================

export function createObstacle(): Obstacle {
  return {
    id: Math.random().toString(36).substring(2, 11),
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
      obstacles: addArrayItem(
        room.advancedModeData?.obstacles || room.obstacles,
        newObstacle
      ),
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
      obstacles: removeArrayItem(
        room.advancedModeData?.obstacles || room.obstacles,
        id
      ),
    };
  }
  
  return updatedRoom;
}

export function updateObstacle(
  room: RoomData,
  id: string,
  field: keyof Obstacle,
  value: string | number
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
        value
      ),
    };
  }
  
  return updatedRoom;
}

// ============================================================
// WallSection operations (advanced mode)
// ============================================================

export function createWallSection(): WallSection {
  return {
    id: Math.random().toString(36).substring(2, 11),
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
        newSection
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
      wallSections: removeArrayItem(
        room.advancedModeData?.wallSections || room.wallSections,
        id
      ),
    };
  }
  
  return updatedRoom;
}

export function updateWallSection(
  room: RoomData,
  id: string,
  field: keyof WallSection,
  value: string | number
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
        value
      ),
    };
  }
  
  return updatedRoom;
}

// ============================================================
// Geometry mode switching
// ============================================================

/**
 * Switch geometry mode and preserve mode-specific data.
 */
export function switchGeometryMode(
  room: RoomData,
  newMode: GeometryMode
): RoomData {
  if (room.geometryMode === newMode) return room;

  let updatedRoom: RoomData = {
    ...room,
    geometryMode: newMode,
  };

  // Save current mode data before switching
  if (room.geometryMode === 'simple') {
    updatedRoom.simpleModeData = {
      length: room.length,
      width: room.width,
      windows: room.windows.map(w => ({ ...w })),
      doors: room.doors.map(d => ({ ...d })),
    };
  } else if (room.geometryMode === 'extended') {
    updatedRoom.extendedModeData = {
      subSections: room.subSections.map(s => ({
        ...s,
        windows: (s.windows || []).map(w => ({ ...w })),
        doors: (s.doors || []).map(d => ({ ...d })),
      })),
    };
  } else if (room.geometryMode === 'advanced') {
    updatedRoom.advancedModeData = {
      segments: room.segments.map(s => ({ ...s })),
      obstacles: room.obstacles.map(o => ({ ...o })),
      wallSections: room.wallSections.map(ws => ({ ...ws })),
    };
  }

  // Restore target mode data if it exists
  if (newMode === 'simple') {
    if (updatedRoom.simpleModeData) {
      updatedRoom = {
        ...updatedRoom,
        length: updatedRoom.simpleModeData.length,
        width: updatedRoom.simpleModeData.width,
        windows: updatedRoom.simpleModeData.windows.map(w => ({ ...w })),
        doors: updatedRoom.simpleModeData.doors.map(d => ({ ...d })),
      };
    } else {
      updatedRoom = {
        ...updatedRoom,
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };
      updatedRoom.simpleModeData = {
        length: 0,
        width: 0,
        windows: [],
        doors: [],
      };
    }
  } else if (newMode === 'extended') {
    if (updatedRoom.extendedModeData) {
      updatedRoom = {
        ...updatedRoom,
        subSections: updatedRoom.extendedModeData.subSections.map(s => ({
          ...s,
          windows: (s.windows || []).map(w => ({ ...w })),
          doors: (s.doors || []).map(d => ({ ...d })),
        })),
      };
    } else {
      updatedRoom = {
        ...updatedRoom,
        subSections: [],
      };
      updatedRoom.extendedModeData = {
        subSections: [],
      };
    }
  } else if (newMode === 'advanced') {
    if (updatedRoom.advancedModeData) {
      updatedRoom = {
        ...updatedRoom,
        segments: updatedRoom.advancedModeData.segments.map(s => ({ ...s })),
        obstacles: updatedRoom.advancedModeData.obstacles.map(o => ({ ...o })),
        wallSections: updatedRoom.advancedModeData.wallSections.map(ws => ({ ...ws })),
      };
    } else {
      updatedRoom = {
        ...updatedRoom,
        segments: [],
        obstacles: [],
        wallSections: [],
      };
      updatedRoom.advancedModeData = {
        segments: [],
        obstacles: [],
        wallSections: [],
      };
    }
  }

  return updatedRoom;
}