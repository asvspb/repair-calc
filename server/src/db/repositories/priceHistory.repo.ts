import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { PriceHistory } from '../../types/index.js';

export interface CreatePriceHistoryInput {
  price_catalog_id: string;
  job_id?: string;
  old_price_min?: number;
  old_price_avg?: number;
  old_price_max?: number;
  new_price_min?: number;
  new_price_avg?: number;
  new_price_max?: number;
  price_change_percent?: number;
  source_id?: string;
  confidence_score?: number;
  requires_review?: boolean;
}

export class PriceHistoryRepository {
  static async create(input: CreatePriceHistoryInput): Promise<PriceHistory> {
    const id = uuidv4();

    await db('price_history').insert({
      id,
      price_catalog_id: input.price_catalog_id,
      job_id: input.job_id || null,
      old_price_min: input.old_price_min ?? null,
      old_price_avg: input.old_price_avg ?? null,
      old_price_max: input.old_price_max ?? null,
      new_price_min: input.new_price_min ?? null,
      new_price_avg: input.new_price_avg ?? null,
      new_price_max: input.new_price_max ?? null,
      price_change_percent: input.price_change_percent ?? null,
      source_id: input.source_id || null,
      confidence_score: input.confidence_score ?? null,
      requires_review: input.requires_review ?? false,
    });

    return (await this.findByCatalogId(input.price_catalog_id))[0];
  }

  static async findByCatalogId(
    priceCatalogId: string,
    limit: number = 20,
  ): Promise<PriceHistory[]> {
    const rows = await db('price_history')
      .where({ price_catalog_id: priceCatalogId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows as PriceHistory[];
  }

  static async findByJobId(jobId: string): Promise<PriceHistory[]> {
    const rows = await db('price_history').where({ job_id: jobId }).orderBy('created_at', 'desc');

    return rows as PriceHistory[];
  }

  static async findForReview(limit: number = 100): Promise<PriceHistory[]> {
    const rows = await db('price_history')
      .where({ requires_review: true })
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows as PriceHistory[];
  }

  static async getLatest(priceCatalogId: string): Promise<PriceHistory | null> {
    const row = await db('price_history')
      .where({ price_catalog_id: priceCatalogId })
      .orderBy('created_at', 'desc')
      .first();

    return (row as PriceHistory) || null;
  }

  static async markReviewed(id: string): Promise<boolean> {
    const updated = await db('price_history').where({ id }).update({ requires_review: false });

    return updated > 0;
  }

  static async markAllReviewed(priceCatalogId: string): Promise<number> {
    const updated = await db('price_history')
      .where({ price_catalog_id: priceCatalogId, requires_review: true })
      .update({ requires_review: false });

    return updated;
  }

  static async getStats(): Promise<{
    total: number;
    forReview: number;
    avgChangePercent: number | null;
    lastCreated: Date | null;
  }> {
    const totalRows = await db('price_history').count('id as total');
    const totalRow = totalRows?.[0];

    const reviewRows = await db('price_history')
      .where({ requires_review: true })
      .count('id as total');
    const reviewRow = reviewRows?.[0];

    const avgRows = await db('price_history')
      .whereNotNull('price_change_percent')
      .avg('price_change_percent as avg');
    const avgRow = avgRows?.[0];

    const lastRow = await db('price_history').max('created_at as created_at').first();

    return {
      total: Number(totalRow?.total ?? 0),
      forReview: Number(reviewRow?.total ?? 0),
      avgChangePercent: (avgRow as any)?.avg ?? null,
      lastCreated: (lastRow as any)?.created_at ?? null,
    };
  }

  static async detectAnomaly(
    oldPrice: number,
    newPrice: number,
    thresholdPercent: number = 100,
  ): Promise<{ isAnomaly: boolean; changePercent: number; severity: 'low' | 'medium' | 'high' }> {
    if (!oldPrice || oldPrice === 0) {
      return { isAnomaly: false, changePercent: 0, severity: 'low' };
    }

    const changePercent = Math.abs(((newPrice - oldPrice) / oldPrice) * 100);

    if (changePercent > 200) {
      return { isAnomaly: true, changePercent, severity: 'high' };
    }
    if (changePercent > 100) {
      return { isAnomaly: true, changePercent, severity: 'medium' };
    }
    if (changePercent > thresholdPercent) {
      return { isAnomaly: true, changePercent, severity: 'low' };
    }

    return { isAnomaly: false, changePercent, severity: 'low' };
  }
}
