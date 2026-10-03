// SPLIT-ME: 648 строк > порога 400 — вынести архив-экшены в createArchiveSlice.ts (задача в docs/TODO.md)
import type { StateCreator } from 'zustand';
import type { ProjectSlice, StoreState } from './types';
import type { ProjectData } from '@shared/types';
import { StorageManager } from '../utils/storage';
import type { StorageError } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';

import {
  logUserAction,
  logSuccess,
  logError,
  logStart,
  logEnd,
  logStateChange,
  logWarning,
  logDebug,
} from '../utils/logger';
import { runMigrations, needsMigration } from '../utils/migration';
import { idMapper, IdMapper } from '../utils/idMapper';
import { migrateProjectToObjects, getObjectFromProject } from '../utils/projectObjects';
import { createProject } from '../domain/factories/projectFactory';
import { clearSaveTimers } from './createSyncSlice';
import { saveQueue } from '../utils/saveQueue';
import * as projectsApi from '../api/projects';

/** In-flight promises безвозвратного удаления — идемпотентность повторных кликов */
const permanentDeleteInflight = new Map<string, Promise<{ objects: number; rooms: number }>>();

/**
 * Собрать ID всех объектов и комнат проекта — обход дерева из state.
 * idMapper не знает parent-chain, поэтому список потомков готовит вызывающий слой.
 */
function collectProjectEntityIds(project: ProjectData): string[] {
  const ids: string[] = [];
  for (const obj of project.objects ?? []) {
    ids.push(obj.id);
    for (const room of obj.rooms ?? []) {
      ids.push(room.id);
    }
  }
  for (const room of project.rooms ?? []) {
    ids.push(room.id);
  }
  return ids;
}

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

function computeActiveProject(
  projects: ProjectData[],
  activeProjectId: string,
): ProjectData | null {
  return projects.find(p => p.id === activeProjectId) || null;
}

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectSlice> = (set, get) => ({
  projects: [],
  activeProjectId: '',
  activeProject: null,
  isLoading: true,
  error: null,
  deletingIds: [],

  initialize: async (initialProjects: ProjectData[], isAuthenticated: boolean) => {
    const migratedInitial = initialProjects.map(migrateProject);

    set({
      isLoading: true,
      error: null,
      isAuthenticated,
    });

    const startTime = logStart('ProjectContext', 'Загрузка данных', { isAuthenticated });

    try {
      if (isAuthenticated) {
        logUserAction('Загрузка проектов с сервера (авторизован)');
        const apiProvider = ApiStorageProvider.getInstance();
        let serverProjects = await apiProvider.loadProjectsAsync();

        if (needsMigration()) {
          logDebug('ProjectContext', 'Требуется миграция данных');
          try {
            const migrationResult = await runMigrations(serverProjects);
            if (migrationResult.duplicatesRemoved > 0) {
              logSuccess('ProjectContext', 'Миграция выполнена', migrationResult);
              serverProjects = await apiProvider.loadProjectsAsync();
            }
          } catch (migrationError) {
            logError('ProjectContext', 'Ошибка миграции', migrationError);
          }
        }

        if (serverProjects.length > 0) {
          const migratedProjects = serverProjects.map(migrateProject);
          logSuccess(
            'ProjectContext',
            'Проекты загружены с сервера',
            {
              count: migratedProjects.length,
              projectIds: migratedProjects.map(p => p.id),
            },
            startTime,
          );

          const savedActiveProject = StorageManager.loadActiveProject();
          let actualActiveId = savedActiveProject;
          if (savedActiveProject && IdMapper.isLocalId(savedActiveProject)) {
            const mappedId = idMapper.getServerId(savedActiveProject);
            if (mappedId) {
              actualActiveId = mappedId;
              StorageManager.saveActiveProject(mappedId);
              logDebug('ProjectContext', 'Активный проект мигрирован', {
                oldId: savedActiveProject,
                newId: mappedId,
              });
            }
          }

          const activeExists = migratedProjects.some(p => p.id === actualActiveId);
          const finalActiveId =
            actualActiveId && activeExists ? actualActiveId : migratedProjects[0].id;

          const activeProject = computeActiveProject(migratedProjects, finalActiveId);
          const activeObject = activeProject?.objects?.[0] || null;

          set({
            projects: migratedProjects,
            activeProjectId: finalActiveId,
            activeProject,
            activeObjectId: null,
            activeObject,
            isLoading: false,
          });
          logStateChange('ProjectContext', 'Активный проект', finalActiveId);
        } else {
          logWarning('ProjectContext', 'На сервере нет проектов, проверяем localStorage');
          const localProjects = await StorageManager.loadProjectsAsync();
          if (localProjects && localProjects.length > 0) {
            const migratedProjects = localProjects.map(migrateProject);
            logSuccess(
              'ProjectContext',
              'Проекты загружены из localStorage',
              {
                count: migratedProjects.length,
              },
              startTime,
            );

            const activeProject = migratedProjects[0];
            const activeObject = activeProject?.objects?.[0] || null;

            set({
              projects: migratedProjects,
              activeProjectId: migratedProjects[0].id,
              activeProject,
              activeObjectId: null,
              activeObject,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        }
      } else {
        logUserAction('Загрузка проектов из IndexedDB (не авторизован)');
        const savedProjects = await StorageManager.loadProjectsAsync();
        const savedActiveProject = await StorageManager.loadActiveProjectAsync();

        if (savedProjects && savedProjects.length > 0) {
          const migratedProjects = savedProjects.map(migrateProject);
          logSuccess(
            'ProjectContext',
            'Проекты загружены из localStorage',
            {
              count: migratedProjects.length,
              projectIds: migratedProjects.map(p => p.id),
            },
            startTime,
          );

          const activeExists = savedProjects.some(p => p.id === savedActiveProject);
          const finalActiveId =
            savedActiveProject && activeExists ? savedActiveProject : savedProjects[0].id;

          const activeProject = computeActiveProject(migratedProjects, finalActiveId);
          const activeObject = activeProject?.objects?.[0] || null;

          set({
            projects: migratedProjects,
            activeProjectId: finalActiveId,
            activeProject,
            activeObjectId: null,
            activeObject,
            isLoading: false,
          });
          logStateChange('ProjectContext', 'Активный проект', finalActiveId);
        } else {
          logSuccess(
            'ProjectContext',
            'Первый запуск - используются демонстрационные проекты',
            {
              count: migratedInitial.length,
              projectIds: migratedInitial.map(p => p.id),
            },
            startTime,
          );

          if (migratedInitial.length > 0) {
            StorageManager.saveProjects(migratedInitial);
            StorageManager.saveActiveProject(migratedInitial[0].id);

            const activeProject = migratedInitial[0];
            const activeObject = activeProject?.objects?.[0] || null;

            set({
              projects: migratedInitial,
              activeProjectId: migratedInitial[0].id,
              activeProject,
              activeObjectId: null,
              activeObject,
              isLoading: false,
            });
            logStateChange('ProjectContext', 'Активный проект', migratedInitial[0].id);
          } else {
            set({
              projects: [],
              activeProjectId: '',
              activeProject: null,
              activeObject: null,
              isLoading: false,
            });
            logStateChange('ProjectContext', 'Активный проект', null);
          }
        }
      }

      logEnd('ProjectContext', 'Загрузка данных завершена', startTime);
    } catch (err) {
      logError('ProjectContext', 'Ошибка загрузки данных', err);
      set({
        error: { type: 'unknown', message: 'Ошибка загрузки данных' } as StorageError,
        isLoading: false,
      });
    }
  },

  setActiveProjectId: (id: string) => {
    logUserAction('Переключение активного проекта', { projectId: id });
    StorageManager.saveActiveProject(id);
    logStateChange('ProjectContext', 'Активный проект', id);

    set(state => {
      const activeProject = computeActiveProject(state.projects, id);
      const activeObject = activeProject?.objects?.[0] || null;
      return { activeProjectId: id, activeProject, activeObjectId: null, activeObject };
    });
  },

  updateProjects: (newProjects: ProjectData[]) => {
    set(state => {
      const activeProject = computeActiveProject(newProjects, state.activeProjectId);
      const activeObject =
        activeProject && state.activeObjectId
          ? getObjectFromProject(activeProject, state.activeObjectId)
          : activeProject?.objects?.[0] || null;

      return { projects: newProjects, activeProject, activeObject };
    });
    get().scheduleSave(newProjects);
    const active = newProjects.find(p => p.id === get().activeProjectId);
    if (active && get().isAuthenticated) {
      get().scheduleTotalsSave(active);
    }
  },

  updateActiveProject: (updatedProject: ProjectData) => {
    set(state => {
      const newProjects = state.projects.map(p =>
        p.id === updatedProject.id ? updatedProject : p,
      );
      const activeProject = computeActiveProject(newProjects, state.activeProjectId);
      const activeObject =
        activeProject && state.activeObjectId
          ? getObjectFromProject(activeProject, state.activeObjectId)
          : activeProject?.objects?.[0] || null;

      return { projects: newProjects, activeProject, activeObject };
    });
    const newProjects = get().projects;
    get().scheduleSave(newProjects);
    if (get().isAuthenticated) {
      get().scheduleTotalsSave(updatedProject);
    }
  },

  createProject: async (data: {
    name: string;
    city?: string;
    objects?: string[];
  }): Promise<ProjectData> => {
    get().setSyncing(true);
    const startTime = logStart('ProjectContext', 'Создание проекта', data);

    try {
      const { isAuthenticated } = get();

      if (isAuthenticated) {
        logDebug('ProjectContext', 'Создание проекта на сервере', data);
        const apiProvider = ApiStorageProvider.getInstance();
        const newProject = await apiProvider.createProjectAsync(data);

        // We use the factory to generate the objects structure with local unique IDs, mapped to the server-assigned project ID
        if (data.objects && data.objects.length > 0) {
          const generatedProject = createProject(data, {
            isAuthenticated: true,
            generatedId: newProject.id,
          });
          newProject.objects = generatedProject.objects;
          await apiProvider.saveProjectsAsync([newProject]);
        }

        logSuccess(
          'ProjectContext',
          'Проект создан на сервере',
          {
            id: newProject.id,
            name: newProject.name,
            objectsCount: newProject.objects?.length || 0,
          },
          startTime,
        );

        set(state => {
          const updated = [...state.projects, newProject];
          const activeProject = newProject;
          const activeObject = activeProject?.objects?.[0] || null;
          return {
            projects: updated,
            activeProjectId: newProject.id,
            activeProject,
            activeObjectId: null,
            activeObject,
          };
        });
        StorageManager.saveActiveProject(newProject.id);
        get().scheduleSave(get().projects);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        get().setSyncing(false);
        return newProject;
      } else {
        logDebug('ProjectContext', 'Создание локального проекта', data);

        const newProject = createProject(data, { isAuthenticated: false });

        logSuccess(
          'ProjectContext',
          'Локальный проект создан',
          {
            id: newProject.id,
            name: newProject.name,
            objectsCount: newProject.objects?.length || 0,
          },
          startTime,
        );

        set(state => {
          const updated = [...state.projects, newProject];
          const activeProject = newProject;
          const activeObject = activeProject?.objects?.[0] || null;
          return {
            projects: updated,
            activeProjectId: newProject.id,
            activeProject,
            activeObjectId: null,
            activeObject,
          };
        });
        StorageManager.saveActiveProject(newProject.id);
        get().scheduleSave(get().projects);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        get().setSyncing(false);
        return newProject;
      }
    } catch (err) {
      logError('ProjectContext', 'Ошибка создания проекта', err, data);
      get().setSyncing(false);
      throw err;
    }
  },

  deleteProject: async (projectId: string) => {
    logUserAction('Удаление проекта', { projectId });
    get().setSyncing(true);
    const startTime = logStart('ProjectContext', 'Удаление проекта', { projectId });

    try {
      saveQueue.cancelPending();
      clearSaveTimers();

      const { isAuthenticated, activeProjectId } = get();

      if (isAuthenticated) {
        const apiProvider = ApiStorageProvider.getInstance();
        apiProvider.markProjectDeleted(projectId);

        logDebug('ProjectContext', 'Удаление проекта на сервере', { projectId });
        try {
          await apiProvider.deleteProjectAsync(projectId);
          logSuccess('ProjectContext', 'Проект удалён с сервера', { projectId }, startTime);
        } catch (serverError) {
          logError('ProjectContext', 'Ошибка удаления на сервере, удаляем локально', serverError, {
            projectId,
          });
          set({ saveError: 'Не удалось удалить проект на сервере. Проект удалён локально.' });
          setTimeout(() => set({ saveError: null }), 5000);
        }
      }

      set(state => {
        const updated = state.projects.filter(p => p.id !== projectId);
        let newActiveId = state.activeProjectId;
        let newActiveProject = state.activeProject;
        let newActiveObjectId = state.activeObjectId;
        let newActiveObject = state.activeObject;

        if (activeProjectId === projectId) {
          const remaining = updated;
          if (remaining.length > 0) {
            newActiveId = remaining[0].id;
            newActiveProject = remaining[0];
            newActiveObjectId = null;
            newActiveObject = newActiveProject?.objects?.[0] || null;
            StorageManager.saveActiveProject(newActiveId);
            logStateChange('ProjectContext', 'Активный проект (после удаления)', newActiveId);
          } else {
            newActiveId = '';
            newActiveProject = null;
            newActiveObjectId = null;
            newActiveObject = null;
            localStorage.removeItem('repair-calc-active-project');
            logStateChange('ProjectContext', 'Активный проект (после удаления)', null);
          }
        }

        return {
          projects: updated,
          activeProjectId: newActiveId,
          activeProject: newActiveProject,
          activeObjectId: newActiveObjectId,
          activeObject: newActiveObject,
        };
      });

      const currentProjects = get().projects;
      get().scheduleSave(currentProjects);

      logEnd('ProjectContext', 'Удаление проекта завершено', startTime);
    } catch (err) {
      logError('ProjectContext', 'Критическая ошибка удаления проекта', err, { projectId });
      set({ saveError: 'Ошибка при удалении проекта' });
      get().setSyncing(false);
      setTimeout(() => set({ saveError: null }), 5000);
      throw err;
    }
    get().setSyncing(false);
  },

  fetchArchivedProjects: async () => {
    if (!get().isAuthenticated) {
      logWarning('ProjectContext', 'Гостевой режим: список архивных проектов недоступен');
      return [];
    }

    try {
      const response = await projectsApi.getArchivedProjects();
      const archived = response.data.map(item => ({
        ...projectsApi.apiToClientProject(item),
        objectsCount: item.objectsCount,
        roomsCount: item.roomsCount,
      }));
      logSuccess('ProjectContext', 'Архивные проекты загружены', { count: archived.length });
      return archived;
    } catch (err) {
      logError('ProjectContext', 'Ошибка загрузки архивных проектов', err);
      throw err;
    }
  },

  restoreProject: async (projectId: string) => {
    if (!get().isAuthenticated) {
      logWarning('ProjectContext', 'Гостевой режим: восстановление проекта недоступно', {
        projectId,
      });
      throw new Error('Гостевой режим: восстановление проекта недоступно');
    }

    const serverId = idMapper.getServerId(projectId) ?? projectId;

    try {
      const response = await projectsApi.restoreProject(serverId);
      const restored = migrateProject(projectsApi.apiToClientProject(response.data));

      set(state => {
        const exists = state.projects.some(p => p.id === restored.id);
        const projects = exists
          ? state.projects.map(p => (p.id === restored.id ? restored : p))
          : [...state.projects, restored];
        const activeProject = computeActiveProject(projects, state.activeProjectId);
        const activeObject =
          activeProject && state.activeObjectId
            ? getObjectFromProject(activeProject, state.activeObjectId)
            : activeProject?.objects?.[0] || null;
        return { projects, activeProject, activeObject };
      });

      logSuccess('ProjectContext', 'Проект восстановлен из архива', { projectId });
      return restored;
    } catch (err) {
      logWarning('ProjectContext', 'Ошибка восстановления проекта', { projectId });
      throw err;
    }
  },

  permanentDeleteProject: async (projectId: string) => {
    const inflight = permanentDeleteInflight.get(projectId);
    if (inflight) {
      logDebug(
        'ProjectContext',
        'Безвозвратное удаление уже выполняется, повторный вызов ожидает его',
        {
          projectId,
        },
      );
      return inflight;
    }

    const task = (async (): Promise<{ objects: number; rooms: number }> => {
      if (!get().isAuthenticated) {
        logWarning('ProjectContext', 'Гостевой режим: безвозвратное удаление недоступно', {
          projectId,
        });
        throw new Error('Гостевой режим: безвозвратное удаление проекта недоступно');
      }

      set(state => ({ deletingIds: [...state.deletingIds, projectId] }));

      try {
        const serverId = idMapper.getServerId(projectId) ?? projectId;
        const response = await projectsApi.permanentDeleteProject(serverId);
        const deleted = response.data.deleted;

        // Потомки собираем ДО удаления из state — idMapper не знает parent-chain
        const target = get().projects.find(p => p.id === projectId);
        const descendantIds = target ? collectProjectEntityIds(target) : [];

        set(state => {
          const projects = state.projects.filter(p => p.id !== projectId);
          let activeProjectId = state.activeProjectId;
          let activeProject = state.activeProject;
          let activeObjectId = state.activeObjectId;
          let activeObject = state.activeObject;

          if (activeProjectId === projectId) {
            if (projects.length > 0) {
              activeProjectId = projects[0].id;
              activeProject = projects[0];
              activeObjectId = null;
              activeObject = activeProject.objects?.[0] || null;
              StorageManager.saveActiveProject(activeProjectId);
            } else {
              activeProjectId = '';
              activeProject = null;
              activeObjectId = null;
              activeObject = null;
              localStorage.removeItem('repair-calc-active-project');
            }
            logStateChange(
              'ProjectContext',
              'Активный проект (после безвозвратного удаления)',
              activeProjectId || null,
            );
          }

          return { projects, activeProjectId, activeProject, activeObjectId, activeObject };
        });

        idMapper.clearProject(projectId, descendantIds);
        get().scheduleSave(get().projects);

        logSuccess('ProjectContext', 'Проект удалён безвозвратно', {
          projectId,
          objects: deleted.objects,
          rooms: deleted.rooms,
        });
        return deleted;
      } catch (err) {
        logWarning('ProjectContext', 'Ошибка безвозвратного удаления проекта', { projectId });
        throw err;
      } finally {
        set(state => ({ deletingIds: state.deletingIds.filter(id => id !== projectId) }));
      }
    })();

    permanentDeleteInflight.set(projectId, task);
    task.then(
      () => permanentDeleteInflight.delete(projectId),
      () => permanentDeleteInflight.delete(projectId),
    );
    return task;
  },
});
