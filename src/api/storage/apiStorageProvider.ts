/**
 * API Storage Provider — реализация IStorageProvider через REST API.
 * Тонкий фасад: очередь/ретраи — apiClient.ts, синхронизация проектов — projectApi.ts,
 * CRUD проектов/объектов — objectApi.ts, комнаты — roomApi.ts (TASK-BATCH-012).
 * Используется для синхронизации данных с сервером при авторизованном пользователе.
 */

import type { IStorageProvider } from '../../types/storage';
import { StorageProviderError } from '../../types/storage';
import type { ProjectData } from '@shared/types';
import { IndexedDbProvider } from './indexedDbProvider';
import { STORAGE_KEYS } from '../../utils/storageConstants';
import { logError } from '../../utils/logger';
import { RequestQueue } from './apiClient';
import type { ApiCache, ApiSyncContext } from './apiClient';
import * as projectSync from './projectApi';
import * as objectCrud from './objectApi';
import { RoomSyncErrors, syncProjectRooms } from './roomApi';

const MIN_REQUEST_INTERVAL = 500; // 500ms между запросами
const MAX_RETRIES = 3;
const CACHE_TTL = 30000; // 30 секунд

/**
 * Провайдер хранилища через API
 * Делегирует операции с проектами серверу, остальные данные хранит в localStorage
 */
export class ApiStorageProvider implements IStorageProvider {
  private static instance: ApiStorageProvider | null = null;
  private projectsCache: Map<string, ProjectData> = new Map();
  private cacheExpiry: number = 0;
  private readonly queue = new RequestQueue(MIN_REQUEST_INTERVAL, MAX_RETRIES);
  private readonly roomSyncErrors = new RoomSyncErrors();

  private constructor() {}

  /**
   * Кэш проектов (Map + TTL) в интерфейсе ApiCache для модулей синхронизации
   */
  private readonly cache: ApiCache = {
    values: () => Array.from(this.projectsCache.values()),
    set: (id, project) => {
      this.projectsCache.set(id, project);
      this.cacheExpiry = Date.now() + CACHE_TTL;
    },
    delete: id => {
      this.projectsCache.delete(id);
    },
    clear: () => {
      this.projectsCache.clear();
    },
    touchExpiry: () => {
      this.cacheExpiry = Date.now() + CACHE_TTL;
    },
  };

  /**
   * Контекст синхронизации для projectApi/objectApi/roomApi
   */
  private readonly ctx: ApiSyncContext = {
    cache: this.cache,
    queue: this.queue,
  };

  /**
   * Получение singleton instance
   */
  static getInstance(): ApiStorageProvider {
    if (!ApiStorageProvider.instance) {
      ApiStorageProvider.instance = new ApiStorageProvider();
    }
    return ApiStorageProvider.instance;
  }

  /**
   * Сброс instance (для тестов или переключения пользователя)
   */
  static resetInstance(): void {
    ApiStorageProvider.instance = null;
  }

  /**
   * Отметка проекта как удаленный
   */
  markProjectDeleted(projectId: string): void {
    this.queue.markProjectDeleted(projectId);
  }

  /**
   * Сброс кэша удаленных проектов
   */
  clearDeletedProjects(): void {
    this.queue.clearDeletedProjects();
  }

  /**
   * Очистка кэша проектов
   */
  clearCache(): void {
    this.projectsCache.clear();
    this.cacheExpiry = 0;
  }

  /**
   * Проверка актуальности кэша
   */
  private isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry && this.projectsCache.size > 0;
  }

  /**
   * Получение значения из хранилища
   * Для проектов использует API, для остальных ключей — localStorage
   */
  get<T>(key: string): T | null {
    // Проекты загружаем через API (синхронно из кэша, если актуален)
    if (key === STORAGE_KEYS.PROJECTS) {
      // Возвращаем кэшированные данные, если они актуальны
      if (this.isCacheValid()) {
        return Array.from(this.projectsCache.values()) as T;
      }
      // Если кэш не актуален, возвращаем null — нужна асинхронная загрузка
      return null;
    }

    // Остальные данные из localStorage
    return objectCrud.loadFromLocalStorage<T>(key);
  }

  /**
   * Получение значения из хранилища (асинхронно)
   * Для проектов загружает с сервера, для остальных ключей — localStorage
   */
  async getAsync<T>(key: string): Promise<T | null> {
    if (key === STORAGE_KEYS.PROJECTS) {
      // Для проектов используем загрузку с сервера
      if (this.isCacheValid()) {
        return Array.from(this.projectsCache.values()) as T;
      }
      // Загружаем с сервера
      try {
        const projects = await this.loadProjectsAsync();
        return projects as T;
      } catch (error) {
        logError('ApiStorage', 'Ошибка загрузки проектов', error);
        return null;
      }
    }

    // Остальные данные из localStorage
    return Promise.resolve(this.get<T>(key));
  }

  /**
   * Сохранение значения в хранилище
   * Для проектов использует API (асинхронно через saveProjectsAsync), для остальных ключей — localStorage
   * Примечание: для PROJECTS ключа метод синхронно обновляет кэш и localStorage (бэкап),
   * а синхронизация с сервером происходит асинхронно через saveProjectsAsync
   */
  set<T>(key: string, value: T): void {
    // Проекты сохраняем в кэш и localStorage (бэкап), серверная синхронизация — через saveProjectsAsync
    if (key === STORAGE_KEYS.PROJECTS) {
      const projects = value as ProjectData[];

      // Обновляем кэш немедленно для UI
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + CACHE_TTL;

      // Сохраняем в localStorage как бэкап
      try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
      } catch (error) {
        throw StorageProviderError.fromError(error);
      }

      // Синхронизация с сервера происходит через debounce в ProjectContext.scheduleSave
      return;
    }

    // Остальные данные в localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Сохранение значения в хранилище (асинхронно)
   * Для проектов вызывает saveProjectsAsync для синхронизации с сервером
   */
  async setAsync<T>(key: string, value: T): Promise<void> {
    if (key === STORAGE_KEYS.PROJECTS) {
      // Для проектов используем полную синхронизацию с сервером
      await this.saveProjectsAsync(value as ProjectData[]);
      return;
    }

    // Остальные данные в localStorage
    return Promise.resolve(this.set(key, value));
  }

  /**
   * Асинхронное сохранение проектов (полная синхронизация с сервером)
   */
  async saveProjectsAsync(projects: ProjectData[]): Promise<ProjectData[]> {
    return projectSync.saveAllProjects(this.ctx, projects);
  }

  /**
   * Инкрементальное сохранение одного проекта (эффективнее полной синхронизации)
   */
  async saveProjectAsync(project: ProjectData): Promise<ProjectData> {
    return projectSync.saveProjectIncremental(this.ctx, project);
  }

  /**
   * Синхронизация комнат проекта с сервером
   * Возвращает массив ошибок для комнат, которые не удалось синхронизировать
   */
  private async syncRooms(project: ProjectData, existingProjects: ProjectData[]): Promise<Error[]> {
    return syncProjectRooms(this.ctx, this.roomSyncErrors, project, existingProjects);
  }

  /**
   * Получение ошибок синхронизации комнат
   */
  getRoomSyncErrors(): Map<string, { error: Error; timestamp: number }> {
    return this.roomSyncErrors.snapshot();
  }

  /**
   * Очистка ошибок синхронизации комнат
   */
  clearRoomSyncErrors(): void {
    this.roomSyncErrors.clear();
  }

  /**
   * Асинхронная загрузка проектов с сервера
   */
  async loadProjectsAsync(): Promise<ProjectData[]> {
    return objectCrud.loadProjectsAsync(this.ctx);
  }

  /**
   * Создание нового проекта на сервере
   */
  async createProjectAsync(data: { name: string; city?: string }): Promise<ProjectData> {
    return objectCrud.createProjectAsync(this.ctx, data);
  }

  /**
   * Обновление проекта на сервере
   */
  async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
    return objectCrud.updateProjectAsync(this.ctx, project);
  }

  /**
   * Удаление проекта на сервере
   */
  async deleteProjectAsync(projectId: string): Promise<void> {
    return objectCrud.deleteProjectAsync(this.ctx, projectId);
  }

  /**
   * Получение полного проекта с комнатами
   */
  async getProjectWithRoomsAsync(projectId: string): Promise<ProjectData | null> {
    return objectCrud.getProjectWithRoomsAsync(this.ctx, projectId);
  }

  /**
   * Удаление значения из хранилища (синхронно)
   */
  remove(key: string): void {
    if (key === STORAGE_KEYS.PROJECTS) {
      this.projectsCache.clear();
      this.cacheExpiry = 0;
    }
    localStorage.removeItem(key);
  }

  /**
   * Удаление значения из хранилища (асинхронно)
   */
  async removeAsync(key: string): Promise<void> {
    return Promise.resolve(this.remove(key));
  }

  /**
   * Очистка всего хранилища (синхронно)
   */
  clear(): void {
    this.projectsCache.clear();
    this.cacheExpiry = 0;
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
  }

  /**
   * Очистка всего хранилища (асинхронно)
   */
  async clearAsync(): Promise<void> {
    return Promise.resolve(this.clear());
  }

  /**
   * Получение информации о хранилище
   */
  getStorageInfo(): { used: number; total: number; percentage: number } {
    // Для API хранилища сложно определить лимиты, используем localStorage как ориентир
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }
    // Принимаем 5MB как типичный лимит localStorage
    const total = 5 * 1024 * 1024;
    return {
      used: used * 2, // UTF-16 encoding
      total,
      percentage: ((used * 2) / total) * 100,
    };
  }
}

/**
 * Функция для определения, какой провайдер использовать
 * Возвращает ApiStorageProvider если пользователь авторизован, иначе IndexedDbProvider
 */
export function getStorageProvider(): IStorageProvider {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    return ApiStorageProvider.getInstance();
  }
  return IndexedDbProvider.getInstance();
}
