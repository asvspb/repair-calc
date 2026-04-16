import type { IStorageProvider } from '../types/storage';
import { StorageProviderError } from '../types/storage';
import { logError, logWarning, logDebug } from './logger';

/**
 * LocalStorage-based implementation of IStorageProvider
 */
export class LocalStorageProvider implements IStorageProvider {
  private static instance: LocalStorageProvider | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): LocalStorageProvider {
    if (!LocalStorageProvider.instance) {
      LocalStorageProvider.instance = new LocalStorageProvider();
    }
    return LocalStorageProvider.instance;
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get a value from localStorage (synchronous)
   */
  get<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      try {
        return JSON.parse(data) as T;
      } catch {
        // Check if data looks like it should be JSON (starts with { or [)
        // If so, it's corrupted data that should be removed
        const trimmed = data.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          logWarning('LocalStorage', 'Corrupted JSON data', { key });
          try {
            localStorage.removeItem(key);
            logDebug('LocalStorage', 'Removed corrupted data', { key });
          } catch {
            // Ignore removal errors
          }
          return null;
        }
        // Otherwise, return the raw string value
        // This handles legacy data that was stored without JSON.stringify
        return data as unknown as T;
      }
    } catch (error) {
      logError('LocalStorage', 'Error reading from localStorage', error, { key });
      return null;
    }
  }

  /**
   * Get a value from localStorage (asynchronous)
   * Wraps synchronous operation in Promise for API compatibility
   */
  async getAsync<T>(key: string): Promise<T | null> {
    return Promise.resolve(this.get<T>(key));
  }

  /**
   * Set a value in localStorage (synchronous)
   */
  set<T>(key: string, value: T): void {
    try {
      const data = JSON.stringify(value);
      localStorage.setItem(key, data);
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Set a value in localStorage (asynchronous)
   * Wraps synchronous operation in Promise for API compatibility
   */
  async setAsync<T>(key: string, value: T): Promise<void> {
    return Promise.resolve(this.set(key, value));
  }

  /**
   * Remove a value from localStorage (synchronous)
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logError('LocalStorage', 'Error removing localStorage key', error, { key });
    }
  }

  /**
   * Remove a value from localStorage (asynchronous)
   * Wraps synchronous operation in Promise for API compatibility
   */
  async removeAsync(key: string): Promise<void> {
    return Promise.resolve(this.remove(key));
  }

  /**
   * Clear all values from localStorage (synchronous)
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      logError('LocalStorage', 'Error clearing localStorage', error);
    }
  }

  /**
   * Clear all values from localStorage (asynchronous)
   * Wraps synchronous operation in Promise for API compatibility
   */
  async clearAsync(): Promise<void> {
    return Promise.resolve(this.clear());
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; total: number; percentage: number } {
    let used = 0;
    
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
        }
      }
    } catch (error) {
      logError('LocalStorage', 'Error calculating storage usage', error);
    }
    
    // Approximate localStorage limit (5-10 MB)
    const total = 5 * 1024 * 1024; // 5 MB
    const percentage = Math.min((used / total) * 100, 100);
    
    return { used, total, percentage };
  }
}