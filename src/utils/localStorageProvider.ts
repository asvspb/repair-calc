import type { IStorageProvider } from '../types/storage';
import { StorageProviderError } from '../types/storage';

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
   * Get a value from localStorage
   */
  get<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      // Remove corrupted data to prevent repeated errors
      try {
        localStorage.removeItem(key);
        console.info(`Removed corrupted data from localStorage key "${key}"`);
      } catch {
        // Ignore removal errors
      }
      return null;
    }
  }

  /**
   * Set a value in localStorage
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
   * Remove a value from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }

  /**
   * Clear all values from localStorage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
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
      console.error('Error calculating storage usage:', error);
    }
    
    // Approximate localStorage limit (5-10 MB)
    const total = 5 * 1024 * 1024; // 5 MB
    const percentage = Math.min((used / total) * 100, 100);
    
    return { used, total, percentage };
  }
}