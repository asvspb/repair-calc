/**
 * projectApi — синхронизация проектов с сервером: полная (saveProjects)
 * и инкрементальная (один проект). Вынесено из apiStorageProvider (TASK-BATCH-012).
 */

import type { ProjectData } from '@shared/types';
import { StorageProviderError } from '../../types/storage';
import * as projectsApi from '../projects';
import { getAllRooms } from '../../utils/projectObjects';
import { isServerId as isServerIdUtil } from '../../utils/idMapper';
import { STORAGE_KEYS } from '../../utils/storageConstants';
import { logStart, logSuccess, logError, logDebug } from '../../utils/logger';
import { idMapper } from '../../utils/idMapper';
import type { ApiSyncContext } from './apiClient';
import {
  createProjectAsync,
  updateProjectAsync,
  loadProjectsAsync,
  buildObjectsPayload,
  saveRoomsToDefaultObject,
  loadFromLocalStorage,
} from './objectApi';

/**
 * Полная синхронизация списка проектов с сервером.
 * Использует маппинг ID для предотвращения дублирования.
 * Возвращает обновлённый список проектов с серверными ID.
 */
export async function saveAllProjects(
  ctx: ApiSyncContext,
  projects: ProjectData[],
): Promise<ProjectData[]> {
  const startTime = logStart('ApiStorage', 'Сохранение проектов', { count: projects.length });

  // Отслеживаем мигрировавшие проекты для обновления списка
  const migratedProjects: { localId: string; serverId: string }[] = [];

  try {
    // Обновляем кэш немедленно для UI
    ctx.cache.clear();
    projects.forEach(p => ctx.cache.set(p.id, p));
    ctx.cache.touchExpiry();

    // Сохраняем также в localStorage как бэкап
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    logDebug('ApiStorage', 'Проекты сохранены в localStorage как бэкап');

    // Получаем список существующих ID проектов на сервере
    logDebug('ApiStorage', 'Загрузка существующих проектов с сервера');
    const existingProjects = await ctx.queue.enqueue(() => loadProjectsAsync(ctx));
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
          serverId: mappedServerId,
        });
        const syncPromise = ctx.queue.enqueue(async () => {
          try {
            const projectWithServerId = { ...project, id: mappedServerId };
            // updateProjectAsync использует транзакционный endpoint и включает комнаты
            await updateProjectAsync(ctx, projectWithServerId);
          } catch (error) {
            logError('ApiStorage', 'Ошибка обновления мигрированного проекта', error, {
              localId: project.id,
              serverId: mappedServerId,
            });
          }
        }, project.id);
        syncPromises.push(syncPromise);
      } else if (isServerProject && existsOnServer) {
        // Серверный проект — обновляем
        logDebug('ApiStorage', 'Обновление проекта на сервере', { projectId: project.id });
        const syncPromise = ctx.queue.enqueue(async () => {
          try {
            // updateProjectAsync использует транзакционный endpoint и включает комнаты
            await updateProjectAsync(ctx, project);
          } catch (error) {
            logError('ApiStorage', 'Ошибка синхронизации проекта', error, {
              projectId: project.id,
            });
          }
        }, project.id);
        syncPromises.push(syncPromise);
      } else if (!isServerProject) {
        // Локальный проект без маппинга — мигрируем на сервер
        logDebug('ApiStorage', 'Миграция локального проекта на сервер', {
          projectId: project.id,
          name: project.name,
        });
        const syncPromise = ctx.queue.enqueue(async () => {
          try {
            // Создаём проект на сервере
            const newProject = await createProjectAsync(ctx, {
              name: project.name,
              city: project.city,
            });

            // Сохраняем маппинг
            idMapper.addMapping(project.id, newProject.id);
            migratedProjects.push({ localId: project.id, serverId: newProject.id });

            logSuccess('ApiStorage', 'Проект мигрирован', {
              localId: project.id,
              serverId: newProject.id,
            });

            // Атомарно сохраняем все комнаты через updateProjectWithObjects
            await saveRoomsToDefaultObject(newProject, project, getAllRooms(project));
            logDebug('ApiStorage', 'Комнаты мигрированы через updateProjectWithObjects', {
              roomCount: getAllRooms(project).length,
            });
          } catch (error) {
            // Детальное логирование ошибки 400
            if (error instanceof Error) {
              const apiError = error as unknown as Record<string, unknown>;
              if (apiError['statusCode'] === 400 || apiError['data']) {
                logError('ApiStorage', 'Ошибка 400 при миграции проекта', error, {
                  projectId: project.id,
                  projectName: project.name,
                  statusCode: apiError['statusCode'],
                  errorData: apiError['data'],
                  errorMessage: apiError['message'],
                });
              } else {
                logError('ApiStorage', 'Ошибка миграции проекта', error, {
                  projectId: project.id,
                });
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
          name: project.name,
        });
        const syncPromise = ctx.queue.enqueue(async () => {
          try {
            // Создаём новый проект на сервере
            const newProject = await createProjectAsync(ctx, {
              name: project.name,
              city: project.city,
            });

            // Сохраняем маппинг старого ID на новый
            idMapper.addMapping(project.id, newProject.id);
            migratedProjects.push({ localId: project.id, serverId: newProject.id });

            logSuccess('ApiStorage', 'Проект создан (импортирован)', {
              oldId: project.id,
              newId: newProject.id,
            });

            // Атомарно сохраняем все комнаты через updateProjectWithObjects
            await saveRoomsToDefaultObject(newProject, project, getAllRooms(project));
            logDebug('ApiStorage', 'Комнаты импортированы через updateProjectWithObjects', {
              roomCount: getAllRooms(project).length,
            });
          } catch (error) {
            logError('ApiStorage', 'Ошибка создания проекта при импорте', error, {
              projectId: project.id,
            });
          }
        }, project.id);
        syncPromises.push(syncPromise);
      }
    }

    // Ждем завершения всех синхронизаций
    await Promise.all(syncPromises);

    // Если были миграции — обновляем кэш с серверными ID
    if (migratedProjects.length > 0) {
      logDebug('ApiStorage', 'Обновление кэша после миграции', {
        count: migratedProjects.length,
      });

      // Загружаем актуальный список с сервера
      const updatedProjects = await ctx.queue.enqueue(() => loadProjectsAsync(ctx));

      // Удаляем локальные дубликаты из localStorage
      const localIdsToRemove = new Set(migratedProjects.map(m => m.localId));
      const cleanedProjects = updatedProjects.filter(
        p => !localIdsToRemove.has(p.id) || isServerIdUtil(p.id),
      );

      // Обновляем localStorage только серверными версиями
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(cleanedProjects));

      // Обновляем кэш
      ctx.cache.clear();
      cleanedProjects.forEach(p => ctx.cache.set(p.id, p));
      ctx.cache.touchExpiry();

      logSuccess('ApiStorage', 'Миграция завершена, дубликаты удалены', {
        migratedCount: migratedProjects.length,
      });
    }

    logSuccess(
      'ApiStorage',
      'Проекты успешно синхронизированы',
      { count: projects.length },
      startTime,
    );

    // Возвращаем обновлённый список проектов
    return ctx.cache.values();
  } catch (error) {
    logError('ApiStorage', 'Ошибка сохранения проектов', error);
    throw StorageProviderError.fromError(error);
  }
}

/**
 * Инкрементальное сохранение: сохраняет на сервер только один проект.
 * Эффективнее полной синхронизации, когда изменился единственный проект.
 */
export async function saveProjectIncremental(
  ctx: ApiSyncContext,
  project: ProjectData,
): Promise<ProjectData> {
  const startTime = logStart('ApiStorage', 'Инкрементальное сохранение проекта', {
    projectId: project.id,
    name: project.name,
  });

  try {
    // Update cache immediately
    ctx.cache.set(project.id, project);

    // Save to localStorage as backup
    const projects = loadFromLocalStorage<ProjectData[]>(STORAGE_KEYS.PROJECTS) || [];
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
      resultProject = await ctx.queue.enqueue(() => updateProjectAsync(ctx, projectWithServerId));
      logSuccess(
        'ApiStorage',
        'Мигрированный проект обновлен',
        {
          localId: project.id,
          serverId: mappedServerId,
        },
        startTime,
      );
    } else if (isServerProject) {
      // Update server project directly
      resultProject = await ctx.queue.enqueue(() => updateProjectAsync(ctx, project));
      logSuccess('ApiStorage', 'Проект обновлен на сервере', { projectId: project.id }, startTime);
    } else {
      // Create new project on server
      const newProject = await ctx.queue.enqueue(() =>
        createProjectAsync(ctx, {
          name: project.name,
          city: project.city,
        }),
      );

      // Save mapping
      idMapper.addMapping(project.id, newProject.id);

      // Save rooms/objects to new project
      if (project.objects && project.objects.length > 0) {
        await ctx.queue.enqueue(() =>
          projectsApi.updateProjectWithObjects(newProject.id, {
            name: project.name,
            city: project.city,
            objects: buildObjectsPayload(project.objects),
          }),
        );
      }

      resultProject = newProject;
      logSuccess(
        'ApiStorage',
        'Новый проект создан на сервере',
        {
          localId: project.id,
          serverId: newProject.id,
        },
        startTime,
      );
    }

    return resultProject;
  } catch (error) {
    logError('ApiStorage', 'Ошибка инкрементального сохранения', error, {
      projectId: project.id,
    });
    throw StorageProviderError.fromError(error);
  }
}
