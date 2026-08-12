import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WebhookRepository, type WebhookEvent } from '../../db/repositories/webhook.repo.js';
import { createWebhookSchema, updateWebhookSchema } from './schemas.js';

import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';

export const router = Router();
router.use(authenticate, adminGuard);

/**
 * GET /webhooks
 * Список зарегистрированных вебхуков
 */
router.get('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await WebhookRepository.findAll();

    res.json({
      status: 'success',
      data: {
        webhooks: webhooks.map(wh => ({
          id: wh.id,
          url: wh.url,
          events: wh.events,
          active: wh.active,
          retryCount: wh.retry_count,
          retryDelayMs: wh.retry_delay_ms,
          timeoutMs: wh.timeout_ms,
          stats: {
            totalSent: wh.total_sent,
            totalFailed: wh.total_failed,
            lastTriggeredAt: wh.last_triggered_at,
            lastSuccessAt: wh.last_success_at,
            lastFailureAt: wh.last_failure_at,
            lastError: wh.last_error,
          },
          createdAt: wh.created_at,
          updatedAt: wh.updated_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks
 * Зарегистрировать вебхук
 */
router.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWebhookSchema.parse(req.body);

    const webhook = await WebhookRepository.create({
      url: input.url,
      events: input.events as WebhookEvent[],
      secret: input.secret,
      active: input.active,
      retry_count: input.retry_count,
      retry_delay_ms: input.retry_delay_ms,
      timeout_ms: input.timeout_ms,
    });

    res.status(201).json({
      status: 'success',
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        createdAt: webhook.created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * GET /webhooks/:id
 * Получить вебхук по ID
 */
router.get('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await WebhookRepository.findById(id);
    if (!webhook) {
      return res.status(404).json({
        status: 'error',
        error: 'Webhook not found',
      });
    }

    res.json({
      status: 'success',
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        retryCount: webhook.retry_count,
        retryDelayMs: webhook.retry_delay_ms,
        timeoutMs: webhook.timeout_ms,
        stats: {
          totalSent: webhook.total_sent,
          totalFailed: webhook.total_failed,
          lastTriggeredAt: webhook.last_triggered_at,
          lastSuccessAt: webhook.last_success_at,
          lastFailureAt: webhook.last_failure_at,
          lastError: webhook.last_error,
        },
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /webhooks/:id
 * Обновить вебхук
 */
router.put('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = updateWebhookSchema.parse(req.body);

    const existing = await WebhookRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        error: 'Webhook not found',
      });
    }

    const updated = await WebhookRepository.update(id, {
      url: input.url,
      events: input.events as WebhookEvent[],
      secret: input.secret,
      active: input.active,
      retry_count: input.retry_count,
      retry_delay_ms: input.retry_delay_ms,
      timeout_ms: input.timeout_ms,
    });

    res.json({
      status: 'success',
      data: {
        id: updated!.id,
        url: updated!.url,
        events: updated!.events,
        active: updated!.active,
        updatedAt: updated!.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * DELETE /webhooks/:id
 * Удалить вебхук
 */
router.delete('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = await WebhookRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        error: 'Webhook not found',
      });
    }

    res.json({
      status: 'success',
      data: {
        id,
        deleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks/:id/test
 * Тестировать вебхук
 */
router.post('/webhooks/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await WebhookRepository.findById(id);
    if (!webhook) {
      return res.status(404).json({
        status: 'error',
        error: 'Webhook not found',
      });
    }

    const { webhookService } = await import('../../services/webhook.service.js');
    const result = await webhookService.trigger('job.completed', {
      test: true,
      message: 'This is a test webhook',
      triggeredAt: new Date().toISOString(),
    });

    res.json({
      status: 'success',
      data: {
        webhookId: id,
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (error) {
    next(error);
  }
});
