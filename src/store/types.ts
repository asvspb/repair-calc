import type { ProjectData, ObjectData, RoomData } from '@shared/types';
import type { StorageError } from '../utils/storage';

export interface ProjectSlice {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;

  initialize: (initialProjects: ProjectData[], isAuthenticated: boolean) => Promise<void>;
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  createProject: (data: {
    name: string;
    city?: string;
    objects?: string[];
  }) => Promise<ProjectData>;
  deleteProject: (projectId: string) => Promise<void>;
}

export interface AuthSlice {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

export interface RoomSlice {
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
}

export interface ObjectSlice {
  activeObjectId: string | null;
  activeObject: ObjectData | null;

  setActiveObjectId: (id: string | null) => void;
  createObject: (data: { name: string; city?: string }) => string;
  updateObject: (objectId: string, data: Partial<ObjectData>) => void;
  deleteObject: (objectId: string) => boolean;
  copyObject: (objectId: string) => string | null;
}

export interface SyncSlice {
  lastSaved: Date | null;
  saveError: string | null;
  lastSavedToServer: Date | null;
  lastTotalsSave: Date | null;
  totalsSaveError: string | null;
  roomSyncError: string | null;
  isSyncing: boolean;

  initSyncListeners: () => () => void;
  scheduleSave: (newProjects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
  setSyncing: (isSyncing: boolean) => void;
}

export type StoreState = ProjectSlice & RoomSlice & ObjectSlice & SyncSlice & AuthSlice;
