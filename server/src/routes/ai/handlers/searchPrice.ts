/**
 * POST /api/ai/search-price - Поиск цены на товар/работу через AI
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
  type PriceSearchRequest,
} from '../../../services/ai/index.js';

export async function searchPriceHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productName, city, category, brand, useCache = true } = req.body;
    const userId = req.user!.id;

    if (!productName) {
      res.status(400).json({
        status: 'error',
        message: 'Product name is required',
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
      res.json({
        status: 'success',
        data: {
          product: productName,
          city,
          prices: { min: 0, avg: 0, max: 0, currency: 'RUB' },
          sources: [],
          confidence: 'low' as const,
          lastUpdated: new Date().toISOString().split('T')[0],
          disclaimer: 'AI сервис недоступен. Цены не найдены.',
        },
        meta: { provider: 'mock', fallback: true, cached: false },
      });
      return;
    }

    const request: PriceSearchRequest = {
      productName,
      city,
      category,
      brand,
    };

    const providerType = provider.type === 'ai_gemini' ? 'gemini' : 'mistral';
    const promptHash = generatePromptHash(
      'search-price',
      request as unknown as Record<string, unknown>,
    );
    const ttl = getCacheTTL('search-price');

    if (useCache && shouldUseCache('search-price')) {
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

    const result = await provider.searchPrice(request);

    if (shouldUseCache('search-price')) {
      await saveCachedResponse(
        userId,
        null,
        providerType,
        'search-price',
        promptHash,
        result,
      ).catch(err => winstonLogger.error('Failed to cache price search response', { error: err }));
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
