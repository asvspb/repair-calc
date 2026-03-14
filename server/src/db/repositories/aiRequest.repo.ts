/**
 * Репозиторий для кэширования AI запросов
 * Фаза 7.5: AI-интеграция
 */

import type { Knex } from 'knex';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface AIRequestRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  provider: 'gemini' | 'mistral';
  request_type: string;
  prompt_hash: string;
  response: unknown;
  tokens_used: number;
  cost_usd: number;
  created_at: Date;
}

export interface CachedResponse {
  response: unknown;
  provider: 'gemini' | 'mistral';
  created_at: Date;
}

/**
 * Генерация хэша для кэширования запросов
 */
export function generatePromptHash(
  requestType: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  const promptString = `${requestType}:${JSON.stringify(sortedParams)}`;
  return createHash('sha256').update(promptString).digest('hex');
}

/**
 * AI Request Repository
 */
export class AIRequestRepository {
  constructor(private db: Knex) {}

  /**
   * Найти кэшированный ответ
   */
  async findCached(
    provider: 'gemini' | 'mistral',
    promptHash: string,
    maxAge: number = 24 * 60 * 60 * 1000 // 24 часа по умолчанию
  ): Promise<CachedResponse | null> {
    const cutoffTime = new Date(Date.now() - maxAge);

    const record = await this.db('ai_requests')
      .where({
        provider,
        prompt_hash: promptHash,
      })
      .whereNotNull('response')
      .where('created_at', '>=', cutoffTime)
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return null;
    }

    return {
      response: record.response,
      provider: record.provider,
      created_at: record.created_at,
    };
  }

  /**
   * Сохранить ответ в кэш
   */
  async saveResponse(
    userId: string,
    projectId: string | null,
    provider: 'gemini' | 'mistral',
    requestType: string,
    promptHash: string,
    response: unknown,
    tokensUsed: number = 0,
    costUsd: number = 0
  ): Promise<AIRequestRecord> {
    const record: AIRequestRecord = {
      id: uuidv4(),
      user_id: userId,
      project_id: projectId,
      provider,
      request_type: requestType,
      prompt_hash: promptHash,
      response,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      created_at: new Date(),
    };

    await this.db('ai_requests').insert(record);

    return record;
  }

  /**
   * Получить историю запросов пользователя
   */
  async getUserHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AIRequestRecord[]> {
    return this.db('ai_requests')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  /**
   * Получить статистику использования
   */
  async getUsageStats(
    userId: string,
    periodDays: number = 30
  ): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const cutoffTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const records = await this.db('ai_requests')
      .where('user_id', userId)
      .where('created_at', '>=', cutoffTime);

    const stats = {
      totalRequests: records.length,
      totalTokens: records.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
      totalCost: records.reduce((sum, r) => sum + (r.cost_usd || 0), 0),
      byProvider: {} as Record<string, number>,
      byType: {} as Record<string, number>,
    };

    for (const record of records) {
      stats.byProvider[record.provider] = (stats.byProvider[record.provider] || 0) + 1;
      stats.byType[record.request_type] = (stats.byType[record.request_type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Очистить старые записи кэша
   */
  async cleanupOldRecords(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const deleted = await this.db('ai_requests')
      .where('created_at', '<', cutoffTime)
      .delete();

    return deleted;
  }

  /**
   * Удалить все записи пользователя
   */
  async deleteUserRecords(userId: string): Promise<number> {
    return this.db('ai_requests').where('user_id', userId).delete();
  }
}

// Factory function
let aiRequestRepoInstance: AIRequestRepository | null = null;

export function getAIRequestRepository(db: Knex): AIRequestRepository {
  if (!aiRequestRepoInstance) {
    aiRequestRepoInstance = new AIRequestRepository(db);
  }
  return aiRequestRepoInstance;
}