import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, AlertCircle, Layers, Box, Ruler, Wrench, Package, Square, Triangle, ClipboardList, HelpCircle, X } from 'lucide-react';
import { WorkList } from './works/WorkList';
import { WorkTemplatePickerModal } from './works/WorkTemplatePickerModal';
import { NumberInput } from './ui/NumberInput';
import type {
  Opening,
  CalculationType,
  Material,
  Tool,
  WorkData,
  GeometryMode,
  SectionShape,
  RoomSubSection,
  RoomSegment,
  Obstacle,
  WallSection,
  RoomData,
  RoomMetrics,
} from '../types';
import type { WorkTemplate } from '../types/workTemplate';
import type { SaveResult } from '../hooks/useWorkTemplates';
import { calculateRoomMetrics } from '../utils/geometry';
import { calculateRoomCosts, migrateWorkData } from '../utils/costs';
import { createNewMaterial, createNewTool } from '../utils/factories';
import {
  updateSimpleField,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
} from '../utils/roomHelpers';

// Custom SVG icons for shapes not available in lucide-react
const Trapezoid = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19 L7 5 L17 5 L20 19 Z" />
  </svg>
);

const Parallelogram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 19 L12 5 L22 5 L18 19 Z" />
  </svg>
);

interface RoomEditorProps {
  room: RoomData;
  updateRoom: (r: RoomData) => void;
  deleteRoom: () => void;
  templates: WorkTemplate[];
  onSaveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => SaveResult;
  onLoadTemplate: (template: WorkTemplate, metrics?: RoomMetrics) => WorkData;
  onDeleteTemplate: (id: string) => void;
  isTemplatePickerOpen: boolean;
  onOpenTemplatePicker: () => void;
  onCloseTemplatePicker: () => void;
}

export function RoomEditor({ 
  room, 
  updateRoom, 
  deleteRoom,
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  isTemplatePickerOpen,
  onOpenTemplatePicker,
  onCloseTemplatePicker,
}: RoomEditorProps) {
  // Normalize room data to ensure all arrays exist
  const normalizedRoom = {
    ...room,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
    works: room.works || []
  };
  
  const metrics = calculateRoomMetrics(normalizedRoom);
  const { costs, total } = calculateRoomCosts(normalizedRoom);

  // Состояние для развернутых карточек работ
  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());

  // Состояние для сворачивания секций помещения
  const [subSectionsExpanded, setSubSectionsExpanded] = useState(true);

  // Состояние для сворачивания блока "Габариты помещения" (простой режим)
  const [isGeometryCollapsed, setIsGeometryCollapsed] = useState(false);

  // Состояние для сворачивания блока "Габариты помещения" (расширенный режим)
  const [isExtendedGeometryCollapsed, setIsExtendedGeometryCollapsed] = useState(false);

  // Состояние для сворачивания блока "Работы и материалы"
  const [isWorksCollapsed, setIsWorksCollapsed] = useState(false);

  // Загрузка сохраненного состояния сворачивания при монтировании
  useEffect(() => {
    const saved = sessionStorage.getItem('simpleMode_geometry_collapsed');
    if (saved !== null) {
      setIsGeometryCollapsed(saved === 'true');
    }
    const savedWorks = sessionStorage.getItem('simpleMode_works_collapsed');
    if (savedWorks !== null) {
      setIsWorksCollapsed(savedWorks === 'true');
    }
    const savedExtended = sessionStorage.getItem('extendedMode_geometry_collapsed');
    if (savedExtended !== null) {
      setIsExtendedGeometryCollapsed(savedExtended === 'true');
    }
  }, []);

  // Сохранение состояния сворачивания при изменении
  useEffect(() => {
    sessionStorage.setItem('simpleMode_geometry_collapsed', String(isGeometryCollapsed));
  }, [isGeometryCollapsed]);

  useEffect(() => {
    sessionStorage.setItem('simpleMode_works_collapsed', String(isWorksCollapsed));
  }, [isWorksCollapsed]);

  useEffect(() => {
    sessionStorage.setItem('extendedMode_geometry_collapsed', String(isExtendedGeometryCollapsed));
  }, [isExtendedGeometryCollapsed]);

  const toggleWorkExpand = (workId: string) => {
    setExpandedWorks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workId)) {
        newSet.delete(workId);
      } else {
        newSet.add(workId);
      }
      return newSet;
    });
  };

  const handleWorkChange = (id: string, field: keyof WorkData, value: string | number | boolean) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => w.id === id ? { ...w, [field]: value } : w)
    });
  };
  
  // Обработчики материалов
  const handleMaterialChange = (workId: string, materialId: string, field: keyof Material, value: string | number) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).map(m => m.id === materialId ? { ...m, [field]: value } : m)
        };
      })
    });
  };
  
  const addMaterial = (workId: string) => {
    const work = (room.works || []).find(w => w.id === workId);
    const newMaterial = createNewMaterial(work?.unit || 'м²');
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: [...(w.materials || []), newMaterial]
        };
      })
    });
  };
  
  const removeMaterial = (workId: string, materialId: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).filter(m => m.id !== materialId)
        };
      })
    });
  };
  
  // Обработчики инструментов
  const handleToolChange = (workId: string, toolId: string, field: keyof Tool, value: string | number | boolean) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).map(t => t.id === toolId ? { ...t, [field]: value } : t)
        };
      })
    });
  };
  
  const addTool = (workId: string) => {
    const newTool = createNewTool();
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: [...(w.tools || []), newTool]
        };
      })
    });
  };
  
  const removeTool = (workId: string, toolId: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).filter(t => t.id !== toolId)
        };
      })
    });
  };

  const addCustomWork = () => {
    const newWork: WorkData = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Работа',
      unit: 'м²',
      enabled: true,
      workUnitPrice: 0,
      materialPriceType: 'total',
      materialPrice: 0,
      materials: [],
      tools: [],
      calculationType: 'floorArea',
      isCustom: true
    };
    updateRoom({
      ...room,
      works: [...(room.works || []), newWork]
    });
  };

  const removeWork = (id: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).filter(w => w.id !== id)
    });
  };

  const reorderWorks = (newWorks: WorkData[]) => {
    updateRoom({
      ...room,
      works: newWorks
    });
  };

  // Template handlers (v2: with workVolume for material scaling)
  const handleSaveTemplate = (work: WorkData, forceReplace: boolean) => {
    // Вычисляем объём работы для масштабирования материалов
    let workVolume = 0;
    if (work.calculationType === 'floorArea') workVolume = metrics.floorArea;
    else if (work.calculationType === 'netWallArea') workVolume = metrics.netWallArea;
    else if (work.calculationType === 'skirtingLength') workVolume = metrics.skirtingLength;
    else if (work.calculationType === 'customCount') workVolume = work.count || 0;

    return onSaveTemplate(work, forceReplace, workVolume);
  };

  const handleLoadTemplate = (template: WorkTemplate) => {
    // Передаём метрики для масштабирования материалов
    const work = onLoadTemplate(template, metrics);
    updateRoom({
      ...room,
      works: [...(room.works || []), work]
    });
  };

  const handleDeleteTemplate = (id: string) => {
    onDeleteTemplate(id);
  };

  // Simple mode handlers - using helpers from roomHelpers.ts
  const handleUpdateSimpleField = (field: 'length' | 'width', val: number) => {
    updateRoom(updateSimpleField(room, field, val));
  };

  const handleAddWindow = () => {
    updateRoom(addWindow(room));
  };

  const handleRemoveWindow = (id: string) => {
    updateRoom(removeWindow(room, id));
  };

  const handleUpdateWindow = (id: string, field: keyof Opening, val: number | string) => {
    updateRoom(updateWindow(room, id, field, val));
  };

  const handleAddDoor = () => {
    updateRoom(addDoor(room));
  };

  const handleRemoveDoor = (id: string) => {
    updateRoom(removeDoor(room, id));
  };

  const handleUpdateDoor = (id: string, field: keyof Opening, val: number | string) => {
    updateRoom(updateDoor(room, id, field, val));
  };

  // Extended mode: SubSections - update both main fields and mode-specific storage
  const addSubSection = () => {
    const newSubSection: RoomSubSection = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Секция',
      shape: 'rectangle',
      length: 0,
      width: 0,
      windows: [],
      doors: []
    };
    const updatedRoom = { ...room, subSections: [...room.subSections, newSubSection] };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: [...(room.extendedModeData?.subSections || room.subSections), newSubSection]
      };
    }
    updateRoom(updatedRoom);
  };

  const removeSubSection = (id: string) => {
    const updatedRoom = { ...room, subSections: room.subSections.filter(s => s.id !== id) };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).filter(s => s.id !== id)
      };
    }
    updateRoom(updatedRoom);
  };

  const updateSubSection = (id: string, field: keyof RoomSubSection, val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]) => {
    const updatedRoom = { ...room, subSections: room.subSections.map(s => s.id === id ? { ...s, [field]: val } : s) };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => s.id === id ? { ...s, [field]: val } : s)
      };
    }
    updateRoom(updatedRoom);
  };

  const updateSubSectionWindow = (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => {
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return {
          ...s,
          windows: s.windows.map(w => w.id === windowId ? { ...w, [field]: val } : w)
        };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return {
            ...s,
            windows: (s.windows || []).map(w => w.id === windowId ? { ...w, [field]: val } : w)
          };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  const addSubSectionWindow = (subSectionId: string) => {
    const newWindow = { id: Math.random().toString(), width: 1.5, height: 1.5, comment: '' };
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, windows: [...(s.windows || []), newWindow] };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, windows: [...(s.windows || []), newWindow] };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  const removeSubSectionWindow = (subSectionId: string, windowId: string) => {
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, windows: (s.windows || []).filter(w => w.id !== windowId) };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, windows: (s.windows || []).filter(w => w.id !== windowId) };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  const updateSubSectionDoor = (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => {
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return {
          ...s,
          doors: s.doors.map(d => d.id === doorId ? { ...d, [field]: val } : d)
        };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return {
            ...s,
            doors: (s.doors || []).map(d => d.id === doorId ? { ...d, [field]: val } : d)
          };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  const addSubSectionDoor = (subSectionId: string) => {
    const newDoor = { id: Math.random().toString(), width: 0.9, height: 2.0, comment: '' };
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, doors: [...(s.doors || []), newDoor] };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, doors: [...(s.doors || []), newDoor] };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  const removeSubSectionDoor = (subSectionId: string, doorId: string) => {
    const updatedRoom = {
      ...room,
      subSections: room.subSections.map(s => {
        if (s.id !== subSectionId) return s;
        return { ...s, doors: (s.doors || []).filter(d => d.id !== doorId) };
      })
    };
    if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        ...(room.extendedModeData || { subSections: [...room.subSections] }),
        subSections: (room.extendedModeData?.subSections || room.subSections).map(s => {
          if (s.id !== subSectionId) return s;
          return { ...s, doors: (s.doors || []).filter(d => d.id !== doorId) };
        })
      };
    }
    updateRoom(updatedRoom);
  };

  // Advanced geometry: Segments - update both main fields and mode-specific storage
  const addSegment = () => {
    const newSegment: RoomSegment = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Ниша',
      length: 1,
      width: 0.5,
      operation: 'subtract'
    };
    const updatedRoom = { ...room, segments: [...room.segments, newSegment] };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        segments: [...(room.advancedModeData?.segments || room.segments), newSegment]
      };
    }
    updateRoom(updatedRoom);
  };
  const removeSegment = (id: string) => {
    const updatedRoom = { ...room, segments: room.segments.filter(s => s.id !== id) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        segments: (room.advancedModeData?.segments || room.segments).filter(s => s.id !== id)
      };
    }
    updateRoom(updatedRoom);
  };
  const updateSegment = (id: string, field: keyof RoomSegment, val: string | number) => {
    const updatedRoom = { ...room, segments: room.segments.map(s => s.id === id ? { ...s, [field]: val } : s) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        segments: (room.advancedModeData?.segments || room.segments).map(s => s.id === id ? { ...s, [field]: val } : s)
      };
    }
    updateRoom(updatedRoom);
  };

  // Advanced geometry: Obstacles
  const addObstacle = () => {
    const newObstacle: Obstacle = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Колонна',
      type: 'column',
      area: 0.25,
      perimeter: 2,
      operation: 'subtract'
    };
    const updatedRoom = { ...room, obstacles: [...room.obstacles, newObstacle] };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        obstacles: [...(room.advancedModeData?.obstacles || room.obstacles), newObstacle]
      };
    }
    updateRoom(updatedRoom);
  };
  const removeObstacle = (id: string) => {
    const updatedRoom = { ...room, obstacles: room.obstacles.filter(o => o.id !== id) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        obstacles: (room.advancedModeData?.obstacles || room.obstacles).filter(o => o.id !== id)
      };
    }
    updateRoom(updatedRoom);
  };
  const updateObstacle = (id: string, field: keyof Obstacle, val: string | number) => {
    const updatedRoom = { ...room, obstacles: room.obstacles.map(o => o.id === id ? { ...o, [field]: val } : o) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        obstacles: (room.advancedModeData?.obstacles || room.obstacles).map(o => o.id === id ? { ...o, [field]: val } : o)
      };
    }
    updateRoom(updatedRoom);
  };

  // Advanced geometry: Wall sections
  const addWallSection = () => {
    const newSection: WallSection = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Участок с перепадом',
      length: 1,
      height: 3
    };
    const updatedRoom = { ...room, wallSections: [...room.wallSections, newSection] };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        wallSections: [...(room.advancedModeData?.wallSections || room.wallSections), newSection]
      };
    }
    updateRoom(updatedRoom);
  };
  const removeWallSection = (id: string) => {
    const updatedRoom = { ...room, wallSections: room.wallSections.filter(ws => ws.id !== id) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        wallSections: (room.advancedModeData?.wallSections || room.wallSections).filter(ws => ws.id !== id)
      };
    }
    updateRoom(updatedRoom);
  };
  const updateWallSection = (id: string, field: keyof WallSection, val: string | number) => {
    const updatedRoom = { ...room, wallSections: room.wallSections.map(ws => ws.id === id ? { ...ws, [field]: val } : ws) };
    if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        ...(room.advancedModeData || { segments: [...room.segments], obstacles: [...room.obstacles], wallSections: [...room.wallSections] }),
        wallSections: (room.advancedModeData?.wallSections || room.wallSections).map(ws => ws.id === id ? { ...ws, [field]: val } : ws)
      };
    }
    updateRoom(updatedRoom);
  };

  // Calculate advanced metrics
  const segmentsDelta = (room.segments || []).reduce((sum, s) => sum + (s.length * s.width * (s.operation === 'add' ? 1 : -1)), 0);
  const obstaclesDelta = (room.obstacles || []).reduce((sum, o) => sum + (o.area * (o.operation === 'add' ? 1 : -1)), 0);

  // Handler for geometry mode switching - saves and restores mode-specific data
  const handleGeometryModeChange = (newMode: GeometryMode) => {
    // Prevent unnecessary updates
    if (room.geometryMode === newMode) return;

    let updatedRoom: RoomData = {
      ...room,
      geometryMode: newMode
    };

    // Save current mode data before switching (deep copy for nested arrays)
    if (room.geometryMode === 'simple') {
      updatedRoom.simpleModeData = {
        length: room.length,
        width: room.width,
        windows: room.windows.map(w => ({ ...w })),
        doors: room.doors.map(d => ({ ...d }))
      };
    } else if (room.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        subSections: room.subSections.map(s => ({
          ...s,
          windows: (s.windows || []).map(w => ({ ...w })),
          doors: (s.doors || []).map(d => ({ ...d }))
        }))
      };
    } else if (room.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        segments: room.segments.map(s => ({ ...s })),
        obstacles: room.obstacles.map(o => ({ ...o })),
        wallSections: room.wallSections.map(ws => ({ ...ws }))
      };
    }

    // Restore target mode data if it exists, otherwise initialize with defaults
    if (newMode === 'simple') {
      if (updatedRoom.simpleModeData) {
        // Restore from saved data (deep copy)
        updatedRoom = {
          ...updatedRoom,
          length: updatedRoom.simpleModeData.length,
          width: updatedRoom.simpleModeData.width,
          windows: updatedRoom.simpleModeData.windows.map(w => ({ ...w })),
          doors: updatedRoom.simpleModeData.doors.map(d => ({ ...d }))
        };
      } else {
        // Initialize with default values
        updatedRoom = {
          ...updatedRoom,
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
        // Create the mode data storage
        updatedRoom.simpleModeData = {
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
      }
    } else if (newMode === 'extended') {
      if (updatedRoom.extendedModeData) {
        // Restore from saved data (deep copy)
        updatedRoom = {
          ...updatedRoom,
          subSections: updatedRoom.extendedModeData.subSections.map(s => ({
            ...s,
            windows: (s.windows || []).map(w => ({ ...w })),
            doors: (s.doors || []).map(d => ({ ...d }))
          }))
        };
      } else {
        // Initialize with default values
        updatedRoom = {
          ...updatedRoom,
          subSections: []
        };
        // Create the mode data storage
        updatedRoom.extendedModeData = {
          subSections: []
        };
      }
    } else if (newMode === 'advanced') {
      if (updatedRoom.advancedModeData) {
        // Restore from saved data (deep copy)
        updatedRoom = {
          ...updatedRoom,
          segments: updatedRoom.advancedModeData.segments.map(s => ({ ...s })),
          obstacles: updatedRoom.advancedModeData.obstacles.map(o => ({ ...o })),
          wallSections: updatedRoom.advancedModeData.wallSections.map(ws => ({ ...ws }))
        };
      } else {
        // Initialize with default values
        updatedRoom = {
          ...updatedRoom,
          segments: [],
          obstacles: [],
          wallSections: []
        };
        // Create the mode data storage
        updatedRoom.advancedModeData = {
          segments: [],
          obstacles: [],
          wallSections: []
        };
      }
    }

    updateRoom(updatedRoom);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="group flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <input
          className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={room.name}
          onChange={e => updateRoom({...room, name: e.target.value})}
        />
        <button onClick={deleteRoom} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer" title="Удалить комнату">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь пола</div>
          <div className="text-xl font-light">{metrics.floorArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
          <div className="text-xl font-light">{metrics.netWallArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Периметр/Плинтус</div>
          <div className="flex items-baseline gap-2">
            <div className="flex flex-col items-center">
              <div className="text-xl font-light">{metrics.perimeter.toFixed(2)}</div>
              <div className="w-10 border-t border-gray-200 my-1"></div>
              <div className="text-xl font-light">{metrics.skirtingLength.toFixed(2)}</div>
            </div>
            <span className="text-sm text-gray-400">м</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Объем</div>
          <div className="text-xl font-light">{metrics.volume?.toFixed(2) || '0.00'} <span className="text-sm text-gray-400">м³</span></div>
        </div>
        <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-indigo-600 mb-1">Стоимость, ₽</div>
          <div className="text-xl font-semibold text-indigo-900">{Math.ceil(total).toLocaleString('ru-RU')} <span className="text-sm text-indigo-400"></span></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div
              onClick={() => {
                if (room.geometryMode === 'simple') setIsGeometryCollapsed(!isGeometryCollapsed);
                else if (room.geometryMode === 'extended') setIsExtendedGeometryCollapsed(!isExtendedGeometryCollapsed);
              }}
              className="flex items-center gap-4 cursor-pointer"
              title={room.geometryMode === 'simple' && isGeometryCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              <h3 className="text-lg font-medium">Габариты помещения</h3>
              <ChevronUp className={`w-5 h-5 text-gray-400 transition-transform ${
                (room.geometryMode === 'simple' && isGeometryCollapsed) ||
                (room.geometryMode === 'extended' && isExtendedGeometryCollapsed) ? 'rotate-180' : ''
              }`} />
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleGeometryModeChange('simple')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                room.geometryMode === 'simple'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Простой
            </button>
            <button
              onClick={() => handleGeometryModeChange('extended')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                room.geometryMode === 'extended'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Расширенный
            </button>
            <button
              onClick={() => handleGeometryModeChange('advanced')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                room.geometryMode === 'advanced'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Профессиональный
            </button>
          </div>
        </div>
        
        {/* Mode descriptions */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          {room.geometryMode === 'simple' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Простой режим:</span> одна прямоугольная комната с окнами и дверями.
            </p>
          )}
          {room.geometryMode === 'extended' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Расширенный режим:</span> несколько прямоугольных секций (например, L-образная комната). Каждая секция имеет свои проёмы.
            </p>
          )}
          {room.geometryMode === 'advanced' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Профессиональный режим:</span> сегменты, препятствия, перепады высоты стен — для помещений сложной формы.
            </p>
          )}
        </div>
        
        {/* Warning about existing data */}
        {normalizedRoom.geometryMode === 'simple' && (normalizedRoom.segments.length + normalizedRoom.obstacles.length + normalizedRoom.wallSections.length + normalizedRoom.subSections.length > 0) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Есть данные в других режимах. Переключение в простой режим сохранит их, но они не будут учитываться в расчетах.
            </p>
          </div>
        )}

        {normalizedRoom.geometryMode === 'extended' && (normalizedRoom.segments.length + normalizedRoom.obstacles.length + normalizedRoom.wallSections.length > 0) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Есть данные в профессиональном режиме. При переключении они сохранятся, но не будут использоваться.
            </p>
          </div>
        )}
        
        {/* Height is always visible */}
        {((room.geometryMode === 'simple' || room.geometryMode === 'advanced') && !isGeometryCollapsed) ||
         (room.geometryMode === 'extended' && !isExtendedGeometryCollapsed) ? (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {room.geometryMode !== 'extended' && (
            <>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Длина (м)</label>
                <NumberInput value={room.length} onChange={(v: number) => handleUpdateSimpleField('length', v)} className="w-full" step={0.1} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Ширина (м)</label>
                <NumberInput value={room.width} onChange={(v: number) => handleUpdateSimpleField('width', v)} className="w-full" step={0.1} />
              </div>
            </>
          )}
          {room.geometryMode === 'extended' && (
            <>
              <div className="sm:col-span-2 text-sm text-gray-500 italic flex items-end pb-2">
                Размеры секций указаны ниже
              </div>
            </>
          )}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Высота (м)</label>
            <NumberInput value={room.height} onChange={(v: number) => updateRoom({...room, height: v})} className="w-full" step={0.1} />
          </div>
        </div>

        {/* Windows and Doors for simple mode */}
        {room.geometryMode === 'simple' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Окна</h4>
                <button onClick={handleAddWindow} className="text-xs text-indigo-600 font-medium hover:text-indigo-700 cursor-pointer">+ Добавить</button>
              </div>
              {(room.windows || []).length === 0 ? (
                <div className="text-xs text-gray-400 italic">Нет окон</div>
              ) : (
                <div className="space-y-3">
                  {(room.windows || []).map((w, i) => (
                    <div key={w.id} className="p-2 bg-white rounded border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400 w-4 font-medium">{i + 1}.</span>
                        <NumberInput value={w.width} onChange={(v: number) => handleUpdateWindow(w.id, 'width', v)} className="w-20 text-xs py-1" step={0.1} />
                        <span className="text-gray-400 text-xs">×</span>
                        <NumberInput value={w.height} onChange={(v: number) => handleUpdateWindow(w.id, 'height', v)} className="w-20 text-xs py-1" step={0.1} />
                        <button onClick={() => handleRemoveWindow(w.id)} className="p-0.5 text-gray-300 hover:text-red-500 ml-auto cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Комментарий (например, балконный блок)"
                        value={w.comment || ''}
                        onChange={(e) => handleUpdateWindow(w.id, 'comment', e.target.value)}
                        className="w-full text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Двери/Проход</h4>
                <button onClick={handleAddDoor} className="text-xs text-indigo-600 font-medium hover:text-indigo-700 cursor-pointer">+ Добавить</button>
              </div>
              {(room.doors || []).length === 0 ? (
                <div className="text-xs text-gray-400 italic">Нет дверей/проходов</div>
              ) : (
                <div className="space-y-3">
                  {(room.doors || []).map((d, i) => (
                    <div key={d.id} className="p-2 bg-white rounded border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400 w-4 font-medium">{i + 1}.</span>
                        <NumberInput value={d.width} onChange={(v: number) => handleUpdateDoor(d.id, 'width', v)} className="w-20 text-xs py-1" step={0.1} />
                        <span className="text-gray-400 text-xs">×</span>
                        <NumberInput value={d.height} onChange={(v: number) => handleUpdateDoor(d.id, 'height', v)} className="w-20 text-xs py-1" step={0.1} />
                        <button onClick={() => handleRemoveDoor(d.id)} className="p-0.5 text-gray-300 hover:text-red-500 ml-auto cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Комментарий (например, входная дверь)"
                        value={d.comment || ''}
                        onChange={(e) => handleUpdateDoor(d.id, 'comment', e.target.value)}
                        className="w-full text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
          </>
        ) : null}
      </div>

      {/* Extended mode: SubSections */}
      {room.geometryMode === 'extended' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSubSectionsExpanded(!subSectionsExpanded)}>
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-medium">Секции помещения</h3>
              <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${subSectionsExpanded ? '' : 'rotate-180'}`} />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">Разбейте помещение на секции разной формы. Каждая секция может иметь свои окна и двери.</p>

          {subSectionsExpanded && (
            <>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-600 mb-2">Доступные формы секций:</div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Square className="w-4 h-4 text-indigo-500" /> Прямоугольник</span>
              <span className="flex items-center gap-1"><Trapezoid className="w-4 h-4 text-indigo-500" /> Трапеция</span>
              <span className="flex items-center gap-1"><Triangle className="w-4 h-4 text-indigo-500" /> Треугольник</span>
              <span className="flex items-center gap-1"><Parallelogram className="w-4 h-4 text-indigo-500" /> Параллелограмм</span>
            </div>
          </div>
          
          {(room.subSections || []).length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет секций. Добавьте хотя бы одну секцию.</div>
          ) : (
            <div className="space-y-4 mb-4">
              {(room.subSections || []).map((subSection, i) => {
                // Calculate metrics based on shape
                const getSectionMetrics = () => {
                  const shape = subSection.shape || 'rectangle';
                  switch (shape) {
                    case 'rectangle':
                      return { area: subSection.length * subSection.width, perimeter: (subSection.length + subSection.width) * 2 };
                    case 'trapezoid': {
                      const base1 = subSection.base1 || 0;
                      const base2 = subSection.base2 || 0;
                      const depth = subSection.depth || 0;
                      const side1 = subSection.side1 || 0;
                      const side2 = subSection.side2 || 0;
                      return { area: (base1 + base2) * depth / 2, perimeter: base1 + base2 + side1 + side2 };
                    }
                    case 'triangle': {
                      const a = subSection.sideA || 0;
                      const b = subSection.sideB || 0;
                      const c = subSection.sideC || 0;
                      if (a > 0 && b > 0 && c > 0 && a + b > c && a + c > b && b + c > a) {
                        const s = (a + b + c) / 2;
                        return { area: Math.sqrt(s * (s - a) * (s - b) * (s - c)), perimeter: a + b + c };
                      }
                      return { area: (subSection.length * subSection.width) / 2, perimeter: subSection.length + subSection.width + Math.sqrt(subSection.length ** 2 + subSection.width ** 2) };
                    }
                    case 'parallelogram': {
                      const base = subSection.base || subSection.length || 0;
                      const depth = subSection.depth || subSection.width || 0;
                      const side = subSection.side || 0;
                      return { area: base * depth, perimeter: 2 * (base + side) };
                    }
                    default:
                      return { area: 0, perimeter: 0 };
                  }
                };
                const subMetrics = getSectionMetrics();
                const openingsArea = (subSection.windows || []).reduce((sum, w) => sum + w.width * w.height, 0) +
                                    (subSection.doors || []).reduce((sum, d) => sum + d.width * d.height, 0);
                const wallArea = subMetrics.perimeter * room.height - openingsArea;
                const volume = subMetrics.area * room.height;
                const doorsWidth = (subSection.doors || []).reduce((sum, d) => sum + d.width, 0);
                const skirtingLength = Math.max(0, subMetrics.perimeter - doorsWidth);
                
                // Shape icon
                const ShapeIcon = subSection.shape === 'trapezoid' ? Trapezoid : 
                                  subSection.shape === 'triangle' ? Triangle : 
                                  subSection.shape === 'parallelogram' ? Parallelogram : Square;
                
                return (
                  <div key={subSection.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">{i + 1}</span>
                      <ShapeIcon className="w-4 h-4 text-indigo-500" />
                      <input
                        value={subSection.name}
                        onChange={e => updateSubSection(subSection.id, 'name', e.target.value)}
                        className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                        placeholder="Название секции"
                      />
                      <button
                        onClick={() => removeSubSection(subSection.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Shape selector */}
                    <div className="mb-4 pl-10">
                      <label className="block text-xs text-gray-500 mb-2">Форма секции</label>
                      <div className="flex flex-wrap gap-2">
                        {(['rectangle', 'trapezoid', 'triangle', 'parallelogram'] as SectionShape[]).map(shape => {
                          const Icon = shape === 'trapezoid' ? Trapezoid : 
                                      shape === 'triangle' ? Triangle : 
                                      shape === 'parallelogram' ? Parallelogram : Square;
                          const label = shape === 'rectangle' ? 'Прямоугольник' :
                                        shape === 'trapezoid' ? 'Трапеция' :
                                        shape === 'triangle' ? 'Треугольник' : 'Параллелограмм';
                          return (
                            <button
                              key={shape}
                              onClick={() => updateSubSection(subSection.id, 'shape', shape)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                (subSection.shape || 'rectangle') === shape
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Dimension inputs based on shape */}
                    <div className="mb-4 pl-10">
                      {subSection.shape === 'rectangle' || !subSection.shape ? (
                        // Rectangle: length × width
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                            <NumberInput
                              value={subSection.length}
                              onChange={(v: number) => updateSubSection(subSection.id, 'length', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
                            <NumberInput
                              value={subSection.width}
                              onChange={(v: number) => updateSubSection(subSection.id, 'width', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'trapezoid' ? (
                        // Trapezoid: base1, base2, depth, side1, side2
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание 1 (м)</label>
                            <NumberInput
                              value={subSection.base1 || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'base1', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание 2 (м)</label>
                            <NumberInput
                              value={subSection.base2 || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'base2', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                              Глубина (м)
                              <span className="group relative">
                                <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  Расстояние между основаниями
                                </span>
                              </span>
                            </label>
                            <NumberInput
                              value={subSection.depth || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'depth', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Бок. сторона 1 (м)</label>
                            <NumberInput
                              value={subSection.side1 || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'side1', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Бок. сторона 2 (м)</label>
                            <NumberInput
                              value={subSection.side2 || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'side2', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'triangle' ? (
                        // Triangle: sideA, sideB, sideC
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона A (м)</label>
                            <NumberInput
                              value={subSection.sideA || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'sideA', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона B (м)</label>
                            <NumberInput
                              value={subSection.sideB || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'sideB', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона C (м)</label>
                            <NumberInput
                              value={subSection.sideC || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'sideC', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'parallelogram' ? (
                        // Parallelogram: base, depth, side
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание (м)</label>
                            <NumberInput
                              value={subSection.base || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'base', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                              Глубина (м)
                              <span className="group relative">
                                <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  Высота, опущенная на основание
                                </span>
                              </span>
                            </label>
                            <NumberInput
                              value={subSection.depth || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'depth', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Боковая сторона (м)</label>
                            <NumberInput
                              value={subSection.side || 0}
                              onChange={(v: number) => updateSubSection(subSection.id, 'side', v)}
                              className="w-full"
                              step={0.1}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    
                    {/* Windows and Doors for this subsection */}
                    <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Окна</span>
                          <button
                            onClick={() => addSubSectionWindow(subSection.id)}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                          >
                            + Добавить
                          </button>
                        </div>
                        {(subSection.windows || []).length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Нет окон</div>
                        ) : (
                          <div className="space-y-2">
                            {subSection.windows.map((w, wi) => (
                              <div key={w.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-gray-400 w-4 font-medium">{wi + 1}.</span>
                                  <NumberInput
                                    value={w.width}
                                    onChange={(v: number) => updateSubSectionWindow(subSection.id, w.id, 'width', v)}
                                    className="w-20 text-xs py-1"
                                    step={0.1}
                                  />
                                  <span className="text-gray-400 text-xs">×</span>
                                  <NumberInput
                                    value={w.height}
                                    onChange={(v: number) => updateSubSectionWindow(subSection.id, w.id, 'height', v)}
                                    className="w-20 text-xs py-1"
                                    step={0.1}
                                  />
                                  <button
                                    onClick={() => removeSubSectionWindow(subSection.id, w.id)}
                                    className="p-0.5 text-gray-300 hover:text-red-500 ml-auto"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Комментарий"
                                  value={w.comment || ''}
                                  onChange={(e) => updateSubSectionWindow(subSection.id, w.id, 'comment', e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Двери/Проход</span>
                          <button
                            onClick={() => addSubSectionDoor(subSection.id)}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                          >
                            + Добавить
                          </button>
                        </div>
                        {(subSection.doors || []).length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Нет дверей</div>
                        ) : (
                          <div className="space-y-2">
                            {subSection.doors.map((d, di) => (
                              <div key={d.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-gray-400 w-4 font-medium">{di + 1}.</span>
                                  <NumberInput
                                    value={d.width}
                                    onChange={(v: number) => updateSubSectionDoor(subSection.id, d.id, 'width', v)}
                                    className="w-20 text-xs py-1"
                                    step={0.1}
                                  />
                                  <span className="text-gray-400 text-xs">×</span>
                                  <NumberInput
                                    value={d.height}
                                    onChange={(v: number) => updateSubSectionDoor(subSection.id, d.id, 'height', v)}
                                    className="w-20 text-xs py-1"
                                    step={0.1}
                                  />
                                  <button
                                    onClick={() => removeSubSectionDoor(subSection.id, d.id)}
                                    className="p-0.5 text-gray-300 hover:text-red-500 ml-auto"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Комментарий"
                                  value={d.comment || ''}
                                  onChange={(e) => updateSubSectionDoor(subSection.id, d.id, 'comment', e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section metrics */}
                    <div className="mt-4 pl-10">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Пол/Потолок</div>
                          <div className="text-sm font-semibold text-gray-900">{subMetrics.area.toFixed(2)} м²</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Стены</div>
                          <div className="text-sm font-semibold text-gray-900">{wallArea.toFixed(2)} м²</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Периметр/Плинтус</div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex flex-col items-center">
                              <div className="text-sm font-semibold">{subMetrics.perimeter.toFixed(2)}</div>
                              <div className="w-8 border-t border-gray-200 my-0.5"></div>
                              <div className="text-sm font-semibold">{skirtingLength.toFixed(2)}</div>
                            </div>
                            <span className="text-xs text-gray-400">м</span>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Объем</div>
                          <div className="text-sm font-semibold text-gray-900">{volume.toFixed(2)} м³</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => addSubSection()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Добавить секцию
          </button>
            </>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={() => setSubSectionsExpanded(!subSectionsExpanded)}
              className="text-sm text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
            >
              <ChevronUp className={`w-4 h-4 transition-transform ${subSectionsExpanded ? '' : 'rotate-180'}`} />
              {subSectionsExpanded ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>
        </div>
      )}

      {/* Advanced Geometry: Segments */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Сегменты помещения</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Для L-образных комнат, ниш и эркеров</p>
          
          {(room.segments || []).length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет сегментов</div>
          ) : (
            <div className="space-y-3 mb-4">
              {(room.segments || []).map((segment, i) => (
                <div key={segment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={segment.name}
                      onChange={e => updateSegment(segment.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeSegment(segment.id)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                      <NumberInput value={segment.length} onChange={(v: number) => updateSegment(segment.id, 'length', v)} className="w-full" step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
                      <NumberInput value={segment.width} onChange={(v: number) => updateSegment(segment.id, 'width', v)} className="w-full" step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Операция</label>
                      <select
                        value={segment.operation}
                        onChange={e => updateSegment(segment.id, 'operation', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="add">Добавить</option>
                        <option value="subtract">Вычесть</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        Площадь: {(segment.length * segment.width).toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {(room.segments || []).length > 0 && (
            <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
              <div className="text-sm text-indigo-700">
                <span className="font-medium">Итого сегменты:</span> {segmentsDelta > 0 ? '+' : ''}{segmentsDelta.toFixed(2)} м²
              </div>
            </div>
          )}
          
          <button onClick={addSegment} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Добавить сегмент
          </button>
        </div>
      )}

      {/* Advanced Geometry: Obstacles */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Box className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Препятствия</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Колонны, воздуховоды, ниши</p>
          
          {(room.obstacles || []).length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет препятствий</div>
          ) : (
            <div className="space-y-3 mb-4">
              {(room.obstacles || []).map((obstacle, i) => (
                <div key={obstacle.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={obstacle.name}
                      onChange={e => updateObstacle(obstacle.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeObstacle(obstacle.id)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Тип</label>
                      <select
                        value={obstacle.type}
                        onChange={e => updateObstacle(obstacle.id, 'type', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="column">Колонна</option>
                        <option value="duct">Воздуховод</option>
                        <option value="niche">Ниша</option>
                        <option value="other">Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Площадь (м²)</label>
                      <NumberInput value={obstacle.area} onChange={(v: number) => updateObstacle(obstacle.id, 'area', v)} className="w-full" step={0.01} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Периметр (м)</label>
                      <NumberInput value={obstacle.perimeter} onChange={(v: number) => updateObstacle(obstacle.id, 'perimeter', v)} className="w-full" step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Операция</label>
                      <select
                        value={obstacle.operation}
                        onChange={e => updateObstacle(obstacle.id, 'operation', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="add">Добавить</option>
                        <option value="subtract">Вычесть</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        {obstacle.operation === 'add' ? '+' : '-'} {obstacle.area.toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {(room.obstacles || []).length > 0 && (
            <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
              <div className="text-sm text-indigo-700">
                <span className="font-medium">Итого препятствия:</span> {obstaclesDelta > 0 ? '+' : ''}{obstaclesDelta.toFixed(2)} м²
              </div>
            </div>
          )}
          
          <button onClick={addObstacle} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Добавить препятствие
          </button>
        </div>
      )}

      {/* Advanced Geometry: Wall Sections */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Перепады высоты стен</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Участки стен с отличающейся высотой</p>
          
          {(room.wallSections || []).length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет перепадов высоты</div>
          ) : (
            <div className="space-y-3 mb-4">
              {(room.wallSections || []).map((section, i) => (
                <div key={section.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={section.name}
                      onChange={e => updateWallSection(section.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeWallSection(section.id)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                      <NumberInput value={section.length} onChange={(v: number) => updateWallSection(section.id, 'length', v)} className="w-full" step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Высота (м)</label>
                      <NumberInput value={section.height} onChange={(v: number) => updateWallSection(section.id, 'height', v)} className="w-full" step={0.1} />
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        Площадь: {(section.length * section.height).toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button onClick={addWallSection} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Добавить участок
          </button>
        </div>
      )}

      {/* Windows and Doors - only for advanced mode */}
      {room.geometryMode === 'advanced' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Окна</h3>
              <button onClick={handleAddWindow} className="text-indigo-600 text-sm font-medium hover:text-indigo-700 cursor-pointer">+ Добавить</button>
            </div>
            {(room.windows || []).length === 0 ? (
              <div className="text-sm text-gray-400 italic">Нет окон</div>
            ) : (
              <div className="space-y-3">
                {(room.windows || []).map((w, i) => (
                  <div key={w.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-gray-500 w-6 font-medium">{i + 1}.</span>
                      <NumberInput value={w.width} onChange={(v: number) => handleUpdateWindow(w.id, 'width', v)} className="w-20" step={0.1} />
                      <span className="text-gray-400">×</span>
                      <NumberInput value={w.height} onChange={(v: number) => handleUpdateWindow(w.id, 'height', v)} className="w-20" step={0.1} />
                      <button onClick={() => handleRemoveWindow(w.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Комментарий (например, балконный блок)"
                      value={w.comment || ''}
                      onChange={(e) => handleUpdateWindow(w.id, 'comment', e.target.value)}
                      className="w-full text-sm px-2 py-1.5 bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Двери/Проход</h3>
              <button onClick={handleAddDoor} className="text-indigo-600 text-sm font-medium hover:text-indigo-700 cursor-pointer">+ Добавить</button>
            </div>
            {(room.doors || []).length === 0 ? (
              <div className="text-sm text-gray-400 italic">Нет дверей/проходов</div>
            ) : (
              <div className="space-y-3">
                {(room.doors || []).map((d, i) => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-gray-500 w-6 font-medium">{i + 1}.</span>
                      <NumberInput value={d.width} onChange={(v: number) => handleUpdateDoor(d.id, 'width', v)} className="w-20" step={0.1} />
                      <span className="text-gray-400">×</span>
                      <NumberInput value={d.height} onChange={(v: number) => handleUpdateDoor(d.id, 'height', v)} className="w-20" step={0.1} />
                      <button onClick={() => handleRemoveDoor(d.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Комментарий (например, входная дверь)"
                      value={d.comment || ''}
                      onChange={(e) => handleUpdateDoor(d.id, 'comment', e.target.value)}
                      className="w-full text-sm px-2 py-1.5 bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsWorksCollapsed(!isWorksCollapsed)}>
            <h3 className="text-lg font-medium">Работы и материалы</h3>
            <ChevronUp className={`w-5 h-5 text-gray-400 transition-transform ${isWorksCollapsed ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {!isWorksCollapsed && (
          <>

        {/* Draggable Work List */}
        <WorkList
          works={room.works || []}
          costs={costs}
          expandedWorks={expandedWorks}
          onToggleWork={(id) => {
            const work = (room.works || []).find(w => w.id === id);
            if (work) {
              handleWorkChange(id, 'enabled', !work.enabled);
            }
          }}
          onDeleteWork={removeWork}
          onNameChange={(id, name) => handleWorkChange(id, 'name', name)}
          onReorderWorks={reorderWorks}
          onToggleExpand={toggleWorkExpand}
          onSaveTemplate={handleSaveTemplate}
          renderExpandedContent={(work) => {
            const migratedWork = migrateWorkData(work);
            let autoQty = 0;
            if (work.calculationType === 'floorArea') autoQty = metrics.floorArea;
            else if (work.calculationType === 'netWallArea') autoQty = metrics.netWallArea;
            else if (work.calculationType === 'skirtingLength') autoQty = metrics.skirtingLength;
            else if (work.calculationType === 'customCount') autoQty = work.count || 0;

            let qty = work.manualQty !== undefined ? work.manualQty : autoQty;

            return (
              <div className="space-y-6">
                {/* Basic work settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Расчет по</label>
                    <select
                      value={work.calculationType}
                      onChange={e => {
                        const val = e.target.value as CalculationType;
                        const newUnit = val === 'floorArea' || val === 'netWallArea' ? 'м²' : val === 'skirtingLength' ? 'пог. м' : 'шт';
                        const updatedWork: WorkData = {
                          ...work,
                          calculationType: val,
                          unit: newUnit,
                        };
                        if (val !== 'customCount') {
                          delete updatedWork.manualQty;
                        }
                        updateRoom({
                          ...room,
                          works: (room.works || []).map(w => w.id === work.id ? updatedWork : w)
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="floorArea">Площади пола</option>
                      <option value="netWallArea">Площади стен</option>
                      <option value="skirtingLength">Периметру</option>
                      <option value="customCount">Вручную (шт)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Объем ({work.unit})</label>
                    {work.calculationType === 'customCount' ? (
                      <NumberInput value={work.count || 0} onChange={(v: number) => handleWorkChange(work.id, 'count', v)} className="w-full" step={0.1} />
                    ) : (
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                        {autoQty.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Цена работы (за ед.)</label>
                    <div className="relative">
                      <NumberInput value={work.workUnitPrice} onChange={(v: number) => handleWorkChange(work.id, 'workUnitPrice', v)} className="w-full pr-8" step={0.1} />
                      <span className="absolute right-3 top-2 text-gray-400 text-sm">₽</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      Стоимость работы: <span className="font-semibold text-indigo-900">{Math.ceil(qty * work.workUnitPrice).toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                </div>

                {/* Materials section */}
                <div>
                  <div className="flex items-center gap-2 mb-3 justify-center">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-medium text-gray-700">Материалы</h4>
                    {(migratedWork.materials?.length || 0) > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {Math.ceil(migratedWork.materials!.reduce((sum, m) => sum + m.quantity * m.pricePerUnit, 0)).toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>

                  {(migratedWork.materials || []).length === 0 ? (
                    <div className="text-sm text-gray-400 italic mb-3">Нет материалов</div>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {(migratedWork.materials || []).map((material, i) => (
                        <div key={material.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                          <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                          <input
                            value={material.name}
                            onChange={e => handleMaterialChange(work.id, material.id, 'name', e.target.value)}
                            placeholder="Название"
                            className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                          />
                          <div className="flex items-center gap-1">
                            <NumberInput
                              value={material.quantity}
                              onChange={v => handleMaterialChange(work.id, material.id, 'quantity', v)}
                              className="w-16 text-sm py-1"
                              step={0.1}
                            />
                            <input
                              value={material.unit}
                              onChange={e => handleMaterialChange(work.id, material.id, 'unit', e.target.value)}
                              className="w-12 px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm text-center"
                              placeholder="ед."
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-xs">×</span>
                            <NumberInput
                              value={material.pricePerUnit}
                              onChange={v => handleMaterialChange(work.id, material.id, 'pricePerUnit', v)}
                              className="w-20 text-sm py-1"
                              step={0.1}
                            />
                            <span className="text-gray-400 text-xs">₽</span>
                          </div>
                          <div className="text-sm text-gray-600 min-w-[80px] text-right">
                            = {Math.ceil(material.quantity * material.pricePerUnit).toLocaleString('ru-RU')} ₽
                          </div>
                          <button
                            onClick={() => removeMaterial(work.id, material.id)}
                            className="p-1 text-gray-300 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => addMaterial(work.id)}
                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    + Добавить материал
                  </button>
                </div>

                {/* Tools section */}
                <div>
                  <div className="flex items-center gap-2 mb-3 justify-center">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <h4 className="font-medium text-gray-700">Инструменты</h4>
                    {(migratedWork.tools?.length || 0) > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {Math.ceil(migratedWork.tools!.reduce((sum, t) => {
                          if (t.isRent && t.rentPeriod) {
                            return sum + t.price * t.quantity * t.rentPeriod;
                          }
                          return sum + t.price * t.quantity;
                        }, 0)).toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>

                  {(migratedWork.tools || []).length === 0 ? (
                    <div className="text-sm text-gray-400 italic mb-3">Нет инструментов</div>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {(migratedWork.tools || []).map((tool, i) => {
                        const toolCost = tool.isRent && tool.rentPeriod
                          ? tool.price * tool.quantity * tool.rentPeriod
                          : tool.price * tool.quantity;

                        return (
                          <div key={tool.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                            <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                            <input
                              value={tool.name}
                              onChange={e => handleToolChange(work.id, tool.id, 'name', e.target.value)}
                              placeholder="Название"
                              className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                            />
                            <div className="flex items-center gap-1">
                              <NumberInput
                                value={tool.quantity}
                                onChange={v => handleToolChange(work.id, tool.id, 'quantity', v)}
                                className="w-14 text-sm py-1"
                                min={1}
                              />
                              <span className="text-gray-400 text-xs">шт</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <NumberInput
                                value={tool.price}
                                onChange={v => handleToolChange(work.id, tool.id, 'price', v)}
                                className="w-20 text-sm py-1"
                              />
                              <span className="text-gray-400 text-xs">₽</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={tool.isRent}
                                  onChange={e => handleToolChange(work.id, tool.id, 'isRent', e.target.checked)}
                                  className="w-4 h-4 text-amber-600 rounded border-gray-300"
                                />
                                Аренда
                              </label>
                              {tool.isRent && (
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={tool.rentPeriod || 1}
                                    onChange={v => handleToolChange(work.id, tool.id, 'rentPeriod', v)}
                                    className="w-12 text-sm py-1"
                                    min={1}
                                  />
                                  <span className="text-gray-400 text-xs">дн.</span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 min-w-[80px] text-right">
                              = {Math.ceil(toolCost).toLocaleString('ru-RU')} ₽
                            </div>
                            <button
                              onClick={() => removeTool(work.id, tool.id)}
                              className="p-1 text-gray-300 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => addTool(work.id)}
                    className="text-sm text-amber-600 font-medium hover:text-amber-700"
                  >
                    + Добавить инструмент
                  </button>
                </div>
              </div>
            );
          }}
        />

        <button
          onClick={addCustomWork}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Новая работа
        </button>

        <button
          onClick={onOpenTemplatePicker}
          disabled={templates.length === 0}
          className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          title={templates.length === 0 ? 'Нет сохранённых шаблонов' : 'Загрузить из шаблона'}
        >
          <ClipboardList className="w-4 h-4" />
          Работа по шаблону
        </button>
          </>
        )}
      </div>

      {/* Template Picker Modal */}
      <WorkTemplatePickerModal
        isOpen={isTemplatePickerOpen}
        onClose={onCloseTemplatePicker}
        onSelect={handleLoadTemplate}
        templates={templates}
        onLoadTemplate={onLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        roomMetrics={metrics}
      />
    </div>
  );
}