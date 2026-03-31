import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { notFound } from '../middleware/errorHandler.js';
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

    console.log('\n👤 [GET /api/users/me] Текущий пользователь');
    console.log(`   ID: ${userId}`);

    const user = await UserRepository.findById(userId);
    if (!user) {
      console.log(`   ❌ Пользователь не найден`);
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

    console.log(`   ✅ Email: ${user.email} за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
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

    console.log('\n✏️  [PUT /api/users/me] Обновление профиля');
    console.log(`   ID: ${userId}`);

    const user = await UserRepository.findById(userId);
    if (!user) {
      console.log(`   ❌ Пользователь не найден`);
      throw notFound('User not found');
    }

    const updatedUser = await UserRepository.update(userId, {
      name: name !== undefined ? name : user.name,
    });

    console.log(`   ✅ Обновлён за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: updatedUser,
    });
  } catch (error) {
    console.log(`   ❌ Ошибка за ${Date.now() - startTime}ms:`, error);
    next(error);
  }
});

export default router;
