import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ProjectData, RoomData, ObjectData } from '../types';
import type { StorageError } from '../utils/storage';
import { getAllRooms } from '../utils/projectObjects';
import { useProjectDomain, migrateProject } from '../hooks/domains/useProjectDomain';
import { useObjectDomain } from '../hooks/domains/useObjectDomain';
import { useRoomDomain } from '../hooks/domains/useRoomDomain';
import { useSyncDomain } from '../hooks/domains/useSyncDomain';

interface ProjectContextValue {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;
  lastSavedToServer: Date | null;
  lastTotalsSave: Date | null;
  totalsSaveError: string | null;
  roomSyncError: string | null;

  activeObjectId: string | null;
  activeObject: ObjectData | null;

  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
  createProject: (data: { name: string; city?: string; objects?: string[] }) => Promise<ProjectData>;
  deleteProject: (projectId: string) => Promise<void>;
  isSyncing: boolean;

  setActiveObjectId: (id: string | null) => void;
  createObject: (data: { name: string; city?: string }) => string;
  updateObject: (objectId: string, data: Partial<ObjectData>) => void;
  deleteObject: (objectId: string) => boolean;
  copyObject: (objectId: string) => string | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
  initialProjects: ProjectData[];
}

export function ProjectProvider({ children, initialProjects }: ProjectProviderProps) {
  const projectState = useProjectDomain(initialProjects);

  const objectState = useObjectDomain({
    activeProject: projectState.activeProject,
    updateActiveProject: projectState.updateActiveProject,
  });

  const roomState = useRoomDomain({
    activeProjectId: projectState.activeProjectId,
    activeProject: projectState.activeProject,
    setProjects: projectState.setProjects,
    scheduleSave: projectState.scheduleSave,
    scheduleTotalsSave: projectState.scheduleTotalsSave,
    updateActiveProject: projectState.updateActiveProject,
    isAuthenticated: projectState.isAuthenticated,
  });

  useSyncDomain({
    isAuthenticated: projectState.isAuthenticated,
    scheduleSave: projectState.scheduleSave,
  });

  const value = useMemo<ProjectContextValue>(() => ({
    projects: projectState.projects,
    activeProjectId: projectState.activeProjectId,
    activeProject: projectState.activeProject,
    isLoading: projectState.isLoading,
    error: projectState.error,
    lastSaved: projectState.lastSaved,
    saveError: projectState.saveError,
    lastSavedToServer: projectState.lastSavedToServer,
    lastTotalsSave: projectState.lastTotalsSave,
    totalsSaveError: projectState.totalsSaveError,
    roomSyncError: projectState.roomSyncError,
    isSyncing: projectState.isSyncing,

    activeObjectId: objectState.activeObjectId,
    activeObject: objectState.activeObject,

    setActiveProjectId: projectState.setActiveProjectId,
    updateProjects: projectState.updateProjects,
    updateActiveProject: projectState.updateActiveProject,

    updateRoom: roomState.updateRoom,
    updateRoomById: roomState.updateRoomById,
    deleteRoom: roomState.deleteRoom,
    addRoom: roomState.addRoom,
    reorderRooms: roomState.reorderRooms,

    createProject: projectState.createProject,
    deleteProject: projectState.deleteProject,

    setActiveObjectId: objectState.setActiveObjectId,
    createObject: objectState.createObject,
    updateObject: objectState.updateObject,
    deleteObject: objectState.deleteObject,
    copyObject: objectState.copyObject,
  }), [
    projectState.projects,
    projectState.activeProjectId,
    projectState.activeProject,
    projectState.isLoading,
    projectState.error,
    projectState.lastSaved,
    projectState.saveError,
    projectState.lastSavedToServer,
    projectState.lastTotalsSave,
    projectState.totalsSaveError,
    projectState.roomSyncError,
    projectState.isSyncing,
    projectState.setActiveProjectId,
    projectState.updateProjects,
    projectState.updateActiveProject,
    projectState.createProject,
    projectState.deleteProject,
    objectState.activeObjectId,
    objectState.activeObject,
    objectState.setActiveObjectId,
    objectState.createObject,
    objectState.updateObject,
    objectState.deleteObject,
    objectState.copyObject,
    roomState.updateRoom,
    roomState.updateRoomById,
    roomState.deleteRoom,
    roomState.addRoom,
    roomState.reorderRooms,
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

export function useRoom(roomId: string | null): RoomData | null {
  const { activeProject } = useProjectContext();

  if (!roomId || !activeProject) return null;

  return getAllRooms(activeProject).find(r => r.id === roomId) || null;
}

export { ProjectContext };
export { migrateProject };
