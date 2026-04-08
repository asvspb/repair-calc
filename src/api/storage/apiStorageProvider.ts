/**
 * API Storage Provider — реализация IStorageProvider через REST API
 * Используется для синхронизации данных с сервером при авторизованном пользователе
 */

import type { IStorageProvider } from '../../types/storage';
import { StorageProviderError } from '../../types/storage';
import type { ProjectData, RoomData } from '../../types';
import * as projectsApi from '../projects';
import * as roomsApi from '../rooms';
import { getAllRooms } from '../../utils/projectObjects';
import { isServerId as isServerIdUtil } from '../../utils/idMapper';
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
  
  // Rate limiting and queue
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 500; // 500ms между запросами
  private readonly MAX_RETRIES = 3;
  private deletedProjects = new Set<string>(); // Трекаем удаленные проекты
  private roomSyncErrors = new Map<string, { error: Error; timestamp: number }>(); // Трекаем ошибки синхронизации комнат

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
        console.error('ApiStorage: ошибка загрузки проектов', error);
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
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      // Сохраняем в localStorage как бэкап
      try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
      } catch (error) {
        throw StorageProviderError.fromError(error);
      }

      // Возвращаем сразу — вызывающий код (StorageManager.saveProjects) завершён
      // Синхронизация с сервером происходит через debounce в ProjectContext.scheduleSave
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
        const isServerProject = isServerIdUtil(project.id);
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
              // updateProjectAsync теперь использует транзакционный endpoint и включает комнаты
              await this.updateProjectAsync(projectWithServerId);
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
              // updateProjectAsync теперь использует транзакционный endpoint и включает комнаты
              await this.updateProjectAsync(project);
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
              // Создаём проект на сервере
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

              // Атомарно сохраняем все комнаты через updateProjectWithObjects
              const allRooms = getAllRooms(project);
              if (allRooms.length > 0 && newProject.objects?.[0]) {
                const objectsData = [{
                  id: newProject.objects[0].id,
                  name: project.name,
                  city: project.city || null,
                  rooms: allRooms.map(room => ({
                    id: room.id,
                    name: room.name,
                    geometry_mode: room.geometryMode,
                    // Преобразуем в числа, т.к. при загрузке из localStorage они могут быть строками
                    length: Number(room.length) || 0,
                    width: Number(room.width) || 0,
                    height: Number(room.height) || 0,
                    segments: room.segments,
                    obstacles: room.obstacles,
                    wall_sections: room.wallSections,
                    sub_sections: room.subSections,
                    windows: room.windows,
                    doors: room.doors,
                    works: room.works,
                    sort_order: 0,
                  })),
                }];

                await projectsApi.updateProjectWithObjects(newProject.id, {
                  name: project.name,
                  city: project.city,
                  objects: objectsData,
                });
                logDebug('ApiStorage', 'Комнаты мигрированы через updateProjectWithObjects', {
                  roomId: newProject.id,
                  roomCount: allRooms.length
                });
              }
            } catch (error) {
              // Детальное логирование ошибки 400
              if (error instanceof Error) {
                const apiError = error as Record<string, unknown>;
                if (apiError['statusCode'] === 400 || apiError['data']) {
                  logError('ApiStorage', 'Ошибка 400 при миграции проекта', error, {
                    projectId: project.id,
                    projectName: project.name,
                    statusCode: apiError['statusCode'],
                    errorData: apiError['data'],
                    errorMessage: apiError['message'],
                  });
                } else {
                  logError('ApiStorage', 'Ошибка миграции проекта', error, { projectId: project.id });
                }
              } else {
                logError('ApiStorage', 'Ошибка миграции проекта', error, { projectId: project.id });
              }
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

              // Атомарно сохраняем все комнаты через updateProjectWithObjects
              const allRooms = getAllRooms(project);
              if (allRooms.length > 0 && newProject.objects?.[0]) {
                const objectsData = [{
                  id: newProject.objects[0].id,
                  name: project.name,
                  city: project.city || null,
                  rooms: allRooms.map(room => ({
                    id: room.id,
                    name: room.name,
                    geometry_mode: room.geometryMode,
                    // Преобразуем в числа, т.к. при загрузке из localStorage они могут быть строками
                    length: Number(room.length) || 0,
                    width: Number(room.width) || 0,
                    height: Number(room.height) || 0,
                    segments: room.segments,
                    obstacles: room.obstacles,
                    wall_sections: room.wallSections,
                    sub_sections: room.subSections,
                    windows: room.windows,
                    doors: room.doors,
                    works: room.works,
                    sort_order: 0,
                  })),
                }];

                await projectsApi.updateProjectWithObjects(newProject.id, {
                  name: project.name,
                  city: project.city,
                  objects: objectsData,
                });
                logDebug('ApiStorage', 'Комнаты импортированы через updateProjectWithObjects', {
                  roomId: newProject.id,
                  roomCount: allRooms.length
                });
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
        const cleanedProjects = updatedProjects.filter(p => !localIdsToRemove.has(p.id) || isServerIdUtil(p.id));

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
   * Incremental save: save only a single project to server
   * More efficient than saveProjectsAsync when only one project changes
   */
  async saveProjectAsync(project: ProjectData): Promise<ProjectData> {
    const startTime = logStart('ApiStorage', 'Инкрементальное сохранение проекта', {
      projectId: project.id,
      name: project.name
    });

    try {
      // Update cache immediately
      this.projectsCache.set(project.id, project);

      // Save to localStorage as backup
      const projects = this.loadProjectsFromLocal() || [];
      const index = projects.findIndex(p => p.id === project.id);
      if (index >= 0) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

      // Check if project exists on server
      const isServerProject = isServerIdUtil(project.id);
      const mappedServerId = !isServerProject ? idMapper.getServerId(project.id) : null;

      let resultProject: ProjectData;

      if (mappedServerId) {
        // Update existing migrated project
        const projectWithServerId = { ...project, id: mappedServerId };
        resultProject = await this.enqueueRequest(() => this.updateProjectAsync(projectWithServerId));
        logSuccess('ApiStorage', 'Мигрированный проект обновлен', {
          localId: project.id,
          serverId: mappedServerId
        }, startTime);
      } else if (isServerProject) {
        // Update server project directly
        resultProject = await this.enqueueRequest(() => this.updateProjectAsync(project));
        logSuccess('ApiStorage', 'Проект обновлен на сервере', { projectId: project.id }, startTime);
      } else {
        // Create new project on server
        const newProject = await this.enqueueRequest(() => this.createProjectAsync({
          name: project.name,
          city: project.city,
        }));

        // Save mapping
        idMapper.addMapping(project.id, newProject.id);

        // Save rooms/objects to new project
        if (project.objects && project.objects.length > 0) {
          const objectsData = {
            name: project.name,
            city: project.city,
            objects: project.objects.map(obj => ({
              id: obj.id,
              name: obj.name,
              city: obj.city ?? null,
              sort_order: obj.sortOrder ?? 0,
              rooms: (obj.rooms || []).map(room => ({
                id: room.id,
                name: room.name,
                geometry_mode: room.geometryMode,
                length: Number(room.length) || 0,
                width: Number(room.width) || 0,
                height: Number(room.height) || 0,
                segments: room.segments ?? [],
                obstacles: room.obstacles ?? [],
                wall_sections: room.wallSections ?? [],
                sub_sections: room.subSections ?? [],
                windows: room.windows ?? [],
                doors: room.doors ?? [],
                works: room.works ?? [],
                sort_order: room.sortOrder ?? 0,
              }))
            }))
          };
          await this.enqueueRequest(() => projectsApi.updateProjectWithObjects(newProject.id, objectsData));
        }

        resultProject = newProject;
        logSuccess('ApiStorage', 'Новый проект создан на сервере', {
          localId: project.id,
          serverId: newProject.id
        }, startTime);
      }

      return resultProject;
    } catch (error) {
      logError('ApiStorage', 'Ошибка инкрементального сохранения', error, { projectId: project.id });
      throw StorageProviderError.fromError(error);
    }
  }

  /**
   * Синхронизация комнат проекта с debounce для предотвращения rate limiting
   * Возвращает массив ошибок для комнат, которые не удалось синхронизировать
   */
  private async syncRooms(project: ProjectData, existingProjects: ProjectData[]): Promise<Error[]> {
    const serverProject = existingProjects.find(p => p.id === project.id);
    const allRooms = getAllRooms(project);
    const serverRooms = serverProject ? getAllRooms(serverProject) : [];
    const existingRoomIds = new Set(serverRooms.map(r => r.id));
    const errors: Error[] = [];

    // Синхронизируем комнаты последовательно с rate limiting
    for (const room of allRooms) {
      const roomExistsOnServer = isServerIdUtil(room.id) && existingRoomIds.has(room.id);

      try {
        if (roomExistsOnServer) {
          await this.enqueueRequest(() => roomsApi.updateRoom(room.id, room), project.id);
          logDebug('ApiStorage', 'Комната обновлена', { roomId: room.id });
          // Clear any previous error for this room
          this.roomSyncErrors.delete(`${project.id}:${room.id}`);
        } else {
          await this.enqueueRequest(() => roomsApi.createRoom(project.id, room), project.id);
          logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: project.id });
          // Clear any previous error for this room
          this.roomSyncErrors.delete(`${project.id}:${room.id}`);
        }
      } catch (roomError) {
        // Игнорируем 429 ошибки для комнат - они будут обработаны retry logic
        if (this.isRateLimitError(roomError)) {
          logWarning('ApiStorage', 'Room sync rate limited, will retry', { roomId: room.id });
          // Не считаем 429 ошибкой, будет повторная попытка
        } else {
          const error = roomError instanceof Error ? roomError : new Error(String(roomError));
          logError('ApiStorage', 'Ошибка синхронизации комнаты', error, { roomId: room.id });
          // Сохраняем ошибку для последующего уведомления
          this.roomSyncErrors.set(`${project.id}:${room.id}`, {
            error,
            timestamp: Date.now()
          });
          errors.push(error);
        }
      }
    }

    return errors;
  }

  /**
   * Получение ошибок синхронизации комнат
   */
  getRoomSyncErrors(): Map<string, { error: Error; timestamp: number }> {
    return new Map(this.roomSyncErrors);
  }

  /**
   * Очистка ошибок синхронизации комнат
   */
  clearRoomSyncErrors(): void {
    this.roomSyncErrors.clear();
  }

  /**
   * Load projects from localStorage only (synchronous, no server call)
   * Helper for incremental saves
   */
  private loadProjectsFromLocal(): ProjectData[] | null {
    try {
      const cached = this.loadFromLocalStorage<ProjectData[]>(STORAGE_KEYS.PROJECTS);
      return cached;
    } catch (error) {
      logError('ApiStorage', 'Ошибка загрузки из localStorage', error);
      return null;
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
   * Если присутствуют комнаты — использует транзакционный endpoint
   * Примечание: логирование происходит внутри updateProject в projects.ts
   */
  async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
    const updateData: {
      name: string;
      city?: string;
      use_ai_pricing?: boolean;
      last_ai_price_update?: string | null;
      rooms?: RoomData[];
      objects?: Array<{
        id?: string;
        name: string;
        city?: string | null;
        sort_order?: number;
        rooms: Array<{
          id: string;
          name: string;
          geometry_mode: string;
          length: number;
          width: number;
          height: number;
          segments: unknown;
          obstacles: unknown;
          wall_sections: unknown;
          sub_sections: unknown;
          windows: unknown;
          doors: unknown;
          works: unknown;
          sort_order?: number;
        }>;
      }>;
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

    // Включаем объекты для транзакционного обновления
    // Если проект имеет структуру с objects, используем новый endpoint
    if (project.objects && project.objects.length > 0) {
      updateData.objects = project.objects.map(obj => ({
        id: obj.id,
        name: obj.name,
        city: obj.city ?? null,
        sort_order: obj.sortOrder ?? 0,
        rooms: (obj.rooms || []).map(room => ({
          id: room.id,
          name: room.name,
          geometry_mode: room.geometryMode,
          // Преобразуем в числа, т.к. при загрузке из localStorage они могут быть строками
          length: Number(room.length) || 0,
          width: Number(room.width) || 0,
          height: Number(room.height) || 0,
          segments: room.segments ?? [],
          obstacles: room.obstacles ?? [],
          wall_sections: room.wallSections ?? [],
          sub_sections: room.subSections ?? [],
          windows: room.windows ?? [],
          doors: room.doors ?? [],
          works: room.works ?? [],
          sort_order: room.sortOrder ?? 0,
        })),
      }));
    }

    // НЕ отправляем version — сервер сам инкрементирует при обновлении
    // Это предотвращает 403 Version conflict ошибки

    try {
      let response;
      if (updateData.objects) {
        // Используем новый endpoint для обновления проекта с несколькими объектами
        response = await projectsApi.updateProjectWithObjects(project.id, updateData);
      } else if (updateData.rooms) {
        // Используем транзакционный endpoint для атомарного обновления проекта и комнат (legacy)
        response = await projectsApi.updateProjectWithRooms(project.id, updateData);
      } else {
        // Обычное обновление только проекта
        response = await projectsApi.updateProject(project.id, updateData);
      }

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