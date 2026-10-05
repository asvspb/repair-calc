import type { ProjectData, ObjectData, RoomData, WorkData } from '@shared/types';
import type { StorageError } from '../utils/storage';
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
} from '../features/auth/model/auth.types';
import type { WorkTemplate } from '../types/workTemplate';
import type { RoomMetrics } from '../types';
import type { SaveResult } from '../features/works/model/useWorkTemplates';

export interface ProjectSlice {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  /** ID проектов, для которых сейчас выполняется безвозвратное удаление (гейт повторных кликов) */
  deletingIds: string[];

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

/** Архивные операции над проектами (P3-SPLIT): список архива / restore / безвозвратное удаление */
export interface ArchiveSlice {
  /** Список архивных проектов (только для авторизованных; гостю — пустой список) */
  fetchArchivedProjects: () => Promise<
    (ProjectData & { objectsCount: number; roomsCount: number })[]
  >;
  /** Восстановление проекта из архива; добавляет/заменяет проект в state.projects */
  restoreProject: (projectId: string) => Promise<ProjectData>;
  /** Безвозвратное удаление архивного проекта + вычистка idMapper-маппингов */
  permanentDeleteProject: (projectId: string) => Promise<{ objects: number; rooms: number }>;
}

export interface AuthSlice {
  isAuthenticated: boolean;
  /** Пользователь сессии (перенесено из контекста аутентификации) */
  user: User | null;
  /** Проверка токена при старте приложения (перенесено из контекста аутентификации) */
  authIsLoading: boolean;
  /** Ошибка входа/регистрации (перенесено из контекста аутентификации) */
  authError: string | null;

  setIsAuthenticated: (value: boolean) => void;
  /** Проверка сохранённого токена при загрузке; при 401 — refresh-цепочка */
  initAuthCheck: () => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

/** Слайс шаблонов работ (бывш. контекст шаблонов) */
export interface WorkTemplateSlice {
  templates: WorkTemplate[];
  /** Загрузка шаблонов из TemplateStorage при старте */
  workTemplatesLoading: boolean;

  initWorkTemplates: () => void;
  saveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => SaveResult;
  loadTemplate: (template: WorkTemplate, metrics?: RoomMetrics) => WorkData;
  deleteTemplate: (id: string) => void;
  importTemplates: (templates: WorkTemplate[]) => void;
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

/** Вид сущности dirty-модели SYNC-V2 (спека §2.1) */
export type DirtyEntityKind = 'project' | 'object' | 'room';

export interface DirtyEntry {
  /** ISO-метка последней мутации сущности */
  updatedAt: string;
  op: 'upsert';
}

export type DirtyMap = Record<DirtyEntityKind, Record<string, DirtyEntry>>;

/** Подтверждение сущности флашером SYNC-V2 batch (б) (спека §2.2) */
export interface FlushAckEntry {
  entityKind: DirtyEntityKind;
  entityId: string;
  /** true — снята без ретрая (конфликт/валидация/нет локального состояния) */
  gaveUp: boolean;
  /** §3.3: серверная версия новее — локальная затирается, конфликт учитывается */
  serverWins?: boolean;
  /** §3.3: серверная версия сущности целиком (для замены локальной) */
  serverEntity?: unknown;
  /** §3.3: серверная updatedAt (ISO) */
  serverUpdatedAt?: string;
}

export interface SyncSlice {
  lastSaved: Date | null;
  saveError: string | null;
  lastSavedToServer: Date | null;
  lastTotalsSave: Date | null;
  totalsSaveError: string | null;
  roomSyncError: string | null;
  isSyncing: boolean;

  /** Dirty-карта SYNC-V2 (спека §2.1); дедуп: на сущность одно последнее состояние */
  dirty: DirtyMap;
  dirtyCount: number;
  /** Счётчик LWW-конфликтов, разрешённых в пользу сервера (спека §3.1) */
  conflictsResolved: number;
  lastSyncAt: Date | null;
  status: 'idle' | 'flushing' | 'error';

  initSyncListeners: () => () => void;
  scheduleSave: (newProjects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
  setSyncing: (isSyncing: boolean) => void;
  /** Пометить сущность dirty (+ персист в Dexie syncState) */
  markDirty: (entityKind: DirtyEntityKind, entityId: string, updatedAt: string) => void;
  /** Восстановить dirty-карту из Dexie syncState при старте */
  restoreDirtyState: () => Promise<void>;
  /** Снять подтверждённые флашером сущности с dirty-карты и из Dexie (batch б) */
  acknowledgeFlushed: (entries: FlushAckEntry[]) => void;
}

export type StoreState = ProjectSlice &
  ArchiveSlice &
  RoomSlice &
  ObjectSlice &
  SyncSlice &
  AuthSlice &
  WorkTemplateSlice;
