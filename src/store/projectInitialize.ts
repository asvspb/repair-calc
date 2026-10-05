import type { ProjectData } from '@shared/types';
import type { StateCreator } from 'zustand';
import type { ProjectSlice, StoreState } from './types';
import { StorageManager } from '../utils/storage';
import type { StorageError } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';
import { syncPull, apiToClientProject } from '../features/projects/api/projects';
import { mergePull } from '../api/storage/syncMerge';
import { isSyncV2Enabled } from '../api/storage/syncFlusher';
import { getLastSyncAt, putLastSyncAt } from '../api/storage/dexieDb';
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
type ProjectGet = () => StoreState;

function computeActiveProject(
  projects: ProjectData[],
  activeProjectId: string,
): ProjectData | null {
  return projects.find(p => p.id === activeProjectId) || null;
}

/**
 * SYNC-V2 загрузка серверного дерева (спека §4, §5(г)): инкрементальный pull
 * `GET /api/sync/pull?since=<lastSyncAt>` (первый запуск — полный, §4 п.1) с LWW-слиянием
 * mergePull §3.1 против локальной копии + dirty-карты; метка lastSyncAt — серверный
 * timestamp ответа (§6.1 п.1). Ошибка pull → откат на локальную копию (паритет с legacy
 * fallback), метка не двигается.
 */
export async function loadProjectsSyncV2(get: ProjectGet): Promise<ProjectData[]> {
  const since = await getLastSyncAt();

  try {
    const response = await syncPull(since ?? undefined);
    const serverProjects = response.data.projects.map(apiToClientProject);

    // Локальная копия для слияния: персистентный бэкап (не пустой in-memory стор после reload)
    const localCopy = (await StorageManager.loadProjectsAsync()) ?? [];
    const state = get();
    const result = mergePull(serverProjects, localCopy, state.dirty);

    if (result.resolvedDirty.length > 0) {
      // §3.1: сервер затёр локальную dirty-версию — снять флаги, учесть конфликты
      state.acknowledgeFlushed(
        result.resolvedDirty.map(entry => ({ ...entry, gaveUp: false, serverWins: true })),
      );
    }
    if (result.deletedLocally.length > 0) {
      logDebug('SyncDomain', 'SYNC-V2 pull: локально удалены сущности, убранные на сервере', {
        deletedLocally: result.deletedLocally,
      });
    }
    if (result.conflictsResolved > 0) {
      logWarning('SyncDomain', 'SYNC-V2 pull: LWW-конфликты разрешены в пользу сервера', {
        count: result.conflictsResolved,
      });
    }

    await putLastSyncAt(new Date(response.data.timestamp).toISOString());
    return result.projects;
  } catch (error) {
    logWarning('SyncDomain', 'SYNC-V2 pull не удался — откат на локальную копию', error);
    const cached = await StorageManager.loadProjectsAsync();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/** Загрузка серверных проектов: развилка по флагу VITE_SYNC_V2 (спека §4, §5(г)) */
async function loadServerProjects(get: ProjectGet): Promise<ProjectData[]> {
  if (isSyncV2Enabled()) {
    return loadProjectsSyncV2(get);
  }
  const apiProvider = ApiStorageProvider.getInstance();
  return apiProvider.loadProjectsAsync();
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
  get: ProjectGet,
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
      let serverProjects = await loadServerProjects(get);

      if (needsMigration()) {
        logDebug('ProjectContext', 'Требуется миграция данных');
        try {
          const migrationResult = await runMigrations(serverProjects);
          if (migrationResult.duplicatesRemoved > 0) {
            logSuccess('ProjectContext', 'Миграция выполнена', migrationResult);
            serverProjects = await loadServerProjects(get);
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
