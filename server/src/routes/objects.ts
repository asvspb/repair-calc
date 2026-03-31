import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden, badRequest } from '../middleware/errorHandler.js';
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

    console.log('\n📦 [POST /projects/:id/objects] Создание объекта');
    console.log(`   Проект: ${projectId}`);
    console.log(`   Название: "${name}"`);
    console.log(`   Город: ${city || 'не указан'}`);

    // Проверка существования проекта
    const project = await ProjectRepository.findByIdAndUserId(projectId, userId);
    if (!project) {
      console.log(`   ❌ Проект не найден`);
      throw notFound('Project not found');
    }

    // Проверка лимита объектов
    const isLimitReached = await ObjectRepository.isLimitReached(projectId, userId);
    if (isLimitReached) {
      console.log(`   ❌ Превышен лимит объектов (10 для бесплатных)`);
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

    console.log(`   ✅ Создан объект ${object.id} за ${Date.now() - startTime}ms`);

    res.status(201).json({
      status: 'success',
      data: object,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
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

    console.log('\n📋 [GET /api/objects] Список объектов');
    console.log(`   Пользователь: ${userId}`);

    const objects = await ObjectRepository.findByUserId(userId);

    console.log(`   ✅ Найдено объектов: ${objects.length} за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: objects,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
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

    console.log('\n🔍 [GET /api/objects/:id] Объект с комнатами');
    console.log(`   ID: ${id}`);

    const object = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!object) {
      console.log(`   ❌ Объект не найден`);
      throw notFound('Object not found');
    }

    // Загружаем комнаты
    const objectWithRooms = await ObjectRepository.findByIdWithRooms(id);

    console.log(`   ✅ Комнат: ${objectWithRooms?.rooms.length || 0} за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: objectWithRooms,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
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

    console.log('\n✏️  [PUT /api/objects/:id] Обновление объекта');
    console.log(`   ID: ${id}`);

    // Проверка существования
    const existing = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      console.log(`   ❌ Объект не найден`);
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

    console.log(`   ✅ Обновлён за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: object,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
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

    console.log('\n🗑️  [DELETE /api/objects/:id] Удаление объекта');
    console.log(`   ID: ${id}`);

    // Проверка существования
    const existing = await ObjectRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      console.log(`   ❌ Объект не найден`);
      throw notFound('Object not found');
    }

    console.log(`   Название: "${existing.name}"`);

    // Мягкое удаление
    await ObjectRepository.delete(id);

    console.log(`   ✅ Удалён за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      message: 'Object deleted',
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
    next(error);
  }
});

export default router;
