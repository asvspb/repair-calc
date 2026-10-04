/**
 * Storage constants — единый источник истины для ключей localStorage и версии.
 * Вынесен из storage.ts для разрыва циклической зависимости с templateStorage.ts.
 */
export const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
  LAST_BACKUP: 'repair-calc-last-backup',
  WORK_TEMPLATES: 'repair-calc-work-templates',
  // Auth-токены (значения исторические — НЕ менять, риск потери сессий)
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  // Служебные ключи
  E2E_TEST_MODE: 'e2e-test-mode',
  ID_MAPPINGS: 'repair-calc-id-mappings',
  DEVICE_ID: 'device-id',
  PENDING_SAVE: 'repair-calc-pending-save',
  MIGRATION_VERSION: 'repair-calc-migration-version',
  PRICE_CACHE: 'repair-calc-price-cache',
  DEXIE_MIGRATED: 'dexie_migrated',
} as const;

export const CURRENT_VERSION = '1.0.0';
