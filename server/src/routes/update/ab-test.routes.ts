import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';
import {
  createTest,
  deleteTest,
  getTest,
  getTestResults,
  listTests,
  updateTest,
} from './ab-test.controller.js';
import {
  cancelTest,
  checkTestCompletion,
  completeTest,
  getActiveTest,
  getTestStats,
  pauseTest,
  resumeTest,
  startTest,
} from './ab-test.lifecycle.controller.js';

/**
 * Маршруты A/B тестирования парсеров.
 * Обработчики вынесены в ab-test.controller.ts (CRUD/чтение) и
 * ab-test.lifecycle.controller.ts (жизненный цикл). Контракт HTTP не изменён.
 */
export const router = Router();

// Защищаем все A/B тесты правами администратора
router.use(authenticate, adminGuard);

// Список / создание
router.get('/ab-tests', listTests);
router.post('/ab-tests', createTest);

// Активный тест — до параметрического маршрута /:id
router.get('/ab-tests/active', getActiveTest);

// CRUD по ID
router.get('/ab-tests/:id', getTest);
router.put('/ab-tests/:id', updateTest);
router.delete('/ab-tests/:id', deleteTest);

// Жизненный цикл
router.post('/ab-tests/:id/start', startTest);
router.post('/ab-tests/:id/pause', pauseTest);
router.post('/ab-tests/:id/resume', resumeTest);
router.post('/ab-tests/:id/complete', completeTest);
router.post('/ab-tests/:id/cancel', cancelTest);

// Результаты и статистика
router.get('/ab-tests/:id/results', getTestResults);
router.get('/ab-tests/:id/stats', getTestStats);
router.post('/ab-tests/:id/check-completion', checkTestCompletion);
