/**
 * AI Routes - API endpoints для AI-интеграции с кэшированием
 * Фаза 7.5: AI-интеграция
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import type { AuthRequest } from '../types/index.js';
import {
  getAvailableAIProvider,
  isAIAvailable,
  generatePromptHash,
  findCachedResponse,
  saveCachedResponse,
  getUserAIHistory,
  getAIUsageStats,
  shouldUseCache,
  getCacheTTL,
  type EstimateRequest,
  type SuggestMaterialsRequest,
  type GenerateTemplateRequest,
} from '../services/ai/index.js';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

/**
 * GET /api/ai/status - Проверить доступность AI сервисов
 */
router.get('/status', async (_req: AuthRequest, res, next) => {
  try {
    const available = isAIAvailable();
    const provider = getAvailableAIProvider();

    res.json({
      status: 'success',
      data: {
        available,
        provider: provider ? { name: provider.name, type: provider.type } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/history - Получить историю AI запросов пользователя
 */
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getUserAIHistory(userId, limit, offset);

    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/stats - Получить статистику использования AI
 */
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const periodDays = Math.min(parseInt(req.query.period as string) || 30, 365);

    const stats = await getAIUsageStats(userId, periodDays);

    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/estimate - Получить оценку стоимости работ от AI
 */
router.post('/estimate', async (req: AuthRequest, res, next) => {
  try {
    const { description, city, projectType, roomType, area, projectId, useCache = true } = req.body;
    const userId = req.user!.id;

    if (!description) {
      res.status(400).json({
        status: 'error',
        message: 'Description is required',
      });
      return;
    }

    if (!city) {
      res.status(400).json({
        status: 'error',
        message: 'City is required',
      });
      return;
    }

    const provider = getAvailableAIProvider();

    if (!provider) {
      // Fallback на mock-данные если AI недоступен
      const estimate = {
        id: `mock-${Date.now()}`,
        description,
        city,
        projectType: projectType || 'standard',
        estimatedCost: {
          min: 15000,
          max: 25000,
          currency: 'RUB',
        },
        works: [
          { name: 'Демонтаж', unit: 'м²', quantity: 20, pricePerUnit: 500, calculationType: 'floorArea' },
          { name: 'Выравнивание стен', unit: 'м²', quantity: 50, pricePerUnit: 600, calculationType: 'wallArea' },
          { name: 'Покраска', unit: 'м²', quantity: 50, pricePerUnit: 350, calculationType: 'wallArea' },
        ],
        materials: [
          { name: 'Штукатурка', unit: 'кг', quantity: 100, pricePerUnit: 150 },
          { name: 'Грунтовка', unit: 'л', quantity: 10, pricePerUnit: 300 },
          { name: 'Краска', unit: 'л', quantity: 15, pricePerUnit: 500 },
        ],
        confidence: 'low',
        generatedAt: new Date().toISOString(),
        disclaimer: 'AI сервис недоступен. Данные являются примерными.',
      };

      res.json({
        status: 'success',
        data: estimate,
        meta: { provider: 'mock', fallback: true, cached: false },
      });
      return;
    }

    const request: EstimateRequest = {
      description,
      city,
      projectType: projectType || 'standard',
      roomType,
      area: area ? Number(area) : undefined,
    };

    const providerType = provider.type === 'ai_gemini' ? 'gemini' : 'mistral';
    const promptHash = generatePromptHash('estimate', request);
    const ttl = getCacheTTL('estimate');

    // Проверяем кэш если включён
    if (useCache && shouldUseCache('estimate')) {
      const cached = await findCachedResponse(providerType, promptHash, ttl);
      if (cached) {
        res.json({
          status: 'success',
          data: cached.response,
          meta: {
            provider: provider.name,
            cached: true,
            cachedAt: cached.created_at,
          },
        });
        return;
      }
    }

    // Выполняем запрос к AI
    const result = await provider.estimate(request);

    // Сохраняем в кэш
    if (shouldUseCache('estimate')) {
      await saveCachedResponse(
        userId,
        projectId || null,
        providerType,
        'estimate',
        promptHash,
        result
      ).catch(err => console.error('Failed to cache AI response:', err));
    }

    res.json({
      status: 'success',
      data: result,
      meta: { provider: provider.name, cached: false },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/suggest-materials - Получить рекомендации по материалам
 */
router.post('/suggest-materials', async (req: AuthRequest, res, next) => {
  try {
    const { workName, area, city, roomType, additionalInfo, projectId, useCache = true } = req.body;
    const userId = req.user!.id;

    if (!workName) {
      res.status(400).json({
        status: 'error',
        message: 'Work name is required',
      });
      return;
    }

    if (!city) {
      res.status(400).json({
        status: 'error',
        message: 'City is required',
      });
      return;
    }

    const provider = getAvailableAIProvider();

    if (!provider) {
      // Fallback на mock-данные
      const suggestions = {
        workName,
        area: area || 0,
        city,
        materials: [
          {
            name: 'Грунтовка глубокого проникновения',
            quantity: Math.ceil((area || 50) * 0.1),
            unit: 'л',
            pricePerUnit: 280,
            coverage: '10 м²/л',
          },
          {
            name: 'Краска водоэмульсионная',
            quantity: Math.ceil((area || 50) * 0.15),
            unit: 'л',
            pricePerUnit: 450,
            coverage: '6-7 м²/л в 2 слоя',
          },
        ],
        tools: [
          { name: 'Валик малярный', quantity: 2, pricePerUnit: 250, isRent: false },
          { name: 'Кювета для краски', quantity: 1, pricePerUnit: 150, isRent: false },
        ],
        tips: ['Очистите поверхность перед нанесением', 'Наносите валиком в одном направлении'],
        confidence: 'low',
        generatedAt: new Date().toISOString(),
      };

      res.json({
        status: 'success',
        data: suggestions,
        meta: { provider: 'mock', fallback: true, cached: false },
      });
      return;
    }

    const request: SuggestMaterialsRequest = {
      workName,
      area: area ? Number(area) : 0,
      city,
      roomType,
      additionalInfo,
    };

    const providerType = provider.type === 'ai_gemini' ? 'gemini' : 'mistral';
    const promptHash = generatePromptHash('suggest-materials', request);
    const ttl = getCacheTTL('suggest-materials');

    // Проверяем кэш если включён
    if (useCache && shouldUseCache('suggest-materials')) {
      const cached = await findCachedResponse(providerType, promptHash, ttl);
      if (cached) {
        res.json({
          status: 'success',
          data: cached.response,
          meta: {
            provider: provider.name,
            cached: true,
            cachedAt: cached.created_at,
          },
        });
        return;
      }
    }

    // Выполняем запрос к AI
    const result = await provider.suggestMaterials(request);

    // Сохраняем в кэш
    if (shouldUseCache('suggest-materials')) {
      await saveCachedResponse(
        userId,
        projectId || null,
        providerType,
        'suggest-materials',
        promptHash,
        result
      ).catch(err => console.error('Failed to cache AI response:', err));
    }

    res.json({
      status: 'success',
      data: result,
      meta: { provider: provider.name, cached: false },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/generate-template - Сгенерировать шаблон работ для типа комнаты
 */
router.post('/generate-template', async (req: AuthRequest, res, next) => {
  try {
    const { roomType, area, city, style, projectId, useCache = true } = req.body;
    const userId = req.user!.id;

    if (!roomType) {
      res.status(400).json({
        status: 'error',
        message: 'Room type is required',
      });
      return;
    }

    if (!city) {
      res.status(400).json({
        status: 'error',
        message: 'City is required',
      });
      return;
    }

    const provider = getAvailableAIProvider();

    if (!provider) {
      // Fallback на mock-данные
      const templates: Record<string, { works: unknown[] }> = {
        bathroom: {
          works: [
            { name: 'Демонтаж старой плитки', unit: 'м²', pricePerUnit: 450, calculationType: 'floorArea', category: 'demolition' },
            { name: 'Выравнивание стен', unit: 'м²', pricePerUnit: 550, calculationType: 'wallArea', category: 'preparation' },
            { name: 'Гидроизоляция', unit: 'м²', pricePerUnit: 350, calculationType: 'floorArea', category: 'preparation' },
            { name: 'Укладка плитки на пол', unit: 'м²', pricePerUnit: 1200, calculationType: 'floorArea', category: 'flooring' },
            { name: 'Укладка плитки на стены', unit: 'м²', pricePerUnit: 1300, calculationType: 'wallArea', category: 'walls' },
            { name: 'Установка сантехники', unit: 'точка', pricePerUnit: 3500, calculationType: 'customCount', category: 'plumbing' },
          ],
        },
        kitchen: {
          works: [
            { name: 'Выравнивание стен', unit: 'м²', pricePerUnit: 550, calculationType: 'wallArea', category: 'preparation' },
            { name: 'Укладка напольной плитки', unit: 'м²', pricePerUnit: 1100, calculationType: 'floorArea', category: 'flooring' },
            { name: 'Монтаж фартука', unit: 'м²', pricePerUnit: 1500, calculationType: 'customCount', category: 'walls' },
            { name: 'Установка розеток', unit: 'шт', pricePerUnit: 500, calculationType: 'customCount', category: 'electrical' },
          ],
        },
        bedroom: {
          works: [
            { name: 'Выравнивание стен', unit: 'м²', pricePerUnit: 500, calculationType: 'wallArea', category: 'preparation' },
            { name: 'Покраска стен', unit: 'м²', pricePerUnit: 350, calculationType: 'wallArea', category: 'walls' },
            { name: 'Укладка ламината', unit: 'м²', pricePerUnit: 600, calculationType: 'floorArea', category: 'flooring' },
            { name: 'Монтаж плинтуса', unit: 'м.п.', pricePerUnit: 150, calculationType: 'skirtingLength', category: 'finishing' },
            { name: 'Натяжной потолок', unit: 'м²', pricePerUnit: 650, calculationType: 'ceilingArea', category: 'ceiling' },
          ],
        },
        livingroom: {
          works: [
            { name: 'Выравнивание стен', unit: 'м²', pricePerUnit: 500, calculationType: 'wallArea', category: 'preparation' },
            { name: 'Поклейка обоев', unit: 'м²', pricePerUnit: 400, calculationType: 'wallArea', category: 'walls' },
            { name: 'Укладка ламината', unit: 'м²', pricePerUnit: 600, calculationType: 'floorArea', category: 'flooring' },
            { name: 'Монтаж плинтуса', unit: 'м.п.', pricePerUnit: 150, calculationType: 'skirtingLength', category: 'finishing' },
            { name: 'Натяжной потолок', unit: 'м²', pricePerUnit: 650, calculationType: 'ceilingArea', category: 'ceiling' },
          ],
        },
      };

      const template = templates[roomType] || templates.bedroom;

      const result = {
        roomType,
        area: area || 0,
        city,
        works: template.works,
        recommendedMaterials: [],
        estimatedDays: Math.ceil((area || 20) / 5),
        confidence: 'low',
        generatedAt: new Date().toISOString(),
      };

      res.json({
        status: 'success',
        data: result,
        meta: { provider: 'mock', fallback: true, cached: false },
      });
      return;
    }

    const request: GenerateTemplateRequest = {
      roomType,
      area: area ? Number(area) : 0,
      city,
      style: style || 'standard',
    };

    const providerType = provider.type === 'ai_gemini' ? 'gemini' : 'mistral';
    const promptHash = generatePromptHash('generate-template', request);
    const ttl = getCacheTTL('generate-template');

    // Проверяем кэш если включён
    if (useCache && shouldUseCache('generate-template')) {
      const cached = await findCachedResponse(providerType, promptHash, ttl);
      if (cached) {
        res.json({
          status: 'success',
          data: cached.response,
          meta: {
            provider: provider.name,
            cached: true,
            cachedAt: cached.created_at,
          },
        });
        return;
      }
    }

    // Выполняем запрос к AI
    const result = await provider.generateTemplate(request);

    // Сохраняем в кэш
    if (shouldUseCache('generate-template')) {
      await saveCachedResponse(
        userId,
        projectId || null,
        providerType,
        'generate-template',
        promptHash,
        result
      ).catch(err => console.error('Failed to cache AI response:', err));
    }

    res.json({
      status: 'success',
      data: result,
      meta: { provider: provider.name, cached: false },
    });
  } catch (error) {
    next(error);
  }
});

export default router;