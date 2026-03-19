/**
 * API Storage Provider — реализация IStorageProvider через REST API
 * Используется для синхронизации данных с сервером при авторизованном пользователе
 */

import type { IStorageProvider } from '../../types/storage';
import { StorageProviderError } from '../../types/storage';
import type { ProjectData, RoomData } from '../../types';
import * as projectsApi from '../projects';
import * as roomsApi from '../rooms';
import {
  logApiRequest,
  logApiSuccess,
  logApiError,
  logStart,
  logSuccess,
  logError,
  logDebug,
} from '../../utils/logger';

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
   * Проверка, является ли ID серверным UUID
   */
  private isServerId(id: string): boolean {
    // UUID формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Асинхронное сохранение проектов
   * Синхронизирует проекты и комнаты с сервером
   */
  async saveProjectsAsync(projects: ProjectData[]): Promise<void> {
    const startTime = logStart('ApiStorage', 'Сохранение проектов', { count: projects.length });
    
    try {
      // Обновляем кэш немедленно для UI
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // Сохраняем также в localStorage как бэкап
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
      logDebug('ApiStorage', 'Проекты сохранены в localStorage как бэкап');

      // Получаем список существующих ID проектов на сервере
      logDebug('ApiStorage', 'Загрузка существующих проектов с сервера');
      const existingProjects = await this.loadProjectsAsync();
      const existingProjectIds = new Set(existingProjects.map(p => p.id));

      // Синхронизируем каждый проект
      for (const project of projects) {
        const isServerProject = this.isServerId(project.id);
        const existsOnServer = existingProjectIds.has(project.id);
        
        if (!isServerProject || !existsOnServer) {
          // Создаём новый проект на сервере (для локальных ID или если не существует)
          logDebug('ApiStorage', 'Создание нового проекта на сервере', { 
            projectId: project.id, 
            name: project.name,
            isLocalId: !isServerProject 
          });
          try {
            const newProject = await this.createProjectAsync({
              name: project.name,
              city: project.city,
            });
            
            logSuccess('ApiStorage', 'Проект создан на сервере', { 
              oldId: project.id, 
              newId: newProject.id 
            });
            
            // Синхронизируем комнаты нового проекта
            for (const room of project.rooms) {
              try {
                await roomsApi.createRoom(newProject.id, room);
                logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: newProject.id });
              } catch (roomError) {
                logError('ApiStorage', 'Ошибка создания комнаты', roomError, { roomId: room.id });
              }
            }
          } catch (error) {
            logError('ApiStorage', 'Ошибка создания проекта', error, { projectId: project.id });
          }
        } else {
          // Обновляем существующий проект
          logDebug('ApiStorage', 'Обновление проекта на сервере', { projectId: project.id });
          try {
            await this.updateProjectAsync(project);
            
            // Получаем список существующих комнат
            const serverProject = existingProjects.find(p => p.id === project.id);
            const existingRoomIds = new Set(serverProject?.rooms.map(r => r.id) || []);
            
            // Синхронизируем комнаты
            for (const room of project.rooms) {
              const roomExistsOnServer = this.isServerId(room.id) && existingRoomIds.has(room.id);
              
              try {
                if (roomExistsOnServer) {
                  // Обновляем существующую комнату
                  await roomsApi.updateRoom(room.id, room);
                  logDebug('ApiStorage', 'Комната обновлена', { roomId: room.id });
                } else {
                  // Создаём новую комнату
                  await roomsApi.createRoom(project.id, room);
                  logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: project.id });
                }
              } catch (roomError) {
                logError('ApiStorage', 'Ошибка синхронизации комнаты', roomError, { roomId: room.id });
              }
            }
          } catch (error) {
            logError('ApiStorage', 'Ошибка синхронизации проекта', error, { projectId: project.id });
          }
        }
      }
      
      logSuccess('ApiStorage', 'Проекты успешно синхронизированы', { count: projects.length }, startTime);
    } catch (error) {
      logError('ApiStorage', 'Ошибка сохранения проектов', error);
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Асинхронная загрузка проектов с сервера
   * Использует /api/sync/pull для получения проектов с комнатами
   */
  async loadProjectsAsync(): Promise<ProjectData[]> {
    const startTime = logApiRequest('GET', '/api/sync/pull');
    
    try {
      // Используем sync/pull для получения проектов с комнатами
      const response = await projectsApi.syncPull();
      const projects = response.data.projects.map(projectsApi.apiToClientProject);
      
      // Обновляем кэш
      this.projectsCache.clear();
      projects.forEach(p => this.projectsCache.set(p.id, p));
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // Сохраняем также в localStorage как кэш
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

      logApiSuccess('GET', '/api/sync/pull', startTime, { 
        projectsCount: projects.length,
        projectIds: projects.map(p => p.id) 
      });

      return projects;
    } catch (error) {
      logApiError('GET', '/api/sync/pull', startTime, error);
      
      // При ошибке пробуем загрузить из localStorage
      logDebug('ApiStorage', 'Попытка загрузки из localStorage при ошибке');
      const cached = this.loadFromLocalStorage<ProjectData[]>(STORAGE_KEYS.PROJECTS);
      if (cached) {
        this.projectsCache.clear();
        cached.forEach(p => this.projectsCache.set(p.id, p));
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
        logDebug('ApiStorage', 'Проекты загружены из localStorage', { count: cached.length });
        return cached;
      }
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Создание нового проекта на сервере
   */
  async createProjectAsync(data: { name: string; city?: string }): Promise<ProjectData> {
    const startTime = logApiRequest('POST', '/api/projects', data);
    
    try {
      const response = await projectsApi.createProject(data);
      const project = projectsApi.apiToClientProject(response.data);
      
      // Добавляем в кэш
      this.projectsCache.set(project.id, project);
      
      logApiSuccess('POST', '/api/projects', startTime, { projectId: project.id, name: project.name });
      
      return project;
    } catch (error) {
      logApiError('POST', '/api/projects', startTime, error);
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Обновление проекта на сервере
   */
  async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
    const updateData: {
      name: string;
      city?: string;
      use_ai_pricing?: boolean;
      last_ai_price_update?: string | null;
      version?: number;
    } = {
      name: project.name,
    };

    // Only include city if it's a non-empty string
    if (typeof project.city === 'string' && project.city.trim() !== '') {
      updateData.city = project.city;
    }

    // Only include use_ai_pricing if it's defined (convert from number if needed)
    if (project.useAiPricing !== undefined) {
      updateData.use_ai_pricing = Boolean(project.useAiPricing);
    }

    // Include last_ai_price_update if present
    if (project.lastAiPriceUpdate !== undefined) {
      updateData.last_ai_price_update = project.lastAiPriceUpdate || null;
    }

    // Include version if present
    if (project.version !== undefined) {
      updateData.version = project.version;
    }

    const startTime = logApiRequest('PUT', `/api/projects/${project.id}`, updateData);

    try {
      const response = await projectsApi.updateProject(project.id, updateData);
      const updated = projectsApi.apiToClientProject(response.data);

      // Обновляем кэш
      this.projectsCache.set(project.id, updated);

      logApiSuccess('PUT', `/api/projects/${project.id}`, startTime, { projectId: project.id });

      return updated;
    } catch (error) {
      logApiError('PUT', `/api/projects/${project.id}`, startTime, error);
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Удаление проекта на сервере
   */
  async deleteProjectAsync(projectId: string): Promise<void> {
    const startTime = logApiRequest('DELETE', `/api/projects/${projectId}`);
    
    try {
      await projectsApi.deleteProject(projectId);
      
      // Удаляем из кэша
      this.projectsCache.delete(projectId);
      
      logApiSuccess('DELETE', `/api/projects/${projectId}`, startTime, { projectId });
    } catch (error) {
      logApiError('DELETE', `/api/projects/${projectId}`, startTime, error);
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