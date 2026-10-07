/**
 * POST /api/ai/estimate - Получить оценку стоимости работ от AI
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
  type EstimateRequest,
} from '../../../services/ai/index.js';

export async function estimateHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const provider = await getAvailableAIProvider();

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
          {
            name: 'Демонтаж',
            unit: 'м²',
            quantity: 20,
            pricePerUnit: 500,
            calculationType: 'floorArea',
          },
          {
            name: 'Выравнивание стен',
            unit: 'м²',
            quantity: 50,
            pricePerUnit: 600,
            calculationType: 'wallArea',
          },
          {
            name: 'Покраска',
            unit: 'м²',
            quantity: 50,
            pricePerUnit: 350,
            calculationType: 'wallArea',
          },
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
    const promptHash = generatePromptHash(
      'estimate',
      request as unknown as Record<string, unknown>,
    );
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
