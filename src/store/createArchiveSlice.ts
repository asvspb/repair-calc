import type { StateCreator } from 'zustand';
import type { ArchiveSlice, StoreState } from './types';
import type { ProjectData } from '@shared/types';
import { STORAGE_KEYS } from '../utils/storageConstants';
import { StorageManager } from '../utils/storage';
import { logSuccess, logError, logWarning, logDebug, logStateChange } from '../utils/logger';
import { idMapper } from '../utils/idMapper';
import { getObjectFromProject } from '../utils/projectObjects';
import { migrateProject } from './createProjectSlice';
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

/**
 * Слайс архивных операций над проектами (список архива / restore / безвозвратное удаление).
 * Вынесен из createProjectSlice (P3-SPLIT): core-круда проектов осталась в project-слайсе,
 * архивная логика — здесь. Оба слайса композируются в useProjectStore.
 */
export const createArchiveSlice: StateCreator<StoreState, [], [], ArchiveSlice> = (set, get) => ({
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
        const activeProject = projects.find(p => p.id === state.activeProjectId) || null;
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
              localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
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
