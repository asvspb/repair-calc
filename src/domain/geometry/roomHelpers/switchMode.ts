/** Geometry mode switching with mode-specific data preservation. */

import type { RoomData, GeometryMode } from '@shared/types';

// ============================================================
// Geometry mode switching
// ============================================================

/**
 * Switch geometry mode and preserve mode-specific data.
 */
export function switchGeometryMode(room: RoomData, newMode: GeometryMode): RoomData {
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
