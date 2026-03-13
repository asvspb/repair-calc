/**
 * API Storage Provider — реализация IStorageProvider через REST API
 * Используется для синхронизации данных с сервером при авторизованном пользователе
 */

import type { IStorageProvider } from '../../types/storage';
import { StorageProviderError } from '../../types/storage';
import type { ProjectData } from '../../types';
import * as projectsApi from '../projects';

const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
} as const;

/**
 * Провайдер хранилища через API
 * Делегирует операции с проектами серверу, остальные данные хранит в localStorage
 */
export class ApiStorageProvider implements IStorageProvider {
  private static instance: ApiStorageProvider | null = null;
  private projectsCache: Map<string, ProjectData> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 секунд

  private constructor() {}

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
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Сохранение значения в хранилище
   * Для проектов использует API (асинхронно), для остальных ключей — localStorage
   */
  set<T>(key: string, value: T): void {
    // Проекты сохраняем через API
    if (key === STORAGE_KEYS.PROJECTS) {
      // Обновляем кэш немедленно для UI
      const projects = value as ProjectData[];
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // Асинхронное сохранение на сервер — вызывающий код должен использовать saveProjectsAsync
      throw new StorageProviderError(
        'unknown',
        'Use saveProjectsAsync for API storage'
      );
    }

    // Остальные данные в localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Асинхронное сохранение проектов
   * Сравнивает локальные проекты с серверными и синхронизирует изменения
   */
  async saveProjectsAsync(projects: ProjectData[]): Promise<void> {
    try {
      // Обновляем кэш немедленно
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // TODO: Реализовать синхронизацию с сервером
      // Пока используем гибридный режим — сохраняем также в localStorage как бэкап
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Асинхронная загрузка проектов с сервера
   */
  async loadProjectsAsync(): Promise<ProjectData[]> {
    try {
      const response = await projectsApi.getProjects();
      const projects = response.data.map(projectsApi.apiToClientProject);
      
      // Обновляем кэш
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // Сохраняем также в localStorage как кэш
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

      return projects;
    } catch (error) {
      // При ошибке пробуем загрузить из localStorage
      const cached = this.loadFromLocalStorage<ProjectData[]>(STORAGE_KEYS.PROJECTS);
      if (cached) {
        this.projectsCache.clear();
        cached.forEach(p => this.projectsCache.set(p.id, p));
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
        return cached;
      }
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Создание нового проекта на сервере
   */
  async createProjectAsync(data: { name: string; city?: string }): Promise<ProjectData> {
    try {
      const response = await projectsApi.createProject(data);
      const project = projectsApi.apiToClientProject(response.data);
      
      // Добавляем в кэш
      this.projectsCache.set(project.id, project);
      
      return project;
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Обновление проекта на сервере
   */
  async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
    try {
      const response = await projectsApi.updateProject(project.id, {
        name: project.name,
        city: project.city || null,
        use_ai_pricing: project.useAiPricing,
        last_ai_price_update: project.lastAiPriceUpdate || null,
      });
      const updated = projectsApi.apiToClientProject(response.data);
      
      // Обновляем кэш
      this.projectsCache.set(project.id, updated);
      
      return updated;
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Удаление проекта на сервере
   */
  async deleteProjectAsync(projectId: string): Promise<void> {
    try {
      await projectsApi.deleteProject(projectId);
      
      // Удаляем из кэша
      this.projectsCache.delete(projectId);
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Получение полного проекта с комнатами
   */
  async getProjectWithRoomsAsync(projectId: string): Promise<ProjectData | null> {
    try {
      const response = await projectsApi.getProject(projectId);
      const project = projectsApi.apiToClientProject(response.data);
      
      // Обновляем в кэше
      this.projectsCache.set(project.id, project);
      
      return project;
    } catch (error) {
      if (error instanceof projectsApi.ProjectsApiError && error.statusCode === 404) {
        return null;
      }
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Удаление значения из хранилища
   */
  remove(key: string): void {
    if (key === STORAGE_KEYS.PROJECTS) {
      this.projectsCache.clear();
      this.cacheExpiry = 0;
    }
    localStorage.removeItem(key);
  }

  /**
   * Очистка всего хранилища
   */
  clear(): void {
    this.projectsCache.clear();
    this.cacheExpiry = 0;
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
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
      percentage: (used * 2 / total) * 100,
    };
  }

  /**
   * Загрузка из localStorage
   */
  private loadFromLocalStorage<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Функция для определения, какой провайдер использовать
 * Возвращает ApiStorageProvider если пользователь авторизован, иначе LocalStorageProvider
 */
export function getStorageProvider(): IStorageProvider {
  const token = localStorage.getItem('token');
  if (token) {
    return ApiStorageProvider.getInstance();
  }
  // Импортируем динамически чтобы избежать циклической зависимости
  const { LocalStorageProvider } = require('../../utils/localStorageProvider');
  return LocalStorageProvider.getInstance();
}