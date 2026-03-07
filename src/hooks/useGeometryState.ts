import { useState, useEffect, useCallback } from 'react';
import type {
  RoomData,
  Opening,
  RoomSubSection,
  RoomSegment,
  Obstacle,
  WallSection,
  GeometryMode,
} from '../types';

interface UseGeometryStateReturn {
  // UI State
  isGeometryCollapsed: boolean;
  isExtendedGeometryCollapsed: boolean;
  subSectionsExpanded: boolean;
  
  // UI Handlers
  toggleGeometryCollapse: () => void;
  toggleExtendedGeometryCollapse: () => void;
  toggleSubSectionsExpand: () => void;
  
  // Mode switching
  handleGeometryModeChange: (newMode: GeometryMode) => void;
  
  // Simple mode handlers
  updateSimpleField: (field: 'length' | 'width', val: number) => void;
  addWindow: () => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, field: keyof Opening, val: number | string) => void;
  addDoor: () => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, field: keyof Opening, val: number | string) => void;
  
  // Extended mode handlers
  addSubSection: () => void;
  removeSubSection: (id: string) => void;
  updateSubSection: (id: string, field: keyof RoomSubSection, val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]) => void;
  updateSubSectionWindow: (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionWindow: (subSectionId: string) => void;
  removeSubSectionWindow: (subSectionId: string, windowId: string) => void;
  updateSubSectionDoor: (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionDoor: (subSectionId: string) => void;
  removeSubSectionDoor: (subSectionId: string, doorId: string) => void;
  
  // Advanced mode handlers
  addSegment: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, field: keyof RoomSegment, val: string | number) => void;
  addObstacle: () => void;
  removeObstacle: (id: string) => void;
  updateObstacle: (id: string, field: keyof Obstacle, val: string | number) => void;
  addWallSection: () => void;
  removeWallSection: (id: string) => void;
  updateWallSection: (id: string, field: keyof WallSection, val: string | number) => void;
}

export const useGeometryState = (
  room: RoomData,
  updateRoom: (r: RoomData) => void,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void
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
  const toggleExtendedGeometryCollapse = useCallback(() => setIsExtendedGeometryCollapsed(prev => !prev), []);
  const toggleSubSectionsExpand = useCallback(() => setSubSectionsExpanded(prev => !prev), []);

  // Mode switching handler - использует функциональное обновление для избежания stale closure
  const handleGeometryModeChange = useCallback((newMode: GeometryMode) => {
    updateRoomById(room.id, prevRoom => {
      // Выход, если режим не изменился
      if (prevRoom.geometryMode === newMode) return prevRoom;

      let updatedRoom: RoomData = {
        ...prevRoom,
        geometryMode: newMode
      };

      // Сохранение данных текущего режима (только если есть данные или данных ещё нет)
      if (prevRoom.geometryMode === 'simple') {
        const hasSimpleData = prevRoom.length > 0 || prevRoom.width > 0 ||
                             prevRoom.windows.length > 0 || prevRoom.doors.length > 0;
        // Сохраняем только если есть данные ИЛИ simpleModeData ещё не был установлен
        if (hasSimpleData || !prevRoom.simpleModeData) {
          updatedRoom.simpleModeData = {
            length: prevRoom.length,
            width: prevRoom.width,
            windows: prevRoom.windows.map(w => ({ ...w })),
            doors: prevRoom.doors.map(d => ({ ...d }))
          };
        }
      } else if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          subSections: prevRoom.subSections.map(s => ({
            ...s,
            windows: (s.windows || []).map(w => ({ ...w })),
            doors: (s.doors || []).map(d => ({ ...d }))
          }))
        };
      } else if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          segments: prevRoom.segments.map(s => ({ ...s })),
          obstacles: prevRoom.obstacles.map(o => ({ ...o })),
          wallSections: prevRoom.wallSections.map(ws => ({ ...ws }))
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
            doors: updatedRoom.simpleModeData.doors.map(d => ({ ...d }))
          };
        } else {
          updatedRoom = {
            ...updatedRoom,
            length: 0,
            width: 0,
            windows: [],
            doors: []
          };
        }
      } else if (newMode === 'extended') {
        if (updatedRoom.extendedModeData) {
          updatedRoom = {
            ...updatedRoom,
            subSections: updatedRoom.extendedModeData.subSections.map(s => ({
              ...s,
              windows: (s.windows || []).map(w => ({ ...w })),
              doors: (s.doors || []).map(d => ({ ...d }))
            }))
          };
        } else {
          updatedRoom = {
            ...updatedRoom,
            subSections: []
          };
        }
      } else if (newMode === 'advanced') {
        if (updatedRoom.advancedModeData) {
          updatedRoom = {
            ...updatedRoom,
            segments: updatedRoom.advancedModeData.segments.map(s => ({ ...s })),
            obstacles: updatedRoom.advancedModeData.obstacles.map(o => ({ ...o })),
            wallSections: updatedRoom.advancedModeData.wallSections.map(ws => ({ ...ws }))
          };
        } else {
          updatedRoom = {
            ...updatedRoom,
            segments: [],
            obstacles: [],
            wallSections: []
          };
        }
      }

      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  // Simple mode handlers - используют функциональное обновление для избежания stale closure
  const updateSimpleField = useCallback((field: 'length' | 'width', val: number) => {
    updateRoomById(room.id, prev => ({ ...prev, [field]: val }));
  }, [room.id, updateRoomById]);

  const addWindow = useCallback(() => {
    const newWindow: Opening = { id: Math.random().toString(36).substring(2, 11), width: 1.5, height: 1.5, comment: '' };
    updateRoomById(room.id, prev => ({ ...prev, windows: [...(prev.windows || []), newWindow] }));
  }, [room.id, updateRoomById]);

  const removeWindow = useCallback((id: string) => {
    updateRoomById(room.id, prev => ({ ...prev, windows: (prev.windows || []).filter(w => w.id !== id) }));
  }, [room.id, updateRoomById]);

  const updateWindow = useCallback((id: string, field: keyof Opening, val: number | string) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      windows: (prev.windows || []).map(w => w.id === id ? { ...w, [field]: val } : w)
    }));
  }, [room.id, updateRoomById]);

  const addDoor = useCallback(() => {
    const newDoor: Opening = { id: Math.random().toString(36).substring(2, 11), width: 0.9, height: 2.0, comment: '' };
    updateRoomById(room.id, prev => ({ ...prev, doors: [...(prev.doors || []), newDoor] }));
  }, [room.id, updateRoomById]);

  const removeDoor = useCallback((id: string) => {
    updateRoomById(room.id, prev => ({ ...prev, doors: (prev.doors || []).filter(d => d.id !== id) }));
  }, [room.id, updateRoomById]);

  const updateDoor = useCallback((id: string, field: keyof Opening, val: number | string) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      doors: (prev.doors || []).map(d => d.id === id ? { ...d, [field]: val } : d)
    }));
  }, [room.id, updateRoomById]);

  // Extended mode handlers
  const addSubSection = useCallback(() => {
    const newSubSection: RoomSubSection = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Секция',
      shape: 'rectangle',
      length: 0,
      width: 0,
      windows: [],
      doors: []
    };

    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = [...prevRoom.subSections, newSubSection];
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeSubSection = useCallback((id: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.filter(s => s.id !== id);
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateSubSection = useCallback((
    id: string,
    field: keyof RoomSubSection,
    val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]
  ) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => s.id === id ? { ...s, [field]: val } : s);
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateSubSectionWindow = useCallback((
    subSectionId: string,
    windowId: string,
    field: keyof Opening,
    val: number | string
  ) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return {
          ...s,
          windows: s.windows.map(w => w.id === windowId ? { ...w, [field]: val } : w)
        };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const addSubSectionWindow = useCallback((subSectionId: string) => {
    const newWindow = { id: Math.random().toString(), width: 1.5, height: 1.5, comment: '' };
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, windows: [...(s.windows || []), newWindow] };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeSubSectionWindow = useCallback((subSectionId: string, windowId: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, windows: (s.windows || []).filter(w => w.id !== windowId) };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateSubSectionDoor = useCallback((
    subSectionId: string,
    doorId: string,
    field: keyof Opening,
    val: number | string
  ) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return {
          ...s,
          doors: s.doors.map(d => d.id === doorId ? { ...d, [field]: val } : d)
        };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const addSubSectionDoor = useCallback((subSectionId: string) => {
    const newDoor = { id: Math.random().toString(), width: 0.9, height: 2.0, comment: '' };
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, doors: [...(s.doors || []), newDoor] };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeSubSectionDoor = useCallback((subSectionId: string, doorId: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedSubSections = prevRoom.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, doors: (s.doors || []).filter(d => d.id !== doorId) };
      });
      const updatedRoom: RoomData = { ...prevRoom, subSections: updatedSubSections };
      if (prevRoom.geometryMode === 'extended') {
        updatedRoom.extendedModeData = {
          ...prevRoom.extendedModeData,
          subSections: updatedSubSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  // Advanced mode handlers
  const addSegment = useCallback(() => {
    const newSegment: RoomSegment = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Ниша',
      length: 1,
      width: 0.5,
      operation: 'subtract'
    };
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, segments: [...prevRoom.segments, newSegment] };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          segments: updatedRoom.segments
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeSegment = useCallback((id: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, segments: prevRoom.segments.filter(s => s.id !== id) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          segments: updatedRoom.segments
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateSegment = useCallback((id: string, field: keyof RoomSegment, val: string | number) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, segments: prevRoom.segments.map(s => s.id === id ? { ...s, [field]: val } : s) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          segments: updatedRoom.segments
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const addObstacle = useCallback(() => {
    const newObstacle: Obstacle = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Колонна',
      type: 'column',
      area: 0.25,
      perimeter: 2,
      operation: 'subtract'
    };
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, obstacles: [...prevRoom.obstacles, newObstacle] };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          obstacles: updatedRoom.obstacles
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeObstacle = useCallback((id: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, obstacles: prevRoom.obstacles.filter(o => o.id !== id) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          obstacles: updatedRoom.obstacles
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateObstacle = useCallback((id: string, field: keyof Obstacle, val: string | number) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, obstacles: prevRoom.obstacles.map(o => o.id === id ? { ...o, [field]: val } : o) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          obstacles: updatedRoom.obstacles
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const addWallSection = useCallback(() => {
    const newSection: WallSection = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Участок с перепадом',
      length: 1,
      height: 3
    };
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, wallSections: [...prevRoom.wallSections, newSection] };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          wallSections: updatedRoom.wallSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const removeWallSection = useCallback((id: string) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, wallSections: prevRoom.wallSections.filter(ws => ws.id !== id) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          wallSections: updatedRoom.wallSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

  const updateWallSection = useCallback((id: string, field: keyof WallSection, val: string | number) => {
    updateRoomById(room.id, prevRoom => {
      const updatedRoom: RoomData = { ...prevRoom, wallSections: prevRoom.wallSections.map(ws => ws.id === id ? { ...ws, [field]: val } : ws) };
      if (prevRoom.geometryMode === 'advanced') {
        updatedRoom.advancedModeData = {
          ...(prevRoom.advancedModeData || { segments: [...prevRoom.segments], obstacles: [...prevRoom.obstacles], wallSections: [...prevRoom.wallSections] }),
          wallSections: updatedRoom.wallSections
        };
      }
      return updatedRoom;
    });
  }, [room.id, updateRoomById]);

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
    updateSimpleField,
    addWindow,
    removeWindow,
    updateWindow,
    addDoor,
    removeDoor,
    updateDoor,
    
    // Extended mode handlers
    addSubSection,
    removeSubSection,
    updateSubSection,
    updateSubSectionWindow,
    addSubSectionWindow,
    removeSubSectionWindow,
    updateSubSectionDoor,
    addSubSectionDoor,
    removeSubSectionDoor,
    
    // Advanced mode handlers
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
