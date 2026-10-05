/**
 * Storage API exports.
 *
 * SYNC-V2 (спека §4, §5(г)): включается только env-флагом VITE_SYNC_V2=true
 * (см. isSyncV2Enabled в syncFlusher). Без флага — прежний путь (ApiStorageProvider
 * через legacy CRUD + saveAllProjects); флаг в прод-конфигах не включается.
 */

export { ApiStorageProvider, getStorageProvider } from './apiStorageProvider';
export { isSyncV2Enabled } from './syncFlusher';
