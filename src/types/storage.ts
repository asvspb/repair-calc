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