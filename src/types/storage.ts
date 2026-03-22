/**
 * Storage provider interface for abstracting storage mechanisms
 * Allows easy switching between localStorage, sessionStorage, IndexedDB, or API
 */
export interface IStorageProvider {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): T | null;

  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store
   * @throws StorageError if quota exceeded or other error
   */
  set<T>(key: string, value: T): void;

  /**
   * Remove a value from storage
   * @param key - Storage key
   */
  remove(key: string): void;

  /**
   * Clear all values from storage
   */
  clear(): void;

  /**
   * Get storage usage information
   * @returns Object with used bytes, total bytes, and percentage
   */
  getStorageInfo(): { used: number; total: number; percentage: number };
}

/**
 * Storage error types
 */
export type StorageErrorType = 'quota_exceeded' | 'corrupted' | 'not_found' | 'unknown';

/**
 * Storage error class
 */
export class StorageProviderError extends Error {
  public readonly type: StorageErrorType;

  constructor(type: StorageErrorType, message: string) {
    super(message);
    this.name = 'StorageProviderError';
    this.type = type;
  }

  static fromError(error: unknown): StorageProviderError {
    if (error instanceof StorageProviderError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        return new StorageProviderError(
          'quota_exceeded',
          'Превышен лимит хранилища. Удалите старые данные или создайте бэкап.'
        );
      }

      return new StorageProviderError('unknown', error.message);
    }

    return new StorageProviderError('unknown', 'Неизвестная ошибка хранилища');
  }
}

/**
 * ID Mapping types for object management
 * Used to track migration of local objects to server with UUID
 */
export interface IdMapping {
  localId: string;      // локальный ID (например, local-1711123456789)
  serverId: string;     // серверный UUID (например, 550e8400-e29b-41d4-a716-446655440000)
  migratedAt: Date;     // дата миграции
  deviceId?: string;    // ID устройства (для multi-device sync)
}

/**
 * Storage structure for ID mappings
 */
export interface IdMappingStore {
  mappings: Record<string, IdMapping>;  // key = localId
  lastCleanup: Date;
}

/**
 * Project status for object management UI
 */
export interface ProjectStatus {
  id: string;
  name: string;
  status: 'synced' | 'local' | 'conflict';
  roomsCount: number;
  dataSize: number;
  lastSynced?: Date;
  duplicateOf?: string;
  similarity?: number;
}

/**
 * Duplicate information for conflict resolution
 */
export interface DuplicateInfo {
  originalId: string;
  duplicateId: string;
  similarity: number; // 0-1
  createdAt: Date;
}