/**
 * POST /api/ai/suggest-materials - Получить рекомендации по материалам
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../types/index.js';
import { winstonLogger } from '../../../middleware/logger.js';
import {
  getAvailableAIProvider,
  generatePromptHash,
  findCachedResponse,
  saveCachedResponse,
  shouldUseCache,
  getCacheTTL,
  type SuggestMaterialsRequest,
} from '../../../services/ai/index.js';

export async function suggestMaterialsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const provider = await getAvailableAIProvider();

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
    const promptHash = generatePromptHash(
      'suggest-materials',
      request as unknown as Record<string, unknown>,
    );
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
        result,
      ).catch(err => winstonLogger.error('Failed to cache AI response', { error: err }));
    }

    res.json({
      status: 'success',
      data: result,
      meta: { provider: provider.name, cached: false },
    });
  } catch (error) {
    next(error);
  }
}
