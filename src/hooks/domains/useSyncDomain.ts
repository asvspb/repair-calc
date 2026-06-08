import { useCallback, useEffect, useRef } from 'react';
import type { ProjectData } from '../../types';
import {
  logDebug,
} from '../../utils/logger';
import { saveQueue } from '../../utils/saveQueue';

export interface SyncDomainState {
  _initSync: () => void;
}

interface SyncDomainDeps {
  isAuthenticated: boolean;
  scheduleSave: (projects: ProjectData[]) => void;
}

export function useSyncDomain({ isAuthenticated: _isAuthenticated, scheduleSave }: SyncDomainDeps): SyncDomainState {
  const pendingSaveRef = useRef<ProjectData[] | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && saveQueue.hasPendingData) {
        logDebug('SyncDomain', 'Вкладка активна, проверяем pending сохранения');
        const pendingData = saveQueue.getPendingData();
        if (pendingData && Array.isArray(pendingData) && !pendingSaveRef.current) {
          pendingSaveRef.current = pendingData as ProjectData[];
          scheduleSave(pendingSaveRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scheduleSave]);

  const _initSync = useCallback(() => {}, []);

  return {
    _initSync,
  };
}
