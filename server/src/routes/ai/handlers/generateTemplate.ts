/**
 * POST /api/ai/generate-template - Сгенерировать шаблон работ для типа комнаты
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
  type GenerateTemplateRequest,
} from '../../../services/ai/index.js';

export async function generateTemplateHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const provider = await getAvailableAIProvider();

    if (!provider) {
      // Fallback на mock-данные
      const templates: Record<string, { works: unknown[] }> = {
        bathroom: {
          works: [
            {
              name: 'Демонтаж старой плитки',
              unit: 'м²',
              pricePerUnit: 450,
              calculationType: 'floorArea',
              category: 'demolition',
            },
            {
              name: 'Выравнивание стен',
              unit: 'м²',
              pricePerUnit: 550,
              calculationType: 'wallArea',
              category: 'preparation',
            },
            {
              name: 'Гидроизоляция',
              unit: 'м²',
              pricePerUnit: 350,
              calculationType: 'floorArea',
              category: 'preparation',
            },
            {
              name: 'Укладка плитки на пол',
              unit: 'м²',
              pricePerUnit: 1200,
              calculationType: 'floorArea',
              category: 'flooring',
            },
            {
              name: 'Укладка плитки на стены',
              unit: 'м²',
              pricePerUnit: 1300,
              calculationType: 'wallArea',
              category: 'walls',
            },
            {
              name: 'Установка сантехники',
              unit: 'точка',
              pricePerUnit: 3500,
              calculationType: 'customCount',
              category: 'plumbing',
            },
          ],
        },
        kitchen: {
          works: [
            {
              name: 'Выравнивание стен',
              unit: 'м²',
              pricePerUnit: 550,
              calculationType: 'wallArea',
              category: 'preparation',
            },
            {
              name: 'Укладка напольной плитки',
              unit: 'м²',
              pricePerUnit: 1100,
              calculationType: 'floorArea',
              category: 'flooring',
            },
            {
              name: 'Монтаж фартука',
              unit: 'м²',
              pricePerUnit: 1500,
              calculationType: 'customCount',
              category: 'walls',
            },
            {
              name: 'Установка розеток',
              unit: 'шт',
              pricePerUnit: 500,
              calculationType: 'customCount',
              category: 'electrical',
            },
          ],
        },
        bedroom: {
          works: [
            {
              name: 'Выравнивание стен',
              unit: 'м²',
              pricePerUnit: 500,
              calculationType: 'wallArea',
              category: 'preparation',
            },
            {
              name: 'Покраска стен',
              unit: 'м²',
              pricePerUnit: 350,
              calculationType: 'wallArea',
              category: 'walls',
            },
            {
              name: 'Укладка ламината',
              unit: 'м²',
              pricePerUnit: 600,
              calculationType: 'floorArea',
              category: 'flooring',
            },
            {
              name: 'Монтаж плинтуса',
              unit: 'м.п.',
              pricePerUnit: 150,
              calculationType: 'skirtingLength',
              category: 'finishing',
            },
            {
              name: 'Натяжной потолок',
              unit: 'м²',
              pricePerUnit: 650,
              calculationType: 'ceilingArea',
              category: 'ceiling',
            },
          ],
        },
        livingroom: {
          works: [
            {
              name: 'Выравнивание стен',
              unit: 'м²',
              pricePerUnit: 500,
              calculationType: 'wallArea',
              category: 'preparation',
            },
            {
              name: 'Поклейка обоев',
              unit: 'м²',
              pricePerUnit: 400,
              calculationType: 'wallArea',
              category: 'walls',
            },
            {
              name: 'Укладка ламината',
              unit: 'м²',
              pricePerUnit: 600,
              calculationType: 'floorArea',
              category: 'flooring',
            },
            {
              name: 'Монтаж плинтуса',
              unit: 'м.п.',
              pricePerUnit: 150,
              calculationType: 'skirtingLength',
              category: 'finishing',
            },
            {
              name: 'Натяжной потолок',
              unit: 'м²',
              pricePerUnit: 650,
              calculationType: 'ceilingArea',
              category: 'ceiling',
            },
          ],
        },
      };

      const template = templates[roomType] || templates.bedroom;

      const result = {
        roomType,
        area: area || 0,
        city,
        works: template?.works || [],
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
    const promptHash = generatePromptHash(
      'generate-template',
      request as unknown as Record<string, unknown>,
    );
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
