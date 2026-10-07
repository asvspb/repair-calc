/**
 * GET /api/ai/stats - Получить статистику использования AI
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../types/index.js';
import { getAIUsageStats } from '../../../services/ai/index.js';

export async function statsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
}
