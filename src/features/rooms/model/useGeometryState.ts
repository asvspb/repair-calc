import { useState, useEffect, useCallback } from 'react';
import type { RoomData, GeometryMode } from '@shared/types';
import type { UseGeometryStateReturn } from './geometry/types';
import { useWindowDoorHandlers } from './geometry/useWindowDoorHandlers';
import { useSubSectionHandlers } from './geometry/useSubSectionHandlers';
import { useAdvancedHandlers } from './geometry/useAdvancedHandlers';

export const useGeometryState = (
  room: RoomData,
  updateRoom: (r: RoomData) => void,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void,
): UseGeometryStateReturn => {
  // UI State for collapsing sections
  const [isGeometryCollapsed, setIsGeometryCollapsed] = useState(false);
  const [isExtendedGeometryCollapsed, setIsExtendedGeometryCollapsed] = useState(false);
  const [subSectionsExpanded, setSubSectionsExpanded] = useState(true);

  // Load saved collapse states on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('simpleMode_geometry_collapsed');
    if (saved !== null) {
      setIsGeometryCollapsed(saved === 'true');
    }
    const savedExtended = sessionStorage.getItem('extendedMode_geometry_collapsed');
    if (savedExtended !== null) {
      setIsExtendedGeometryCollapsed(savedExtended === 'true');
    }
    const savedSubSections = sessionStorage.getItem('subSections_expanded');
    if (savedSubSections !== null) {
      setSubSectionsExpanded(savedSubSections === 'true');
    }
  }, []);

  // Save collapse states on change
  useEffect(() => {
    sessionStorage.setItem('simpleMode_geometry_collapsed', String(isGeometryCollapsed));
  }, [isGeometryCollapsed]);

  useEffect(() => {
    sessionStorage.setItem('extendedMode_geometry_collapsed', String(isExtendedGeometryCollapsed));
  }, [isExtendedGeometryCollapsed]);

  useEffect(() => {
    sessionStorage.setItem('subSections_expanded', String(subSectionsExpanded));
  }, [subSectionsExpanded]);

  // Toggle handlers
  const toggleGeometryCollapse = useCallback(() => setIsGeometryCollapsed(prev => !prev), []);
  const toggleExtendedGeometryCollapse = useCallback(
    () => setIsExtendedGeometryCollapsed(prev => !prev),
    [],
  );
  const toggleSubSectionsExpand = useCallback(() => setSubSectionsExpanded(prev => !prev), []);

  // Mode switching handler - использует функциональное обновление для избежания stale closure
  const handleGeometryModeChange = useCallback(
    (newMode: GeometryMode) => {
      updateRoomById(room.id, prevRoom => {
        // Выход, если режим не изменился
        if (prevRoom.geometryMode === newMode) return prevRoom;

        let updatedRoom: RoomData = {
          ...prevRoom,
          geometryMode: newMode,
        };

        // Сохранение данных текущего режима (только если есть данные или данных ещё нет)
        if (prevRoom.geometryMode === 'simple') {
          const hasSimpleData =
            prevRoom.length > 0 ||
            prevRoom.width > 0 ||
            prevRoom.windows.length > 0 ||
            prevRoom.doors.length > 0;
          // Сохраняем только если есть данные ИЛИ simpleModeData ещё не был установлен
          if (hasSimpleData || !prevRoom.simpleModeData) {
            updatedRoom.simpleModeData = {
              length: prevRoom.length,
              width: prevRoom.width,
              windows: prevRoom.windows.map(w => ({ ...w })),
              doors: prevRoom.doors.map(d => ({ ...d })),
            };
          }
        } else if (prevRoom.geometryMode === 'extended') {
          updatedRoom.extendedModeData = {
            subSections: prevRoom.subSections.map(s => ({
              ...s,
              windows: (s.windows || []).map(w => ({ ...w })),
              doors: (s.doors || []).map(d => ({ ...d })),
            })),
          };
        } else if (prevRoom.geometryMode === 'advanced') {
          updatedRoom.advancedModeData = {
            segments: prevRoom.segments.map(s => ({ ...s })),
            obstacles: prevRoom.obstacles.map(o => ({ ...o })),
            wallSections: prevRoom.wallSections.map(ws => ({ ...ws })),
          };
        }

        // Восстановление данных целевого режима
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
          }
        }

        return updatedRoom;
      });
    },
    [room.id, updateRoomById],
  );

  return {
    // UI State
    isGeometryCollapsed,
    isExtendedGeometryCollapsed,
    subSectionsExpanded,

    // UI Handlers
    toggleGeometryCollapse,
    toggleExtendedGeometryCollapse,
    toggleSubSectionsExpand,

    // Mode switching
    handleGeometryModeChange,

    // Simple mode handlers
    ...useWindowDoorHandlers(room.id, updateRoomById),

    // Extended mode handlers
    ...useSubSectionHandlers(room.id, updateRoomById),

    // Advanced mode handlers
    ...useAdvancedHandlers(room.id, updateRoomById),
  };
};
