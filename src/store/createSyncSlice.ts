import type { StateCreator } from 'zustand';
import type { SyncSlice, StoreState } from './types';
import type { ProjectData } from '../types';
import { logDebug } from '../utils/logger';
import { saveQueue } from '../utils/saveQueue';
import { StorageManager } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage';
import { clearSaveTimers } from './createProjectSlice';

export const createSyncSlice: StateCreator<StoreState, [], [], SyncSlice> = (set, get) => ({
  initSyncListeners: () => {
    let syncPendingRef: ProjectData[] | null = null;

    const handleBeforeUnload = () => {
      const state = get();
      if ((state as unknown as { _pendingSave?: ProjectData[] })._pendingSave) {
        StorageManager.saveProjects((state as unknown as { _pendingSave: ProjectData[] })._pendingSave);
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

    let roomSyncInterval: ReturnType<typeof setInterval> | undefined;

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

    checkRoomSyncErrors();
    roomSyncInterval = setInterval(checkRoomSyncErrors, 5000);

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
