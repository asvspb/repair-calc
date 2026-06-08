import { useCallback } from 'react';
import type { RoomData, ProjectData } from '../../types';
import {
  updateRoomInProject,
  addRoomToProject,
  deleteRoomFromProject,
  reorderRoomsInProject,
} from '../../utils/projectObjects';
import {
  logUserAction,
  logSuccess,
  logWarning,
} from '../../utils/logger';

export interface RoomDomainState {
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
}

interface RoomDomainDeps {
  activeProjectId: string;
  activeProject: ProjectData | null;
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
  scheduleSave: (projects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
  updateActiveProject: (project: ProjectData) => void;
  isAuthenticated: boolean;
}

export function useRoomDomain({
  activeProjectId,
  activeProject,
  setProjects,
  scheduleSave,
  scheduleTotalsSave,
  updateActiveProject,
  isAuthenticated,
}: RoomDomainDeps): RoomDomainState {
  const updateRoom = useCallback((updatedRoom: RoomData) => {
    setProjects(prevProjects => {
      const prevActiveProject = prevProjects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) {
        return prevProjects;
      }

      const updatedProject = updateRoomInProject(prevActiveProject, updatedRoom.id, () => updatedRoom);

      const newProjects = prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p);
      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }
      return newProjects;
    });
  }, [activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave, setProjects]);

  const updateRoomById = useCallback((roomId: string, updater: (prev: RoomData) => RoomData) => {
    setProjects(prevProjects => {
      const prevActiveProject = prevProjects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) return prevProjects;

      const updatedProject = updateRoomInProject(prevActiveProject, roomId, updater);

      const newProjects = prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p);
      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }
      return newProjects;
    });
  }, [activeProjectId, scheduleSave, isAuthenticated, scheduleTotalsSave, setProjects]);

  const deleteRoom = useCallback((roomId: string) => {
    if (!activeProject) return;

    logUserAction('Удаление комнаты', { roomId, projectId: activeProject.id });
    const updatedProject = deleteRoomFromProject(activeProject, roomId);
    updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комната удалена', { roomId });
  }, [activeProject, updateActiveProject]);

  const addRoom = useCallback((newRoom: RoomData) => {
    if (!activeProject) return;

    logUserAction('Добавление комнаты', { roomId: newRoom.id, name: newRoom.name, projectId: activeProject.id });
    const updatedProject = addRoomToProject(activeProject, newRoom);
    updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комната добавлена', { roomId: newRoom.id });
  }, [activeProject, updateActiveProject]);

  const reorderRooms = useCallback((newRooms: RoomData[]) => {
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
    updateActiveProject(updatedProject);
    logSuccess('ProjectContext', 'Комнаты переупорядочены', { roomsCount: newRooms.length });
  }, [activeProject, updateActiveProject]);

  return {
    updateRoom,
    updateRoomById,
    deleteRoom,
    addRoom,
    reorderRooms,
  };
}
