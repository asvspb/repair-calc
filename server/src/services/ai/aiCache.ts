/**
 * AI Cache Service - кэширование AI-ответов
 * Фаза 7.5: AI-интеграция
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../db/pool.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface CachedAIResponse {
  id: string;
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
 * Найти кэшированный ответ
 */
export async function findCachedResponse(
  provider: 'gemini' | 'mistral',
  promptHash: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 часа
): Promise<CachedAIResponse | null> {
  const cutoffTime = new Date(Date.now() - maxAgeMs);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, response, provider, created_at 
     FROM ai_requests 
     WHERE provider = ? AND prompt_hash = ? 
       AND response IS NOT NULL 
       AND created_at >= ?
     ORDER BY created_at DESC 
     LIMIT 1`,
    [provider, promptHash, cutoffTime]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response,
    provider: row.provider,
    created_at: row.created_at,
  };
}

/**
 * Сохранить ответ в кэш
 */
export async function saveCachedResponse(
  userId: string,
  projectId: string | null,
  provider: 'gemini' | 'mistral',
  requestType: string,
  promptHash: string,
  response: unknown,
  tokensUsed: number = 0,
  costUsd: number = 0
): Promise<string> {
  const id = uuidv4();

  await pool.execute<ResultSetHeader>(
    `INSERT INTO ai_requests 
     (id, user_id, project_id, provider, request_type, prompt_hash, response, tokens_used, cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      userId,
      projectId,
      provider,
      requestType,
      promptHash,
      JSON.stringify(response),
      tokensUsed,
      costUsd,
    ]
  );

  return id;
}

/**
 * Получить историю запросов пользователя
 */
export async function getUserAIHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<RowDataPacket[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, provider, request_type, tokens_used, cost_usd, created_at
     FROM ai_requests 
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  return rows;
}

/**
 * Получить статистику использования AI
 */
export async function getAIUsageStats(
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

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT provider, request_type, tokens_used, cost_usd
     FROM ai_requests 
     WHERE user_id = ? AND created_at >= ?`,
    [userId, cutoffTime]
  );

  const stats = {
    totalRequests: rows.length,
    totalTokens: 0,
    totalCost: 0,
    byProvider: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  };

  for (const row of rows) {
    stats.totalTokens += row.tokens_used || 0;
    stats.totalCost += row.cost_usd || 0;
    stats.byProvider[row.provider] = (stats.byProvider[row.provider] || 0) + 1;
    stats.byType[row.request_type] = (stats.byType[row.request_type] || 0) + 1;
  }

  return stats;
}

/**
 * Очистить старые записи кэша
 */
export async function cleanupOldAIRecords(
  olderThanDays: number = 30
): Promise<number> {
  const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM ai_requests WHERE created_at < ?',
    [cutoffTime]
  );

  return result.affectedRows;
}

/**
 * Проверить, нужно ли использовать кэш
 */
export function shouldUseCache(requestType: string): boolean {
  // Кэшируем только определенные типы запросов
  const cacheableTypes = ['estimate', 'suggest-materials', 'generate-template'];
  return cacheableTypes.includes(requestType);
}

/**
 * Получить время жизни кэша для типа запроса
 */
export function getCacheTTL(requestType: string): number {
  const ttlMap: Record<string, number> = {
    estimate: 24 * 60 * 60 * 1000, // 24 часа
    'suggest-materials': 12 * 60 * 60 * 1000, // 12 часов
    'generate-template': 7 * 24 * 60 * 60 * 1000, // 7 дней
  };

  return ttlMap[requestType] || 24 * 60 * 60 * 1000;
}