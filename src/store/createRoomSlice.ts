import type { StateCreator } from 'zustand';
import type { RoomSlice, StoreState } from './types';
import type { RoomData } from '@shared/types';
import {
  updateRoomInProject,
  addRoomToProject,
  deleteRoomFromProject,
  reorderRoomsInProject,
  getObjectFromProject,
} from '../utils/projectObjects';
import { logUserAction, logSuccess, logWarning } from '../utils/logger';

export const createRoomSlice: StateCreator<StoreState, [], [], RoomSlice> = (set, get) => ({
  updateRoom: (updatedRoom: RoomData) => {
    const { activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave } = get();
    // SYNC-V2 §5(а): мутация комнаты ставит updatedAt + dirty-флаг
    const now = new Date().toISOString();
    const stampedRoom = { ...updatedRoom, updatedAt: now };
    set(state => {
      const prevActiveProject = state.projects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) {
        return state;
      }

      const updatedProject = updateRoomInProject(
        prevActiveProject,
        stampedRoom.id,
        () => stampedRoom,
      );
      const newProjects = state.projects.map(p =>
        p.id === updatedProject.id ? updatedProject : p,
      );
      const activeProject = newProjects.find(p => p.id === state.activeProjectId) || null;
      const activeObject =
        activeProject && state.activeObjectId
          ? getObjectFromProject(activeProject, state.activeObjectId)
          : activeProject?.objects?.[0] || null;

      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }

      return { projects: newProjects, activeProject, activeObject };
    });
    get().markDirty('room', stampedRoom.id, now);
  },

  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => {
    const { activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave } = get();
    // SYNC-V2 §5(а): мутация комнаты ставит updatedAt + dirty-флаг
    const now = new Date().toISOString();
    set(state => {
      const prevActiveProject = state.projects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) return state;

      const updatedProject = updateRoomInProject(prevActiveProject, roomId, prev => ({
        ...updater(prev),
        updatedAt: now,
      }));
      const newProjects = state.projects.map(p =>
        p.id === updatedProject.id ? updatedProject : p,
      );
      const activeProject = newProjects.find(p => p.id === state.activeProjectId) || null;
      const activeObject =
        activeProject && state.activeObjectId
          ? getObjectFromProject(activeProject, state.activeObjectId)
          : activeProject?.objects?.[0] || null;

      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }

      return { projects: newProjects, activeProject, activeObject };
    });
    get().markDirty('room', roomId, now);
  },

  deleteRoom: (roomId: string) => {
    const { activeProject } = get();
    if (!activeProject) return;

    logUserAction('Удаление комнаты', { roomId, projectId: activeProject.id });
    const updatedProject = deleteRoomFromProject(activeProject, roomId);
    get().updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комната удалена', { roomId });
  },

  addRoom: (newRoom: RoomData) => {
    const { activeProject } = get();
    if (!activeProject) return;

    logUserAction('Добавление комнаты', {
      roomId: newRoom.id,
      name: newRoom.name,
      projectId: activeProject.id,
    });
    // SYNC-V2 §5(а): новая комната получает updatedAt + dirty-флаг (upsert)
    const now = new Date().toISOString();
    const stampedRoom = { ...newRoom, updatedAt: now };
    const updatedProject = addRoomToProject(activeProject, stampedRoom);
    get().updateActiveProject(updatedProject);
    get().markDirty('room', stampedRoom.id, now);
    logSuccess('ProjectContext', 'Комната добавлена', { roomId: stampedRoom.id });
  },

  reorderRooms: (newRooms: RoomData[]) => {
    const { activeProject } = get();
    if (!activeProject) return;

    const firstObject = activeProject.objects?.[0];
    if (!firstObject) {
      logWarning('ProjectContext', 'Cannot reorder rooms: no objects found');
      return;
    }

    logUserAction('Переупорядочивание комнат', {
      projectId: activeProject.id,
      objectId: firstObject.id,
      roomsOrder: newRooms.map(r => r.id),
    });

    const updatedProject = reorderRoomsInProject(activeProject, firstObject.id, newRooms);
    get().updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комнаты переупорядочены', { roomsCount: newRooms.length });
  },
});
