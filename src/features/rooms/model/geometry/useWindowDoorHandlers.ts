import { useCallback } from 'react';
import { generateId } from '../../../../domain/factories/projectFactory';
import type { RoomData, Opening } from '@shared/types';

/**
 * Simple mode handlers: simple fields + windows/doors.
 * Extracted from useGeometryState (batch 038); bodies transferred byte-in-byte,
 * room.id renamed to roomId argument.
 */
export const useWindowDoorHandlers = (
  roomId: string,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void,
) => {
  // Simple mode handlers - используют функциональное обновление для избежания stale closure
  const updateSimpleField = useCallback(
    (field: 'length' | 'width', val: number) => {
      updateRoomById(roomId, prev => ({ ...prev, [field]: val }));
    },
    [roomId, updateRoomById],
  );

  const addWindow = useCallback(() => {
    const newWindow: Opening = {
      id: generateId(),
      width: 1.5,
      height: 1.5,
      comment: '',
    };
    updateRoomById(roomId, prev => ({ ...prev, windows: [...(prev.windows || []), newWindow] }));
  }, [roomId, updateRoomById]);

  const removeWindow = useCallback(
    (id: string) => {
      updateRoomById(roomId, prev => ({
        ...prev,
        windows: (prev.windows || []).filter(w => w.id !== id),
      }));
    },
    [roomId, updateRoomById],
  );

  const updateWindow = useCallback(
    (id: string, field: keyof Opening, val: number | string) => {
      updateRoomById(roomId, prev => ({
        ...prev,
        windows: (prev.windows || []).map(w => (w.id === id ? { ...w, [field]: val } : w)),
      }));
    },
    [roomId, updateRoomById],
  );

  const addDoor = useCallback(() => {
    const newDoor: Opening = {
      id: generateId(),
      width: 0.9,
      height: 2.0,
      comment: '',
    };
    updateRoomById(roomId, prev => ({ ...prev, doors: [...(prev.doors || []), newDoor] }));
  }, [roomId, updateRoomById]);

  const removeDoor = useCallback(
    (id: string) => {
      updateRoomById(roomId, prev => ({
        ...prev,
        doors: (prev.doors || []).filter(d => d.id !== id),
      }));
    },
    [roomId, updateRoomById],
  );

  const updateDoor = useCallback(
    (id: string, field: keyof Opening, val: number | string) => {
      updateRoomById(roomId, prev => ({
        ...prev,
        doors: (prev.doors || []).map(d => (d.id === id ? { ...d, [field]: val } : d)),
      }));
    },
    [roomId, updateRoomById],
  );

  return {
    updateSimpleField,
    addWindow,
    removeWindow,
    updateWindow,
    addDoor,
    removeDoor,
    updateDoor,
  };
};
