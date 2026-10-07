/**
 * GET /api/ai/status - Проверить доступность AI сервисов
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../types/index.js';
import { getAvailableAIProvider, isAIAvailable } from '../../../services/ai/index.js';

export async function statusHandler(
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const available = isAIAvailable();
    const provider = await getAvailableAIProvider();

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
}
