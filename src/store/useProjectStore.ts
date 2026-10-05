import { create } from 'zustand';
import type { StoreState } from './types';
import { createProjectSlice } from './createProjectSlice';
import { createArchiveSlice } from './createArchiveSlice';
import { createRoomSlice } from './createRoomSlice';
import { createObjectSlice } from './createObjectSlice';
import { createSyncSlice } from './createSyncSlice';
import type { RoomData } from '@shared/types';
import { getAllRooms } from '../utils/projectObjects';
import { clearSaveTimers } from './createSyncSlice';

import { createAuthSlice } from './createAuthSlice';
import { createWorkTemplateSlice } from './createWorkTemplateSlice';

export const useProjectStore = create<StoreState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createArchiveSlice(...a),
  ...createRoomSlice(...a),
  ...createObjectSlice(...a),
  ...createSyncSlice(...a),
  ...createAuthSlice(...a),
  ...createWorkTemplateSlice(...a),
}));

export function useRoom(roomId: string | null): RoomData | null {
  const activeProject = useProjectStore(s => s.activeProject);
  if (!roomId || !activeProject) return null;
  return getAllRooms(activeProject).find(r => r.id === roomId) || null;
}

export { migrateProject } from './createProjectSlice';

export function resetStore() {
  clearSaveTimers();
  useProjectStore.setState({
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
    activeObjectId: null,
    activeObject: null,
  });
  // ВАЖНО (фикс регресса batch 033): resetStore сбрасывает ТОЛЬКО домен проектов.
  // Auth-поля (user/isAuthenticated/authError/authIsLoading) и workTemplates —
  // отдельные домены: их сбрасывают logout/свои экшены. До миграции контекстов на
  // zustand эффект App ([isLoading, isAuthenticated, user?.id]) при переходе
  // authIsLoading вызывал resetStore и мгновенно стирал authError логина
  // (e2e auth.spec «should show error with invalid credentials»).
}
