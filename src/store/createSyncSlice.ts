import type { StateCreator } from 'zustand';
import type { SyncSlice, StoreState } from './types';
import type { ProjectData } from '@shared/types';
import { logDebug, logSuccess, logError, logStart } from '../utils/logger';
import { saveQueue } from '../utils/saveQueue';
import { StorageManager } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';
import { isServerId } from '../utils/idMapper';
import { getAllRooms } from '../utils/projectObjects';
import { calculateRoomMetrics } from '../domain/geometry/geometry';
import { calculateRoomCosts } from '../domain/pricing/costs';
import { saveTotals } from '../api/totals';
import type { StorageError } from '../utils/storage';
import { dequal } from 'dequal';

const SAVE_DEBOUNCE_MS = 2000;
const TOTALS_SAVE_DEBOUNCE_MS = 2000;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: ProjectData[] | null = null;
let totalsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function clearSaveTimers() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSave = null;
  saveQueue.cancelPending();
  if (totalsSaveTimeout) {
    clearTimeout(totalsSaveTimeout);
    totalsSaveTimeout = null;
  }
}

export const createSyncSlice: StateCreator<StoreState, [], [], SyncSlice> = (set, get) => ({
  lastSaved: null,
  saveError: null,
  lastSavedToServer: null,
  lastTotalsSave: null,
  totalsSaveError: null,
  roomSyncError: null,
  isSyncing: false,

  setSyncing: (isSyncing: boolean) => set({ isSyncing }),

  scheduleSave: (newProjects: ProjectData[]) => {
    pendingSave = newProjects;

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      if (pendingSave) {
        const startTime = logStart('Save', 'Автосохранение проектов');
        const currentProjects = get().projects;
        const { isAuthenticated } = get();

        const saveTask = async () => {
          try {
            const projectsToSave = get().projects;
            const changedProjects = projectsToSave.filter(newProj => {
              const oldProj = currentProjects.find(p => p.id === newProj.id);
              if (!oldProj) return true;
              return !dequal(oldProj, newProj);
            });

            if (changedProjects.length === 1 && projectsToSave.length > 1) {
              const changedProject = changedProjects[0];
              logSuccess('Save', 'Инкрементальное сохранение одного проекта', {
                projectId: changedProject.id,
                name: changedProject.name,
              });

              StorageManager.saveProject(changedProject);
              set({ lastSaved: new Date() });
              logSuccess(
                'Save',
                'Сохранено в localStorage (инкрементально)',
                {
                  projectId: changedProject.id,
                },
                startTime,
              );

              if (isAuthenticated) {
                const apiProvider = ApiStorageProvider.getInstance();
                const serverStartTime = logStart('Save', 'Сохранение проекта на сервер');
                await apiProvider.saveProjectAsync(changedProject);
                set({ lastSavedToServer: new Date(), saveError: null });
                logSuccess(
                  'Save',
                  'Проект сохранен на сервере (инкрементально)',
                  {
                    projectId: changedProject.id,
                  },
                  serverStartTime,
                );
              }
            } else {
              StorageManager.saveProjects(projectsToSave);
              set({ lastSaved: new Date() });
              logSuccess(
                'Save',
                'Сохранено в localStorage',
                {
                  count: projectsToSave.length,
                  projectIds: projectsToSave.map(p => p.id),
                },
                startTime,
              );

              if (isAuthenticated) {
                const apiProvider = ApiStorageProvider.getInstance();
                const serverStartTime = logStart('Save', 'Сохранение на сервер');
                await apiProvider.saveProjectsAsync(projectsToSave);
                set({ lastSavedToServer: new Date(), saveError: null });
                logSuccess(
                  'Save',
                  'Сохранено на сервер',
                  {
                    count: projectsToSave.length,
                  },
                  serverStartTime,
                );
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

        saveQueue.enqueue(saveTask, pendingSave);
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

  initSyncListeners: () => {
    let syncPendingRef: ProjectData[] | null = null;

    const handleBeforeUnload = () => {
      if (pendingSave) {
        StorageManager.saveProjects(pendingSave);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && saveQueue.hasPendingData) {
        logDebug('SyncDomain', 'Вкладка активна, проверяем pending сохранения');
        const pendingData = saveQueue.getPendingData();
        if (pendingData && Array.isArray(pendingData) && !syncPendingRef) {
          syncPendingRef = pendingData as ProjectData[];
          get().scheduleSave(syncPendingRef);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const checkRoomSyncErrors = () => {
      const { isAuthenticated } = get();
      if (!isAuthenticated) return;

      const apiProvider = ApiStorageProvider.getInstance();
      const errors = apiProvider.getRoomSyncErrors();

      if (errors.size > 0) {
        const errorMessages = Array.from(errors.entries()).map(([key, value]) => {
          const roomId = key.split(':')[1];
          return `Комната ${roomId}: ${value.error.message}`;
        });
        set({ roomSyncError: `Ошибка синхронизации комнат: ${errorMessages.join('; ')}` });
      } else {
        set({ roomSyncError: null });
      }
    };

    const roomSyncInterval = setInterval(checkRoomSyncErrors, 5000);

    if (saveQueue.hasPendingData) {
      const { isAuthenticated } = get();
      if (isAuthenticated) {
        const pendingData = saveQueue.getPendingData();
        if (pendingData && Array.isArray(pendingData)) {
          logDebug('ProjectContext', 'Восстановление pending сохранений', {
            count: pendingData.length,
          });
          syncPendingRef = pendingData as ProjectData[];
          get().scheduleSave(syncPendingRef);
        }
      }
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(roomSyncInterval);
      clearSaveTimers();
    };
  },
});
