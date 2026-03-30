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
  logWarning,
} from '../../utils/logger';
import { idMapper } from '../../utils/idMapper';

const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
} as const;

/**
 * Очередь запросов с rate limiting для предотвращения 429 ошибок
 */
interface QueuedRequest {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  retryCount: number;
  projectId?: string;
}

/**
 * Провайдер хранилища через API
 * Делегирует операции с проектами серверу, остальные данные хранит в localStorage
 */
export class ApiStorageProvider implements IStorageProvider {
  private static instance: ApiStorageProvider | null = null;
  private projectsCache: Map<string, ProjectData> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 секунд
  
  // Rate limiting и queue
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 500; // 500ms между запросами
  private readonly MAX_RETRIES = 3;
  private deletedProjects = new Set<string>(); // Трекаем удаленные проекты

  private constructor() {}

  /**
   * Добавление запроса в очередь с rate limiting
   */
  private async enqueueRequest<T>(
    execute: () => Promise<T>,
    projectId?: string
  ): Promise<T> {
    let resolvePromise: (value: T) => void;
    let rejectPromise: (error: Error) => void;

    const resultPromise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const request: QueuedRequest = {
      execute: async () => {
        try {
          const result = await execute();
          resolvePromise!(result);
        } catch (error) {
          rejectPromise!(error instanceof Error ? error : new Error(String(error)));
          // Re-throw for processQueue error handling (retry logic)
          throw error;
        }
      },
      resolve: () => {},
      reject: () => {},
      retryCount: 0,
      projectId,
    };

    this.requestQueue.push(request);
    this.processQueue();

    return resultPromise;
  }

  /**
   * Обработка очереди запросов
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue[0];

        // Проверяем, не удален ли проект
        if (request.projectId && this.deletedProjects.has(request.projectId)) {
          logDebug('ApiStorage', 'Пропуск запроса для удаленного проекта', { projectId: request.projectId });
          this.requestQueue.shift();
          continue;
        }

        // Rate limiting: ждем минимальный интервал между запросами
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
          await new Promise(resolve =>
            setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
          );
        }

        try {
          this.lastRequestTime = Date.now();
          await request.execute();
          this.requestQueue.shift();
        } catch (error) {
          // Обработка 429 ошибок с exponential backoff
          if (this.isRateLimitError(error) && request.retryCount < this.MAX_RETRIES) {
            request.retryCount++;
            const backoffDelay = Math.min(1000 * Math.pow(2, request.retryCount), 10000);
            logWarning('ApiStorage', `Rate limit, повторная попытка ${request.retryCount}/${this.MAX_RETRIES} через ${backoffDelay}ms`);

            // Не сдвигаем запрос, ждем и пробуем снова
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            // Продолжаем цикл с тем же запросом
          } else {
            // Максимум попыток исчерпан или другая ошибка
            this.requestQueue.shift();
            // Reject уже был вызван внутри execute(), но логируем ошибку
            logError('ApiStorage', 'Ошибка запроса после всех попыток', error, { projectId: request.projectId });
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Проверка на 429 ошибку
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof projectsApi.ProjectsApiError && error.statusCode === 429) {
      return true;
    }
    if (error instanceof roomsApi.RoomsApiError && error.statusCode === 429) {
      return true;
    }
    return false;
  }

  /**
   * Отметка проекта как удаленный
   */
  markProjectDeleted(projectId: string): void {
    this.deletedProjects.add(projectId);
    // Очищаем очередь от запросов для этого проекта
    this.requestQueue = this.requestQueue.filter(req => req.projectId !== projectId);
  }

  /**
   * Сброс кэша удаленных проектов
   */
  clearDeletedProjects(): void {
    this.deletedProjects.clear();
  }

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
   * Использует маппинг ID для предотвращения дублирования
   * Возвращает обновлённый список проектов с серверными ID
   */
  async saveProjectsAsync(projects: ProjectData[]): Promise<ProjectData[]> {
    const startTime = logStart('ApiStorage', 'Сохранение проектов', { count: projects.length });

    // Отслеживаем мигрировавшие проекты для обновления списка
    const migratedProjects: { localId: string; serverId: string }[] = [];

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
      const existingProjects = await this.enqueueRequest(() => this.loadProjectsAsync());
      const existingProjectIds = new Set(existingProjects.map(p => p.id));

      // Синхронизируем каждый проект через очередь
      const syncPromises: Promise<void>[] = [];
      
      for (const project of projects) {
        const isServerProject = this.isServerId(project.id);
        const existsOnServer = existingProjectIds.has(project.id);

        // Проверяем есть ли маппинг для локального ID
        const mappedServerId = !isServerProject ? idMapper.getServerId(project.id) : null;

        if (mappedServerId && existingProjectIds.has(mappedServerId)) {
          // Уже есть маппинг и проект существует на сервере — обновляем по серверному ID
          logDebug('ApiStorage', 'Обновление мигрированного проекта', {
            localId: project.id,
            serverId: mappedServerId
          });
          const syncPromise = this.enqueueRequest(async () => {
            try {
              const projectWithServerId = { ...project, id: mappedServerId };
              await this.updateProjectAsync(projectWithServerId);
              await this.syncRooms(projectWithServerId, existingProjects);
            } catch (error) {
              logError('ApiStorage', 'Ошибка обновления мигрированного проекта', error, {
                localId: project.id,
                serverId: mappedServerId
              });
            }
          }, project.id);
          syncPromises.push(syncPromise);
        } else if (isServerProject && existsOnServer) {
          // Серверный проект — обновляем
          logDebug('ApiStorage', 'Обновление проекта на сервере', { projectId: project.id });
          const syncPromise = this.enqueueRequest(async () => {
            try {
              await this.updateProjectAsync(project);
              await this.syncRooms(project, existingProjects);
            } catch (error) {
              logError('ApiStorage', 'Ошибка синхронизации проекта', error, { projectId: project.id });
            }
          }, project.id);
          syncPromises.push(syncPromise);
        } else if (!isServerProject) {
          // Локальный проект без маппинга — мигрируем на сервер
          logDebug('ApiStorage', 'Миграция локального проекта на сервер', {
            projectId: project.id,
            name: project.name
          });
          const syncPromise = this.enqueueRequest(async () => {
            try {
              const newProject = await this.createProjectAsync({
                name: project.name,
                city: project.city,
              });

              // Сохраняем маппинг
              idMapper.addMapping(project.id, newProject.id);
              migratedProjects.push({ localId: project.id, serverId: newProject.id });

              logSuccess('ApiStorage', 'Проект мигрирован', {
                localId: project.id,
                serverId: newProject.id
              });

              // Синхронизируем комнаты нового проекта
              for (const room of project.rooms) {
                try {
                  await this.enqueueRequest(() => roomsApi.createRoom(newProject.id, room), project.id);
                  logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: newProject.id });
                } catch (roomError) {
                  logError('ApiStorage', 'Ошибка создания комнаты', roomError, { roomId: room.id });
                }
              }
            } catch (error) {
              logError('ApiStorage', 'Ошибка миграции проекта', error, { projectId: project.id });
            }
          }, project.id);
          syncPromises.push(syncPromise);
        } else {
          // Серверный ID, но проекта нет на сервере — создаём заново
          // Это может произойти при импорте JSON с другого устройства/аккаунта
          logDebug('ApiStorage', 'Создание проекта с серверным ID', {
            projectId: project.id,
            name: project.name
          });
          const syncPromise = this.enqueueRequest(async () => {
            try {
              // Создаём новый проект на сервере
              const newProject = await this.createProjectAsync({
                name: project.name,
                city: project.city,
              });

              // Сохраняем маппинг старого ID на новый
              idMapper.addMapping(project.id, newProject.id);
              migratedProjects.push({ localId: project.id, serverId: newProject.id });

              logSuccess('ApiStorage', 'Проект создан (импортирован)', {
                oldId: project.id,
                newId: newProject.id
              });

              // Синхронизируем комнаты нового проекта
              for (const room of project.rooms) {
                try {
                  await this.enqueueRequest(() => roomsApi.createRoom(newProject.id, room), project.id);
                  logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: newProject.id });
                } catch (roomError) {
                  logError('ApiStorage', 'Ошибка создания комнаты', roomError, { roomId: room.id });
                }
              }
            } catch (error) {
              logError('ApiStorage', 'Ошибка создания проекта при импорте', error, { projectId: project.id });
            }
          }, project.id);
          syncPromises.push(syncPromise);
        }
      }

      // Ждем завершения всех синхронизаций
      await Promise.all(syncPromises);

      // Если были миграции — обновляем кэш с серверными ID
      if (migratedProjects.length > 0) {
        logDebug('ApiStorage', 'Обновление кэша после миграции', { count: migratedProjects.length });

        // Загружаем актуальный список с сервера
        const updatedProjects = await this.enqueueRequest(() => this.loadProjectsAsync());

        // Удаляем локальные дубликаты из localStorage
        const localIdsToRemove = new Set(migratedProjects.map(m => m.localId));
        const cleanedProjects = updatedProjects.filter(p => !localIdsToRemove.has(p.id) || this.isServerId(p.id));

        // Обновляем localStorage только серверными версиями
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(cleanedProjects));

        // Обновляем кэш
        this.projectsCache.clear();
        cleanedProjects.forEach(p => this.projectsCache.set(p.id, p));
        this.cacheExpiry = Date.now() + this.CACHE_TTL;

        logSuccess('ApiStorage', 'Миграция завершена, дубликаты удалены', {
          migratedCount: migratedProjects.length
        });
      }

      logSuccess('ApiStorage', 'Проекты успешно синхронизированы', { count: projects.length }, startTime);
      
      // Возвращаем обновлённый список проектов
      return Array.from(this.projectsCache.values());
    } catch (error) {
      logError('ApiStorage', 'Ошибка сохранения проектов', error);
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Синхронизация комнат проекта с debounce для предотвращения rate limiting
   */
  private async syncRooms(project: ProjectData, existingProjects: ProjectData[]): Promise<void> {
    const serverProject = existingProjects.find(p => p.id === project.id);
    const existingRoomIds = new Set(serverProject?.rooms.map(r => r.id) || []);

    // Синхронизируем комнаты последовательно с rate limiting
    for (const room of project.rooms) {
      const roomExistsOnServer = this.isServerId(room.id) && existingRoomIds.has(room.id);

      try {
        if (roomExistsOnServer) {
          await this.enqueueRequest(() => roomsApi.updateRoom(room.id, room), project.id);
          logDebug('ApiStorage', 'Комната обновлена', { roomId: room.id });
        } else {
          await this.enqueueRequest(() => roomsApi.createRoom(project.id, room), project.id);
          logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: project.id });
        }
      } catch (roomError) {
        // Игнорируем 429 ошибки для комнат - они будут обработаны retry logic
        if (this.isRateLimitError(roomError)) {
          logWarning('ApiStorage', 'Room sync rate limited, will retry', { roomId: room.id });
        } else {
          logError('ApiStorage', 'Ошибка синхронизации комнаты', roomError, { roomId: room.id });
        }
      }
    }
  }

  /**
   * Асинхронная загрузка проектов с сервера
   * Использует /api/sync/pull для получения проектов с комнатами
   * Примечание: логирование происходит внутри syncPull в projects.ts
   */
  async loadProjectsAsync(): Promise<ProjectData[]> {
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

      return projects;
    } catch (error) {
      
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
   * Примечание: логирование происходит внутри createProject в projects.ts
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
   * Примечание: логирование происходит внутри updateProject в projects.ts
   */
  async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
    const updateData: {
      name: string;
      city?: string;
      use_ai_pricing?: boolean;
      last_ai_price_update?: string | null;
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

    // НЕ отправляем version — сервер сам инкрементирует при обновлении
    // Это предотвращает 403 Version conflict ошибки

    try {
      const response = await projectsApi.updateProject(project.id, updateData);
      const updated = projectsApi.apiToClientProject(response.data);

      // Обновляем кэш
      this.projectsCache.set(project.id, updated);

      return updated;
    } catch (error) {
      // При 403 (Version conflict) пробуем обновить без версии — ошибка уже исправлена выше
      // Просто пробрасываем ошибку для обработки выше
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Удаление проекта на сервере
   * Примечание: логирование происходит внутри deleteProject в projects.ts
   */
  async deleteProjectAsync(projectId: string): Promise<void> {
    // Помечаем проект как удаленный ДО запроса, чтобы отменить pending запросы
    // Но сам DELETE запрос делаем БЕЗ projectId в очереди, чтобы он не был пропущен
    this.markProjectDeleted(projectId);

    try {
      // Выполняем удаление без привязки к projectId (иначе запрос будет пропущен)
      await this.enqueueRequest(async () => {
        await projectsApi.deleteProject(projectId);
      }, undefined);

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