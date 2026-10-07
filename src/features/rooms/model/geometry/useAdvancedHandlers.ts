import { useCallback } from 'react';
import { generateId } from '../../../../domain/factories/projectFactory';
import type { RoomData, RoomSegment, Obstacle, WallSection } from '@shared/types';

/**
 * Advanced mode handlers: segments, obstacles, wall sections.
 * Extracted from useGeometryState (batch 038); bodies transferred byte-in-byte,
 * room.id renamed to roomId argument.
 */
export const useAdvancedHandlers = (
  roomId: string,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void,
) => {
  // Advanced mode handlers
  const addSegment = useCallback(() => {
    const newSegment: RoomSegment = {
      id: generateId(),
      name: 'Ниша',
      length: 1,
      width: 0.5,
      operation: 'subtract',
    };
    updateRoomById(roomId, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, segments: [...prevRoom.segments, newSegment] };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || {
            segments: [...prevRoom.segments],
            obstacles: [...prevRoom.obstacles],
            wallSections: [...prevRoom.wallSections],
          }),
          segments: updatedRoom.segments,
        };
      }
      return updatedRoom;
    });
  }, [roomId, updateRoomById]);

  const removeSegment = useCallback(
    (id: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          segments: prevRoom.segments.filter(s => s.id !== id),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            segments: updatedRoom.segments,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateSegment = useCallback(
    (id: string, field: keyof RoomSegment, val: string | number) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          segments: prevRoom.segments.map(s => (s.id === id ? { ...s, [field]: val } : s)),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            segments: updatedRoom.segments,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const addObstacle = useCallback(() => {
    const newObstacle: Obstacle = {
      id: generateId(),
      name: 'Колонна',
      type: 'column',
      area: 0.25,
      perimeter: 2,
      operation: 'subtract',
    };
    updateRoomById(roomId, prevRoom => {
      const updatedRoom: RoomData = {
        ...prevRoom,
        obstacles: [...prevRoom.obstacles, newObstacle],
      };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || {
            segments: [...prevRoom.segments],
            obstacles: [...prevRoom.obstacles],
            wallSections: [...prevRoom.wallSections],
          }),
          obstacles: updatedRoom.obstacles,
        };
      }
      return updatedRoom;
    });
  }, [roomId, updateRoomById]);

  const removeObstacle = useCallback(
    (id: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          obstacles: prevRoom.obstacles.filter(o => o.id !== id),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            obstacles: updatedRoom.obstacles,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateObstacle = useCallback(
    (id: string, field: keyof Obstacle, val: string | number) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          obstacles: prevRoom.obstacles.map(o => (o.id === id ? { ...o, [field]: val } : o)),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            obstacles: updatedRoom.obstacles,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const addWallSection = useCallback(() => {
    const newSection: WallSection = {
      id: generateId(),
      name: 'Участок с перепадом',
      length: 1,
      height: 3,
    };
    updateRoomById(roomId, prevRoom => {
      const updatedRoom: RoomData = {
        ...prevRoom,
        wallSections: [...prevRoom.wallSections, newSection],
      };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || {
            segments: [...prevRoom.segments],
            obstacles: [...prevRoom.obstacles],
            wallSections: [...prevRoom.wallSections],
          }),
          wallSections: updatedRoom.wallSections,
        };
      }
      return updatedRoom;
    });
  }, [roomId, updateRoomById]);

  const removeWallSection = useCallback(
    (id: string) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          wallSections: prevRoom.wallSections.filter(ws => ws.id !== id),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            wallSections: updatedRoom.wallSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  const updateWallSection = useCallback(
    (id: string, field: keyof WallSection, val: string | number) => {
      updateRoomById(roomId, prevRoom => {
        const updatedRoom: RoomData = {
          ...prevRoom,
          wallSections: prevRoom.wallSections.map(ws =>
            ws.id === id ? { ...ws, [field]: val } : ws,
          ),
        };
        if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            ...(prevRoom.advancedModeData || {
              segments: [...prevRoom.segments],
              obstacles: [...prevRoom.obstacles],
              wallSections: [...prevRoom.wallSections],
            }),
            wallSections: updatedRoom.wallSections,
          };
        }
        return updatedRoom;
      });
    },
    [roomId, updateRoomById],
  );

  return {
    addSegment,
    removeSegment,
    updateSegment,
    addObstacle,
    removeObstacle,
    updateObstacle,
    addWallSection,
    removeWallSection,
    updateWallSection,
  };
};
