import type {
  ProjectData,
  ObjectData,
  RoomData,
  Opening,
  RoomSegment,
  Obstacle,
  WallSection,
  RoomSubSection,
  WorkData,
  Material,
  Tool,
} from '@shared/types';
import { logUserAction } from '../../utils/logger';

export function generateObjectId(): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('crypto.randomUUID is not supported in this environment');
  }
  return crypto.randomUUID();
}

export function generateProjectId(isAuthenticated: boolean): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('crypto.randomUUID is not supported in this environment');
  }
  // Server expects UUIDs, local can also just be a UUID (we don't need the local- prefix anymore since crypto.randomUUID is universally unique and standard).
  // But let's keep 'local-' prefix if it's not authenticated so the ID mapper knows it's a local project.
  return isAuthenticated ? crypto.randomUUID() : `local-${crypto.randomUUID()}`;
}

export function createProject(
  input: { name: string; city?: string; objects?: string[] },
  ctx: { isAuthenticated: boolean; generatedId?: string },
): ProjectData {
  logUserAction('createProject', { source: 'factory', input, ctx });

  const projectId = ctx.generatedId || generateProjectId(ctx.isAuthenticated);

  const objects: ObjectData[] = (input.objects || ['Основной объект']).map((objName, index) => ({
    id: generateObjectId(),
    projectId: projectId,
    name: objName,
    city: input.city,
    rooms: [],
    sortOrder: index,
  }));

  return {
    id: projectId,
    name: input.name,
    city: input.city,
    objects: objects,
  };
}

/**
 * Generic helper for immutable updates of nested data structures
 */

export function updateRoomField<K extends keyof RoomData>(
  room: RoomData,
  field: K,
  value: RoomData[K],
): RoomData {
  return { ...room, [field]: value };
}

export function updateWorkInRoom(
  room: RoomData,
  workId: string,
  updater: (work: WorkData) => WorkData,
): RoomData {
  return {
    ...room,
    works: room.works.map(w => (w.id === workId ? updater(w) : w)),
  };
}

export function updateMaterialInWork(
  work: WorkData,
  materialId: string,
  field: keyof Material,
  value: string | number,
): WorkData {
  return {
    ...work,
    materials: work.materials?.map(m => (m.id === materialId ? { ...m, [field]: value } : m)),
  };
}

export function updateToolInWork(
  work: WorkData,
  toolId: string,
  field: keyof Tool,
  value: string | number | boolean,
): WorkData {
  return {
    ...work,
    tools: work.tools?.map(t => (t.id === toolId ? { ...t, [field]: value } : t)),
  };
}

export function addMaterialToWork(work: WorkData, material: Material): WorkData {
  return {
    ...work,
    materials: [...(work.materials || []), material],
  };
}

export function removeMaterialFromWork(work: WorkData, materialId: string): WorkData {
  return {
    ...work,
    materials: work.materials?.filter(m => m.id !== materialId) || [],
  };
}

export function addToolToWork(work: WorkData, tool: Tool): WorkData {
  return {
    ...work,
    tools: [...(work.tools || []), tool],
  };
}

export function removeToolFromWork(work: WorkData, toolId: string): WorkData {
  return {
    ...work,
    tools: work.tools?.filter(t => t.id !== toolId) || [],
  };
}

export function addWorkToRoom(room: RoomData, work: WorkData): RoomData {
  return {
    ...room,
    works: [...room.works, work],
  };
}

export function removeWorkFromRoom(room: RoomData, workId: string): RoomData {
  return {
    ...room,
    works: room.works.filter(w => w.id !== workId),
  };
}

export function reorderWorksInRoom(room: RoomData, works: WorkData[]): RoomData {
  return { ...room, works };
}

export const createNewProject = (): ProjectData => ({
  id: crypto.randomUUID(),
  name: 'Новый объект',
  city: 'Москва',
  objects: [],
  rooms: [],
});

export const createNewRoom = (): RoomData => ({
  id: crypto.randomUUID(),
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
    doors: [],
  },
  extendedModeData: {
    subSections: [],
  },
  advancedModeData: {
    segments: [],
    obstacles: [],
    wallSections: [],
  },
});

export const createNewMaterial = (unit: string): Material => ({
  id: crypto.randomUUID(),
  name: '',
  quantity: 1,
  unit: unit,
  pricePerUnit: 0,
});

export const createNewTool = (): Tool => ({
  id: crypto.randomUUID(),
  name: '',
  quantity: 1,
  price: 0,
  isRent: false,
  rentPeriod: 1,
});

/**
 * Create a deep clone of a project with new unique IDs for all entities.
 * Ensures no reference sharing between original and clone, and no ID collisions.
 */
export function cloneProject(sourceProject: ProjectData): ProjectData {
  // Deep clone via structured clone
  const clone: ProjectData = structuredClone(sourceProject);

  clone.id = crypto.randomUUID();
  clone.name = `${sourceProject.name} (копия)`;

  // Clone nested objects (new structure)
  if (clone.objects) {
    clone.objects = clone.objects.map((obj: ObjectData) => {
      const newObjId = crypto.randomUUID();
      return {
        ...obj,
        id: newObjId,
        projectId: clone.id,
        rooms: (obj.rooms || []).map((room: RoomData) => cloneRoom(room, newObjId)),
      };
    });
  }

  // Clone rooms at project level (legacy structure)
  if (clone.rooms) {
    clone.rooms = clone.rooms.map((room: RoomData) => cloneRoom(room, undefined));
  }

  return clone;
}

export function cloneRoom(room: RoomData, newObjectId: string | undefined): RoomData {
  const newRoomId = crypto.randomUUID();

  return {
    ...room,
    id: newRoomId,
    objectId: newObjectId ?? room.objectId,
    segments: (room.segments || []).map((s: RoomSegment) => ({ ...s, id: crypto.randomUUID() })),
    obstacles: (room.obstacles || []).map((o: Obstacle) => ({ ...o, id: crypto.randomUUID() })),
    wallSections: (room.wallSections || []).map((ws: WallSection) => ({
      ...ws,
      id: crypto.randomUUID(),
    })),
    subSections: (room.subSections || []).map((ss: RoomSubSection) => ({
      ...ss,
      id: crypto.randomUUID(),
      windows: (ss.windows || []).map((w: Opening) => ({ ...w, id: crypto.randomUUID() })),
      doors: (ss.doors || []).map((d: Opening) => ({ ...d, id: crypto.randomUUID() })),
    })),
    windows: (room.windows || []).map((w: Opening) => ({ ...w, id: crypto.randomUUID() })),
    doors: (room.doors || []).map((d: Opening) => ({ ...d, id: crypto.randomUUID() })),
    works: (room.works || []).map((work: WorkData) => ({
      ...work,
      id: crypto.randomUUID(),
      materials: (work.materials || []).map((m: Material) => ({ ...m, id: crypto.randomUUID() })),
      tools: (work.tools || []).map((t: Tool) => ({ ...t, id: crypto.randomUUID() })),
    })),
    simpleModeData: room.simpleModeData
      ? {
          ...room.simpleModeData,
          windows: (room.simpleModeData.windows || []).map((w: Opening) => ({
            ...w,
            id: crypto.randomUUID(),
          })),
          doors: (room.simpleModeData.doors || []).map((d: Opening) => ({
            ...d,
            id: crypto.randomUUID(),
          })),
        }
      : undefined,
    extendedModeData: room.extendedModeData
      ? {
          ...room.extendedModeData,
          subSections: (room.extendedModeData.subSections || []).map((ss: RoomSubSection) => ({
            ...ss,
            id: crypto.randomUUID(),
            windows: (ss.windows || []).map((w: Opening) => ({ ...w, id: crypto.randomUUID() })),
            doors: (ss.doors || []).map((d: Opening) => ({ ...d, id: crypto.randomUUID() })),
          })),
        }
      : undefined,
    advancedModeData: room.advancedModeData
      ? {
          ...room.advancedModeData,
          segments: (room.advancedModeData.segments || []).map((s: RoomSegment) => ({
            ...s,
            id: crypto.randomUUID(),
          })),
          obstacles: (room.advancedModeData.obstacles || []).map((o: Obstacle) => ({
            ...o,
            id: crypto.randomUUID(),
          })),
          wallSections: (room.advancedModeData.wallSections || []).map((ws: WallSection) => ({
            ...ws,
            id: crypto.randomUUID(),
          })),
        }
      : undefined,
  };
}
