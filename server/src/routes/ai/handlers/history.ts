/**
 * GET /api/ai/history - Получить историю AI запросов пользователя
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../types/index.js';
import { getUserAIHistory } from '../../../services/ai/index.js';

export async function historyHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
}
