import type { ProjectData } from '@shared/types';
import type { StateCreator } from 'zustand';
import type { ProjectSlice, StoreState } from './types';
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
import { migrateProject } from './projectMigration';

type ProjectSet = Parameters<StateCreator<StoreState, [], [], ProjectSlice>>[0];

function computeActiveProject(
  projects: ProjectData[],
  activeProjectId: string,
): ProjectData | null {
  return projects.find(p => p.id === activeProjectId) || null;
}

/**
 * Реализация initialize project-слайса (P3-SPLIT): загрузка проектов с сервера
 * (авторизован) или из локального хранилища (гость), миграции, выбор активного
 * проекта. Вынесена из createProjectSlice ради порога ≤400 строк; поведение
 * не менялось.
 */
export async function initializeProjects(
  set: ProjectSet,
  initialProjects: ProjectData[],
  isAuthenticated: boolean,
): Promise<void> {
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
}
