import type { ProjectData, ObjectData, RoomData } from '../types';
import type { StorageError } from '../utils/storage';

export interface ProjectSlice {
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
  isSyncing: boolean;
  isAuthenticated: boolean;

  initialize: (initialProjects: ProjectData[], isAuthenticated: boolean) => Promise<void>;
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  createProject: (data: { name: string; city?: string; objects?: string[] }) => Promise<ProjectData>;
  deleteProject: (projectId: string) => Promise<void>;
  scheduleSave: (newProjects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
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
  initSyncListeners: () => () => void;
}

export type StoreState = ProjectSlice & RoomSlice & ObjectSlice & SyncSlice;
