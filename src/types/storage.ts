/**
 * Интерфейс для абстракции хранилища данных.
 * Позволяет переключаться между localStorage, IndexedDB, серверным API и т.д.
 */
export interface IStorageProvider {
  // Projects
  saveProjects(projects: unknown[]): Promise<void>;
  loadProjects(): Promise<unknown[] | null>;
  
  // Active project
  saveActiveProject(projectId: string): Promise<void>;
  loadActiveProject(): Promise<string | null>;
  
  // Work templates
  saveWorkTemplates(templates: unknown[]): Promise<void>;
  loadWorkTemplates(): Promise<unknown[] | null>;
  
  // Utility
  clearAll(): Promise<void>;
  getStorageInfo(): Promise<{ used: number; total: number; percentage: number }>;
}

/**
 * Ошибка хранилища
 */
export interface StorageError {
  type: 'quota_exceeded' | 'corrupted' | 'not_found' | 'unknown';
  message: string;
  cause?: Error;
}

/**
 * Результат импорта данных
 */
export interface ImportResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
}

/**
 * Данные бэкапа
 */
export interface BackupData {
  version: string;
  exportedAt: string;
  projects: unknown[];
  activeProjectId: string;
  workTemplates?: unknown[];
}