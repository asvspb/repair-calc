/**
 * Webhook Service - отправка уведомлений на внешние URL
 */

import crypto from 'crypto';
import { WebhookRepository, type UpdateWebhook, type WebhookEvent } from '../db/repositories/webhook.repo.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════
// СЕРВИС
// ═══════════════════════════════════════════════════════

class WebhookService {
  /**
   * Отправить вебхук для события
   */
  async trigger(
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<{ sent: number; failed: number }> {
    const webhooks = await WebhookRepository.findByEvent(event);
    
    if (webhooks.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      webhooks.map(webhook => this.sendWebhook(webhook, event, data))
    );

    let sent = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
        WebhookRepository.recordSuccess(webhooks[index].id).catch(() => {});
      } else {
        failed++;
        const error = result.status === 'rejected' 
          ? result.reason?.message || 'Unknown error'
          : result.value.error || 'Request failed';
        WebhookRepository.recordFailure(webhooks[index].id, error).catch(() => {});
      }
    });

    return { sent, failed };
  }

  /**
   * Отправить вебхук с повторными попытками
   */
  private async sendWebhook(
    webhook: UpdateWebhook,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<WebhookSendResult> {
    const timestamp = new Date().toISOString();
    const payload: Omit<WebhookPayload, 'signature'> = {
      event,
      timestamp,
      data,
    };

    // Генерация HMAC-подписи
    const signature = this.generateSignature(payload, webhook.secret);
    const fullPayload: WebhookPayload = {
      ...payload,
      signature,
    };

    const maxRetries = webhook.retry_count;
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Задержка перед повторной попыткой
        await this.delay(webhook.retry_delay_ms);
      }

      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_ms);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp,
          },
          body: JSON.stringify(fullPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            durationMs,
          };
        }

        lastStatusCode = response.status;
        lastError = `HTTP ${response.status}: ${response.statusText}`;

        // Не повторяем для клиентских ошибок (4xx)
        if (response.status >= 400 && response.status < 500) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      durationMs: 0,
    };
  }

  /**
   * Генерация HMAC-SHA256 подписи
   */
  private generateSignature(
    payload: Omit<WebhookPayload, 'signature'>,
    secret: string
  ): string {
    const message = `${payload.event}:${payload.timestamp}:${JSON.stringify(payload.data)}`;
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  /**
   * Верификация подписи вебхука (для входящих запросов)
   */
  verifySignature(
    payload: Omit<WebhookPayload, 'signature'>,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем singleton
export const webhookService = new WebhookService();