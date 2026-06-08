import type { StateCreator } from 'zustand';
import type { ProjectSlice, StoreState } from './types';
import type { ProjectData, ObjectData } from '../types';
import { StorageManager } from '../utils/storage';
import type { StorageError } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';
import { saveTotals } from '../api/totals';
import { calculateRoomMetrics } from '../utils/geometry';
import { calculateRoomCosts } from '../utils/costs';
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
import { idMapper, IdMapper, isServerId } from '../utils/idMapper';
import { saveQueue } from '../utils/saveQueue';
import { getAllRooms, migrateProjectToObjects, getObjectFromProject } from '../utils/projectObjects';

const SAVE_DEBOUNCE_MS = 2000;
const TOTALS_SAVE_DEBOUNCE_MS = 2000;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: ProjectData[] | null = null;
let totalsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

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

function computeActiveProject(projects: ProjectData[], activeProjectId: string): ProjectData | null {
  return projects.find(p => p.id === activeProjectId) || null;
}

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectSlice> = (set, get) => ({
  projects: [],
  activeProjectId: '',
  activeProject: null,
  isLoading: true,
  error: null,
  lastSaved: null,
  saveError: null,
  lastSavedToServer: null,
  lastTotalsSave: null,
  totalsSaveError: null,
  roomSyncError: null,
  isSyncing: false,
  isAuthenticated: false,

  setIsAuthenticated: (value: boolean) => {
    set({ isAuthenticated: value });
  },

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
          logSuccess('ProjectContext', 'Проекты загружены с сервера', {
            count: migratedProjects.length,
            projectIds: migratedProjects.map(p => p.id),
          }, startTime);

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
          const finalActiveId = (actualActiveId && activeExists)
            ? actualActiveId
            : migratedProjects[0].id;

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
          const localProjects = StorageManager.loadProjects();
          if (localProjects && localProjects.length > 0) {
            const migratedProjects = localProjects.map(migrateProject);
            logSuccess('ProjectContext', 'Проекты загружены из localStorage', {
              count: migratedProjects.length,
            }, startTime);

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
        logUserAction('Загрузка проектов из localStorage (не авторизован)');
        const savedProjects = StorageManager.loadProjects();
        const savedActiveProject = StorageManager.loadActiveProject();

        if (savedProjects && savedProjects.length > 0) {
          const migratedProjects = savedProjects.map(migrateProject);
          logSuccess('ProjectContext', 'Проекты загружены из localStorage', {
            count: migratedProjects.length,
            projectIds: migratedProjects.map(p => p.id),
          }, startTime);

          const activeExists = savedProjects.some(p => p.id === savedActiveProject);
          const finalActiveId = (savedActiveProject && activeExists)
            ? savedActiveProject
            : savedProjects[0].id;

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
          logSuccess('ProjectContext', 'Первый запуск - используются демонстрационные проекты', {
            count: migratedInitial.length,
            projectIds: migratedInitial.map(p => p.id),
          }, startTime);

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

    set((state) => {
      const activeProject = computeActiveProject(state.projects, id);
            const activeObject = activeProject?.objects?.[0] || null;
      return { activeProjectId: id, activeProject, activeObjectId: null, activeObject };
    });
  },

  updateProjects: (newProjects: ProjectData[]) => {
    set((state) => {
      const activeProject = computeActiveProject(newProjects, state.activeProjectId);
            const activeObject = activeProject && state.activeObjectId
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
    set((state) => {
      const newProjects = state.projects.map(p =>
        p.id === updatedProject.id ? updatedProject : p
      );
      const activeProject = computeActiveProject(newProjects, state.activeProjectId);
            const activeObject = activeProject && state.activeObjectId
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

  createProject: async (data: { name: string; city?: string; objects?: string[] }): Promise<ProjectData> => {
    logUserAction('Создание проекта', data);
    set({ isSyncing: true });
    const startTime = logStart('ProjectContext', 'Создание проекта', data);

    const generateId = (prefix: string): string =>
      `${prefix}-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10)}`;

    try {
      const { isAuthenticated } = get();
      if (isAuthenticated) {
        logDebug('ProjectContext', 'Создание проекта на сервере', data);
        const apiProvider = ApiStorageProvider.getInstance();
        const newProject = await apiProvider.createProjectAsync(data);

        if (data.objects && data.objects.length > 0) {
          const objects: ObjectData[] = data.objects.map((objName, index) => ({
            id: generateId('obj'),
            projectId: newProject.id,
            name: objName,
            city: data.city,
            rooms: [],
            sortOrder: index,
          }));
          newProject.objects = objects;
          await apiProvider.saveProjectsAsync([newProject]);
        }

        logSuccess('ProjectContext', 'Проект создан на сервере', {
          id: newProject.id,
          name: newProject.name,
          objectsCount: newProject.objects?.length || 0,
        }, startTime);

        set((state) => {
          const updated = [...state.projects, newProject];
          const activeProject = newProject;
                    const activeObject = activeProject?.objects?.[0] || null;
          return { projects: updated, activeProjectId: newProject.id, activeProject, activeObjectId: null, activeObject };
        });
        StorageManager.saveActiveProject(newProject.id);
        get().scheduleSave(get().projects);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        set({ isSyncing: false });
        return newProject;
      } else {
        logDebug('ProjectContext', 'Создание локального проекта', data);

        const objects: ObjectData[] = (data.objects || ['Основной объект']).map((objName, index) => ({
          id: generateId('obj'),
          projectId: generateId('local'),
          name: objName,
          city: data.city,
          rooms: [],
          sortOrder: index,
        }));

        const newProject: ProjectData = {
          id: generateId('local'),
          name: data.name,
          city: data.city,
          objects: objects,
        };

        logSuccess('ProjectContext', 'Локальный проект создан', {
          id: newProject.id,
          name: newProject.name,
          objectsCount: objects.length,
        }, startTime);

        set((state) => {
          const updated = [...state.projects, newProject];
          const activeProject = newProject;
          const activeObject = activeProject?.objects?.[0] || null;
          return { projects: updated, activeProjectId: newProject.id, activeProject, activeObjectId: null, activeObject };
        });
        StorageManager.saveActiveProject(newProject.id);
        get().scheduleSave(get().projects);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        set({ isSyncing: false });
        return newProject;
      }
    } catch (err) {
      logError('ProjectContext', 'Ошибка создания проекта', err, data);
      set({ isSyncing: false });
      throw err;
    }
  },

  deleteProject: async (projectId: string) => {
    logUserAction('Удаление проекта', { projectId });
    set({ isSyncing: true });
    const startTime = logStart('ProjectContext', 'Удаление проекта', { projectId });

    try {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      pendingSave = null;

      const { isAuthenticated, activeProjectId, projects } = get();

      if (isAuthenticated) {
        const apiProvider = ApiStorageProvider.getInstance();
        apiProvider.markProjectDeleted(projectId);

        logDebug('ProjectContext', 'Удаление проекта на сервере', { projectId });
        try {
          await apiProvider.deleteProjectAsync(projectId);
          logSuccess('ProjectContext', 'Проект удалён с сервера', { projectId }, startTime);
        } catch (serverError) {
          logError('ProjectContext', 'Ошибка удаления на сервере, удаляем локально', serverError, { projectId });
          set({ saveError: 'Не удалось удалить проект на сервере. Проект удалён локально.' });
          setTimeout(() => set({ saveError: null }), 5000);
        }
      }

      set((state) => {
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
      set({
        saveError: 'Ошибка при удалении проекта',
        isSyncing: false,
      });
      setTimeout(() => set({ saveError: null }), 5000);
      throw err;
    }
    set({ isSyncing: false });
  },

  scheduleSave: (newProjects: ProjectData[]) => {
    pendingSave = newProjects;

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      if (pendingSave) {
        const startTime = logStart('Save', 'Автосохранение проектов');
        const projectsToSave = pendingSave;
        const currentProjects = get().projects;
        const { isAuthenticated } = get();

        const saveTask = async () => {
          try {
            const changedProjects = projectsToSave.filter(newProj => {
              const oldProj = currentProjects.find(p => p.id === newProj.id);
              if (!oldProj) return true;
              return JSON.stringify(oldProj) !== JSON.stringify(newProj);
            });

            if (changedProjects.length === 1 && projectsToSave.length > 1) {
              const changedProject = changedProjects[0];
              logSuccess('Save', 'Инкрементальное сохранение одного проекта', {
                projectId: changedProject.id,
                name: changedProject.name,
              });

              StorageManager.saveProject(changedProject);
              set({ lastSaved: new Date() });
              logSuccess('Save', 'Сохранено в localStorage (инкрементально)', {
                projectId: changedProject.id,
              }, startTime);

              if (isAuthenticated) {
                const apiProvider = ApiStorageProvider.getInstance();
                const serverStartTime = logStart('Save', 'Сохранение проекта на сервер');
                await apiProvider.saveProjectAsync(changedProject);
                set({ lastSavedToServer: new Date(), saveError: null });
                logSuccess('Save', 'Проект сохранен на сервере (инкрементально)', {
                  projectId: changedProject.id,
                }, serverStartTime);
              }
            } else {
              StorageManager.saveProjects(projectsToSave);
              set({ lastSaved: new Date() });
              logSuccess('Save', 'Сохранено в localStorage', {
                count: projectsToSave.length,
                projectIds: projectsToSave.map(p => p.id),
              }, startTime);

              if (isAuthenticated) {
                const apiProvider = ApiStorageProvider.getInstance();
                const serverStartTime = logStart('Save', 'Сохранение на сервер');
                await apiProvider.saveProjectsAsync(projectsToSave);
                set({ lastSavedToServer: new Date(), saveError: null });
                logSuccess('Save', 'Сохранено на сервер', {
                  count: projectsToSave.length,
                }, serverStartTime);
              }
            }
            pendingSave = null;
          } catch (err) {
            const storageError = err as StorageError;
            set({ saveError: storageError.message || 'Ошибка сохранения' });
            logError('Save', 'Ошибка сохранения', err);
            throw err;
          }
        };

        saveQueue.enqueue(saveTask, projectsToSave);
      }
    }, SAVE_DEBOUNCE_MS);
  },

  scheduleTotalsSave: (project: ProjectData) => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) return;
    if (!isServerId(project.id)) return;

    if (totalsSaveTimeout) {
      clearTimeout(totalsSaveTimeout);
    }

    const saveCalculatedTotals = async (proj: ProjectData) => {
      let totalArea = 0;
      let totalWorks = 0;
      let totalMaterials = 0;
      let totalTools = 0;

      const allRooms = getAllRooms(proj);
      allRooms.forEach(room => {
        const metrics = calculateRoomMetrics(room);
        const costs = calculateRoomCosts(room);
        totalArea += metrics.floorArea;
        totalWorks += costs.totalWork;
        totalMaterials += costs.totalMaterial;
        totalTools += costs.totalTools;
      });

      const grandTotal = totalWorks + totalMaterials + totalTools;

      try {
        await saveTotals(proj.id, {
          total_area: totalArea,
          total_works: totalWorks,
          total_materials: totalMaterials,
          total_tools: totalTools,
          grand_total: grandTotal,
        });
        set({ lastTotalsSave: new Date(), totalsSaveError: null });
      } catch (err) {
        logError('ProjectContext', 'Ошибка сохранения расчётов', err);
        set({ totalsSaveError: err instanceof Error ? err.message : 'Ошибка сохранения расчётов' });
      }
    };

    totalsSaveTimeout = setTimeout(() => {
      saveCalculatedTotals(project);
    }, TOTALS_SAVE_DEBOUNCE_MS);
  },
});

export function clearSaveTimers() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSave = null;
  if (totalsSaveTimeout) {
    clearTimeout(totalsSaveTimeout);
    totalsSaveTimeout = null;
  }
}
