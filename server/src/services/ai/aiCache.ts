import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db/db.js';

export interface CachedAIResponse {
  id: string;
  response: unknown;
  provider: 'gemini' | 'mistral';
  created_at: Date;
}

export function generatePromptHash(requestType: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

  const promptString = `${requestType}:${JSON.stringify(sortedParams)}`;
  return createHash('sha256').update(promptString).digest('hex');
}

export async function findCachedResponse(
  provider: 'gemini' | 'mistral',
  promptHash: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<CachedAIResponse | null> {
  const cutoffTime = new Date(Date.now() - maxAgeMs);

  const row = await db('ai_requests')
    .select('id', 'response', 'provider', 'created_at')
    .where({ provider, prompt_hash: promptHash })
    .whereNotNull('response')
    .where('created_at', '>=', cutoffTime)
    .orderBy('created_at', 'desc')
    .first();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response,
    provider: row.provider,
    created_at: row.created_at,
  };
}

export async function saveCachedResponse(
  userId: string,
  projectId: string | null,
  provider: 'gemini' | 'mistral',
  requestType: string,
  promptHash: string,
  response: unknown,
  tokensUsed: number = 0,
  costUsd: number = 0,
): Promise<string> {
  const id = uuidv4();

  const [insertedId] = await db('ai_requests')
    .insert({
      id,
      user_id: userId,
      project_id: projectId,
      provider,
      request_type: requestType,
      prompt_hash: promptHash,
      response,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      created_at: new Date(),
    })
    .returning('id');

  return insertedId?.id ?? id;
}

export async function getUserAIHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<
  {
    id: string;
    provider: 'gemini' | 'mistral';
    request_type: string;
    tokens_used: number;
    cost_usd: number;
    created_at: Date;
  }[]
> {
  return db('ai_requests')
    .select('id', 'provider', 'request_type', 'tokens_used', 'cost_usd', 'created_at')
    .where('user_id', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
}

export async function getAIUsageStats(
  userId: string,
  periodDays: number = 30,
): Promise<{
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, number>;
  byType: Record<string, number>;
}> {
  const cutoffTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const rows = await db('ai_requests')
    .select('provider', 'request_type', 'tokens_used', 'cost_usd')
    .where('user_id', userId)
    .where('created_at', '>=', cutoffTime);

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

export async function cleanupOldAIRecords(olderThanDays: number = 30): Promise<number> {
  const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const deleted = await db('ai_requests').where('created_at', '<', cutoffTime).delete();

  return deleted;
}

export function shouldUseCache(requestType: string): boolean {
  const cacheableTypes = ['estimate', 'suggest-materials', 'generate-template', 'search-price'];
  return cacheableTypes.includes(requestType);
}

export function getCacheTTL(requestType: string): number {
  const ttlMap: Record<string, number> = {
    estimate: 24 * 60 * 60 * 1000,
    'suggest-materials': 12 * 60 * 60 * 1000,
    'generate-template': 7 * 24 * 60 * 60 * 1000,
    'search-price': 6 * 60 * 60 * 1000,
  };

  return ttlMap[requestType] || 24 * 60 * 60 * 1000;
}
