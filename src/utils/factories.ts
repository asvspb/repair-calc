import type { RoomData, ProjectData, Material, Tool, WorkData } from '../types';

/**
 * Generic helper for immutable updates of nested data structures
 */

// Update a top-level field in a room
export function updateRoomField<K extends keyof RoomData>(
  room: RoomData,
  field: K,
  value: RoomData[K]
): RoomData {
  return { ...room, [field]: value };
}

// Update a work item in a room
export function updateWorkInRoom(
  room: RoomData,
  workId: string,
  updater: (work: WorkData) => WorkData
): RoomData {
  return {
    ...room,
    works: room.works.map(w => w.id === workId ? updater(w) : w)
  };
}

// Update a material in a work
export function updateMaterialInWork(
  work: WorkData,
  materialId: string,
  field: keyof Material,
  value: string | number
): WorkData {
  return {
    ...work,
    materials: work.materials?.map(m =>
      m.id === materialId ? { ...m, [field]: value } : m
    )
  };
}

// Update a tool in a work
export function updateToolInWork(
  work: WorkData,
  toolId: string,
  field: keyof Tool,
  value: string | number | boolean
): WorkData {
  return {
    ...work,
    tools: work.tools?.map(t =>
      t.id === toolId ? { ...t, [field]: value } : t
    )
  };
}

// Add a material to a work
export function addMaterialToWork(work: WorkData, material: Material): WorkData {
  return {
    ...work,
    materials: [...(work.materials || []), material]
  };
}

// Remove a material from a work
export function removeMaterialFromWork(work: WorkData, materialId: string): WorkData {
  return {
    ...work,
    materials: work.materials?.filter(m => m.id !== materialId) || []
  };
}

// Add a tool to a work
export function addToolToWork(work: WorkData, tool: Tool): WorkData {
  return {
    ...work,
    tools: [...(work.tools || []), tool]
  };
}

// Remove a tool from a work
export function removeToolFromWork(work: WorkData, toolId: string): WorkData {
  return {
    ...work,
    tools: work.tools?.filter(t => t.id !== toolId) || []
  };
}

// Add a work to a room
export function addWorkToRoom(room: RoomData, work: WorkData): RoomData {
  return {
    ...room,
    works: [...room.works, work]
  };
}

// Remove a work from a room
export function removeWorkFromRoom(room: RoomData, workId: string): RoomData {
  return {
    ...room,
    works: room.works.filter(w => w.id !== workId)
  };
}

// Reorder works in a room
export function reorderWorksInRoom(room: RoomData, works: WorkData[]): RoomData {
  return { ...room, works };
}

export const createNewProject = (): ProjectData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новый объект',
  rooms: []
});

export const createNewRoom = (): RoomData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новая комната',
  geometryMode: 'simple',
  length: 0,
  width: 0,
  height: 0,
  segments: [],
  obstacles: [],
  wallSections: [],
  subSections: [],
  windows: [],
  doors: [],
  works: [],
  simpleModeData: {
    length: 0,
    width: 0,
    windows: [],
    doors: []
  },
  extendedModeData: {
    subSections: []
  },
  advancedModeData: {
    segments: [],
    obstacles: [],
    wallSections: []
  }
});

// Создание нового материала
export const createNewMaterial = (unit: string): Material => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  unit: unit,
  pricePerUnit: 0
});

// Создание нового инструмента
export const createNewTool = (): Tool => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  price: 0,
  isRent: false,
  rentPeriod: 1
});