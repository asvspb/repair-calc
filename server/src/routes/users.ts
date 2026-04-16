import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { notFound } from '../middleware/errorHandler.js';
import { winstonLogger } from '../middleware/logger.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

/**
 * GET /api/users/me
 * Текущий пользователь + статус премиума
 */
router.get('/me', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user!.id;

    winstonLogger.info('[GET /api/users/me] Запрос профиля', { userId });

    const user = await UserRepository.findById(userId);
    if (!user) {
      winstonLogger.warn('[GET /api/users/me] Пользователь не найден', { userId });
      throw notFound('User not found');
    }

    const responseData = {
      id: user.id,
      email: user.email,
      name: user.name,
      is_premium: false, // По умолчанию
      premium_expires_at: null,
      limits: {
        max_objects_per_project: 10,
        max_projects: -1,
        max_rooms_per_object: -1,
      },
    };

    winstonLogger.info('[GET /api/users/me] Найден', { duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    winstonLogger.error('[GET /api/users/me] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

/**
 * PUT /api/users/me
 * Обновление профиля пользователя
 */
router.put('/me', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    winstonLogger.info('[PUT /api/users/me] Обновление профиля', { userId });

    const user = await UserRepository.findById(userId);
    if (!user) {
      winstonLogger.warn('[PUT /api/users/me] Пользователь не найден', { userId });
      throw notFound('User not found');
    }

    const updatedUser = await UserRepository.update(userId, {
      name: name !== undefined ? name : user.name,
    });

    winstonLogger.info('[PUT /api/users/me] Обновлён', { duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: updatedUser,
    });
  } catch (error) {
    winstonLogger.error('[PUT /api/users/me] Ошибка', { duration: Date.now() - startTime, error });
    next(error);
  }
});

export default router;
