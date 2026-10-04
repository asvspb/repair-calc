/**
 * objectApi — CRUD-операции провайдера над проектами/объектами через REST API
 * и сборка payload'ов для транзакционных endpoints.
 * Вынесено из apiStorageProvider (TASK-BATCH-012).
 */

import type { ProjectData, RoomData } from '@shared/types';
import { StorageProviderError } from '../../types/storage';
import * as projectsApi from '../projects';
import { STORAGE_KEYS } from '../../utils/storageConstants';
import { logDebug } from '../../utils/logger';
import type { ApiSyncContext } from './apiClient';

export interface UpdateProjectData {
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
    rooms?: RoomData[];
  }>;
}

/**
 * Сборка тела обновления проекта из клиентской модели
 */
export function buildUpdateData(project: ProjectData): UpdateProjectData {
  const updateData: UpdateProjectData = {
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
    updateData.objects = buildObjectsPayload(project.objects);
  }

  // НЕ отправляем version — сервер сам инкрементирует при обновлении
  // Это предотвращает 403 Version conflict ошибки
  return updateData;
}

/**
 * Маппинг клиентских объектов в payload транзакционного endpoint
 */
export function buildObjectsPayload(
  objects: NonNullable<ProjectData['objects']>,
): NonNullable<UpdateProjectData['objects']> {
  return objects.map(obj => ({
    id: obj.id,
    name: obj.name,
    city: obj.city ?? null,
    sort_order: obj.sortOrder ?? 0,
    rooms: obj.rooms || [],
  }));
}

/**
 * Атомарное сохранение всех комнат проекта в объект по умолчанию
 * (используется при миграции/импорте локальных проектов)
 */
export async function saveRoomsToDefaultObject(
  newProject: ProjectData,
  project: ProjectData,
  allRooms: RoomData[],
): Promise<void> {
  const defaultObject = newProject.objects?.[0];
  if (allRooms.length === 0 || !defaultObject) return;

  const objectsData = [
    {
      id: defaultObject.id,
      name: project.name,
      city: project.city || null,
      rooms: allRooms,
    },
  ];

  await projectsApi.updateProjectWithObjects(newProject.id, {
    name: project.name,
    city: project.city,
    objects: objectsData,
  });
}

/**
 * Асинхронная загрузка проектов с сервера
 * Использует /api/sync/pull для получения проектов с комнатами
 * Примечание: логирование происходит внутри syncPull в projects.ts
 */
export async function loadProjectsAsync(ctx: ApiSyncContext): Promise<ProjectData[]> {
  try {
    // Используем sync/pull для получения проектов с комнатами
    const response = await projectsApi.syncPull();
    const projects = response.data.projects.map(projectsApi.apiToClientProject);

    // Обновляем кэш
    ctx.cache.clear();
    projects.forEach(p => ctx.cache.set(p.id, p));
    ctx.cache.touchExpiry();

    // Сохраняем также в localStorage как кэш
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

    return projects;
  } catch (error) {
    // При ошибке пробуем загрузить из localStorage
    logDebug('ApiStorage', 'Попытка загрузки из localStorage при ошибке');
    const cached = loadFromLocalStorage<ProjectData[]>(STORAGE_KEYS.PROJECTS);
    if (cached) {
      ctx.cache.clear();
      cached.forEach(p => ctx.cache.set(p.id, p));
      ctx.cache.touchExpiry();
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
export async function createProjectAsync(
  ctx: ApiSyncContext,
  data: { name: string; city?: string },
): Promise<ProjectData> {
  try {
    const response = await projectsApi.createProject(data);
    const project = projectsApi.apiToClientProject(response.data);

    // Добавляем в кэш
    ctx.cache.set(project.id, project);

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
export async function updateProjectAsync(
  ctx: ApiSyncContext,
  project: ProjectData,
): Promise<ProjectData> {
  const updateData = buildUpdateData(project);

  try {
    let response;
    if (updateData.objects) {
      // Используем новый endpoint для обновления проекта с несколькими объектами
      response = await projectsApi.updateProjectWithObjects(project.id, updateData);
    } else if (updateData.rooms) {
      // Используем транзакционный endpoint для атомарного обновления проекта и комнат (legacy)
      response = await projectsApi.updateProjectWithRooms(project.id, {
        name: updateData.name,
        city: updateData.city,
        use_ai_pricing: updateData.use_ai_pricing,
        last_ai_price_update: updateData.last_ai_price_update,
        rooms: updateData.rooms,
      });
    } else {
      // Обычное обновление только проекта
      response = await projectsApi.updateProject(project.id, updateData);
    }

    const updated = projectsApi.apiToClientProject(response.data);

    // Обновляем кэш
    ctx.cache.set(project.id, updated);

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
export async function deleteProjectAsync(ctx: ApiSyncContext, projectId: string): Promise<void> {
  // Помечаем проект как удаленный ДО запроса, чтобы отменить pending запросы
  // Но сам DELETE запрос делаем БЕЗ projectId в очереди, чтобы он не был пропущен
  ctx.queue.markProjectDeleted(projectId);

  try {
    // Выполняем удаление без привязки к projectId (иначе запрос будет пропущен)
    await ctx.queue.enqueue(async () => {
      await projectsApi.deleteProject(projectId);
    }, undefined);

    // Удаляем из кэша
    ctx.cache.delete(projectId);
  } catch (error) {
    throw StorageProviderError.fromError(error);
  }
}

/**
 * Получение полного проекта с комнатами
 */
export async function getProjectWithRoomsAsync(
  ctx: ApiSyncContext,
  projectId: string,
): Promise<ProjectData | null> {
  try {
    const response = await projectsApi.getProject(projectId);
    const project = projectsApi.apiToClientProject(response.data);

    // Обновляем в кэше
    ctx.cache.set(project.id, project);

    return project;
  } catch (error) {
    if (error instanceof projectsApi.ProjectsApiError && error.statusCode === 404) {
      return null;
    }
    throw StorageProviderError.fromError(error);
  }
}

/**
 * Загрузка значения из localStorage (тихо: при ошибке — null)
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
