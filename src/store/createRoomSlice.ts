import type { StateCreator } from 'zustand';
import type { RoomSlice, StoreState } from './types';
import type { RoomData } from '../types';
import {
  updateRoomInProject,
  addRoomToProject,
  deleteRoomFromProject,
  reorderRoomsInProject,
} from '../utils/projectObjects';
import {
  logUserAction,
  logSuccess,
  logWarning,
} from '../utils/logger';

export const createRoomSlice: StateCreator<StoreState, [], [], RoomSlice> = (set, get) => ({
  updateRoom: (updatedRoom: RoomData) => {
    const { activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave } = get();
    set((state) => {
      const prevActiveProject = state.projects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) {
        return state;
      }

      const updatedProject = updateRoomInProject(prevActiveProject, updatedRoom.id, () => updatedRoom);
      const newProjects = state.projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      const activeProject = newProjects.find(p => p.id === state.activeProjectId) || null;

      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }

      return { projects: newProjects, activeProject };
    });
  },

  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => {
    const { activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave } = get();
    set((state) => {
      const prevActiveProject = state.projects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) return state;

      const updatedProject = updateRoomInProject(prevActiveProject, roomId, updater);
      const newProjects = state.projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      const activeProject = newProjects.find(p => p.id === state.activeProjectId) || null;

      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }

      return { projects: newProjects, activeProject };
    });
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

    logUserAction('Добавление комнаты', { roomId: newRoom.id, name: newRoom.name, projectId: activeProject.id });
    const updatedProject = addRoomToProject(activeProject, newRoom);
    get().updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комната добавлена', { roomId: newRoom.id });
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
