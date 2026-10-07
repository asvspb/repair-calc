import { useCallback } from 'react';
import { generateId } from '../../../../domain/factories/projectFactory';
import type { RoomData, Opening, RoomSubSection, WallSection } from '@shared/types';

/**
 * Extended mode handlers: sub-sections and nested windows/doors.
 * Extracted from useGeometryState (batch 038); bodies transferred byte-in-byte,
 * room.id renamed to roomId argument.
 */
export const useSubSectionHandlers = (
  roomId: string,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void,
) => {
  // Extended mode handlers
  const addSubSection = useCallback(() => {
    const newSubSection: RoomSubSection = {
      id: generateId(),
      name: 'Секция',
      shape: 'rectangle',
      length: 0,
      width: 0,
      windows: [],
      doors: [],
    };

    updateRoomById(roomId, prevRoom => {
      const updatedSubSections = [...prevRoom.subSections, newSubSection];
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections,
        };
      }
      return updatedRoom;
    });
  }, [roomId, updateRoomById]);

  const removeSubSection = useCallback(
    (id: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.filter(s => s.id !== id);
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateSubSection = useCallback(
    (
      id: string,
      field: keyof RoomSubSection,
      val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[],
    ) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s =>
          s.id === id ? { ...s, [field]: val } : s,
        );
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateSubSectionWindow = useCallback(
    (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return {
            ...s,
            windows: s.windows.map(w => (w.id === windowId ? { ...w, [field]: val } : w)),
          };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const addSubSectionWindow = useCallback(
    (subSectionId: string) => {
      const newWindow = { id: Math.random().toString(), width: 1.5, height: 1.5, comment: '' };
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, windows: [...(s.windows || []), newWindow] };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const removeSubSectionWindow = useCallback(
    (subSectionId: string, windowId: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, windows: (s.windows || []).filter(w => w.id !== windowId) };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateSubSectionDoor = useCallback(
    (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return {
            ...s,
            doors: s.doors.map(d => (d.id === doorId ? { ...d, [field]: val } : d)),
          };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const addSubSectionDoor = useCallback(
    (subSectionId: string) => {
      const newDoor = { id: Math.random().toString(), width: 0.9, height: 2.0, comment: '' };
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, doors: [...(s.doors || []), newDoor] };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const removeSubSectionDoor = useCallback(
    (subSectionId: string, doorId: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedSubSections = prevRoom.subSections.map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, doors: (s.doors || []).filter(d => d.id !== doorId) };
        });
        const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
        if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            ...prevRoom.extendedModeData,
            subSections: updatedSubSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  return {
    addSubSection,
    removeSubSection,
    updateSubSection,
    updateSubSectionWindow,
    addSubSectionWindow,
    removeSubSectionWindow,
    updateSubSectionDoor,
    addSubSectionDoor,
    removeSubSectionDoor,
  };
};
