import { STORAGE_KEYS } from '../utils/storageConstants';
import type { StateCreator } from 'zustand';
import type { ProjectSlice, StoreState } from './types';
import type { ProjectData } from '@shared/types';
import { StorageManager } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';

import {
  logUserAction,
  logSuccess,
  logError,
  logStart,
  logEnd,
  logStateChange,
  logDebug,
} from '../utils/logger';
import { getObjectFromProject } from '../utils/projectObjects';
import { createProject } from '../domain/factories/projectFactory';
import { clearSaveTimers } from './createSyncSlice';
import { saveQueue } from '../utils/saveQueue';
import { migrateProject } from './projectMigration';
import { initializeProjects } from './projectInitialize';

// Ре-экспорт для совместимости импортёров (useProjectStore, контексты)
export { migrateProject };

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

  initialize: (initialProjects: ProjectData[], isAuthenticated: boolean) =>
    initializeProjects(set, initialProjects, isAuthenticated),

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
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
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
});
