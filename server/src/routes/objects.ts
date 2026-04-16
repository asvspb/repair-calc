import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden, badRequest } from '../middleware/errorHandler.js';
import { winstonLogger } from '../middleware/logger.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

/**
 * POST /api/projects/:projectId/objects
 * Создание нового объекта в проекте
 */
router.post('/projects/:projectId/objects', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const { projectId } = req.params;
    const { name, city, address, use_ai_pricing } = req.body;
    const userId = req.user!.id;

    winstonLogger.info('[POST /projects/:id/objects] Создание объекта', { projectId, name, city: city || null });

    // Проверка существования проекта
    const project = await ProjectRepository.findByIdAndUserId(projectId, userId);
    if (!project) {
      winstonLogger.warn('[POST /projects/:id/objects] Проект не найден', { projectId });
      throw notFound('Project not found');
    }

    // Проверка лимита объектов
    const isLimitReached = await ObjectRepository.isLimitReached(projectId, userId);
    if (isLimitReached) {
      winstonLogger.warn('[POST /projects/:id/objects] Превышен лимит объектов');
      return res.status(403).json({
        status: 'error',
        error: 'Превышен лимит объектов (максимум 10 для бесплатных пользователей)',
        code: 'OBJECT_LIMIT_REACHED',
        limit: 10,
      });
    }

    // Создание объекта
    const object = await ObjectRepository.create(projectId, userId, {
      name,
      city: city || null,
      address: address || null,
      use_ai_pricing: use_ai_pricing || false,
    });

    winstonLogger.info('[POST /projects/:id/objects] Создан объект', { objectId: object.id, duration: Date.now() - startTime });

    res.status(201).json({
      status: 'success',
      data: object,
    });
  } catch (error) {
    winstonLogger.error('[POST /projects/:id/objects] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

/**
 * GET /api/objects
 * Список всех объектов пользователя
 */
router.get('/objects', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user!.id;

    winstonLogger.info('[GET /api/objects] Список объектов', { userId });

    const objects = await ObjectRepository.findByUserId(userId);

    winstonLogger.info('[GET /api/objects] Найдено', { count: objects.length, duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: objects,
    });
  } catch (error) {
    winstonLogger.error('[GET /api/objects] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

/**
 * GET /api/objects/:id
 * Получение объекта с комнатами
 */
router.get('/objects/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    winstonLogger.info('[GET /api/objects/:id] Запрос объекта', { id });

    const object = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!object) {
      winstonLogger.warn('[GET /api/objects/:id] Объект не найден', { id });
      throw notFound('Object not found');
    }

    // Загружаем комнаты
    const objectWithRooms = await ObjectRepository.findByIdWithRooms(id);

    winstonLogger.info('[GET /api/objects/:id] Найден', { roomsCount: objectWithRooms?.rooms.length || 0, duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: objectWithRooms,
    });
  } catch (error) {
    winstonLogger.error('[GET /api/objects/:id] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

/**
 * PUT /api/objects/:id
 * Обновление объекта
 */
router.put('/objects/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, city, address, use_ai_pricing, last_ai_price_update, sort_order } = req.body;

    winstonLogger.info('[PUT /api/objects/:id] Обновление объекта', { id });

    // Проверка существования
    const existing = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      winstonLogger.warn('[PUT /api/objects/:id] Объект не найден', { id });
      throw notFound('Object not found');
    }

    // Обновление
    const object = await ObjectRepository.update(id, {
      name: name !== undefined ? name : existing.name,
      city: city !== undefined ? city : existing.city,
      address: address !== undefined ? address : existing.address,
      use_ai_pricing: use_ai_pricing !== undefined ? use_ai_pricing : existing.use_ai_pricing,
      last_ai_price_update: last_ai_price_update !== undefined 
        ? (last_ai_price_update ? new Date(last_ai_price_update) : null)
        : existing.last_ai_price_update,
      sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
    });

    winstonLogger.info('[PUT /api/objects/:id] Обновлён', { duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: object,
    });
  } catch (error) {
    winstonLogger.error('[PUT /api/objects/:id] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

/**
 * DELETE /api/objects/:id
 * Мягкое удаление объекта
 */
router.delete('/objects/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      winstonLogger.warn('[DELETE /api/objects/:id] Объект не найден', { id });
      throw notFound('Object not found');
    }

    winstonLogger.info('[DELETE /api/objects/:id] Удаление объекта', { id, name: existing.name });

    await ObjectRepository.delete(id);

    winstonLogger.info('[DELETE /api/objects/:id] Удалён', { id, duration: Date.now() - startTime });

    res.json({
      status: 'success',
      message: 'Object deleted',
    });
  } catch (error) {
    winstonLogger.error('[DELETE /api/objects/:id] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

export default router;
