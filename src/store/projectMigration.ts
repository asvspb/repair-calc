import type { ProjectData } from '@shared/types';
import { logWarning } from '../utils/logger';
import { migrateProjectToObjects } from '../utils/projectObjects';

function migrateRoom(room: import('../types').RoomData): import('../types').RoomData {
  const migrated = {
    ...room,
    length: room.length ?? 0,
    width: room.width ?? 0,
    height: room.height ?? 0,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
    works: room.works || [],
  };

  if (import.meta.env.DEV) {
    const numericFields = ['length', 'width', 'height'] as const;
    for (const field of numericFields) {
      if (typeof migrated[field] !== 'number') {
        logWarning('migrateRoom', `Field "${field}" should be number after migration`);
      }
    }
  }

  return migrated;
}

export function migrateProject(project: ProjectData): ProjectData {
  const roomsWithDefaults = (project.rooms || []).map(migrateRoom);
  const projectWithObjects = {
    ...project,
    rooms: roomsWithDefaults.length > 0 ? roomsWithDefaults : undefined,
  };
  return migrateProjectToObjects(projectWithObjects);
}
