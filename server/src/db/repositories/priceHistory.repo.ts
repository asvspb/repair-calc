import { query, execute } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';
import { PriceCategory, SourceType } from './priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export interface PriceHistory {
  id: string;
  price_catalog_id: string;
  job_id: string | null;
  old_price_min: number | null;
  old_price_avg: number | null;
  old_price_max: number | null;
  new_price_min: number | null;
  new_price_avg: number | null;
  new_price_max: number | null;
  price_change_percent: number | null;
  source_id: string | null;
  confidence_score: number | null;
  requires_review: boolean;
  created_at: Date;
}

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

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ИСТОРИИ ЦЕН
// ═══════════════════════════════════════════════════════

export class PriceHistoryRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async create(input: CreatePriceHistoryInput): Promise<PriceHistory> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO price_history (
        id, price_catalog_id, job_id,
        old_price_min, old_price_avg, old_price_max,
        new_price_min, new_price_avg, new_price_max,
        price_change_percent, source_id, confidence_score, requires_review
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.price_catalog_id,
        input.job_id || null,
        input.old_price_min ?? null,
        input.old_price_avg ?? null,
        input.old_price_max ?? null,
        input.new_price_min ?? null,
        input.new_price_avg ?? null,
        input.new_price_max ?? null,
        input.price_change_percent ?? null,
        input.source_id || null,
        input.confidence_score ?? null,
        input.requires_review ?? false,
      ]
    );
    
    const rows = await query<(PriceHistory & RowDataPacket)[]>(
      'SELECT * FROM price_history WHERE id = ?',
      [id]
    );
    
    return rows[0]!;
  }

  // ─── READ ────────────────────────────────────────────────

  static async findByCatalogId(
    priceCatalogId: string,
    limit: number = 20
  ): Promise<PriceHistory[]> {
    const rows = await query<(PriceHistory & RowDataPacket)[]>(
      `SELECT * FROM price_history 
       WHERE price_catalog_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [priceCatalogId, limit]
    );
    
    return rows;
  }

  static async findByJobId(jobId: string): Promise<PriceHistory[]> {
    const rows = await query<(PriceHistory & RowDataPacket)[]>(
      `SELECT * FROM price_history WHERE job_id = ? ORDER BY created_at DESC`,
      [jobId]
    );
    
    return rows;
  }

  static async findForReview(limit: number = 100): Promise<PriceHistory[]> {
    const rows = await query<(PriceHistory & RowDataPacket)[]>(
      `SELECT * FROM price_history 
       WHERE requires_review = TRUE 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );
    
    return rows;
  }

  static async getLatest(priceCatalogId: string): Promise<PriceHistory | null> {
    const rows = await query<(PriceHistory & RowDataPacket)[]>(
      `SELECT * FROM price_history 
       WHERE price_catalog_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [priceCatalogId]
    );
    
    return rows[0] || null;
  }

  // ─── UPDATE ────────────────────────────────────────────────

  static async markReviewed(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE price_history SET requires_review = FALSE WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async markAllReviewed(priceCatalogId: string): Promise<number> {
    const result = await execute(
      'UPDATE price_history SET requires_review = FALSE WHERE price_catalog_id = ? AND requires_review = TRUE',
      [priceCatalogId]
    );
    
    return result.affectedRows;
  }

  // ─── СТАТИСТИКА ───────────────────────────────────────────

  static async getStats(): Promise<{
    total: number;
    forReview: number;
    avgChangePercent: number | null;
    lastCreated: Date | null;
  }> {
    const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM price_history'
    );

    const [reviewRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM price_history WHERE requires_review = TRUE'
    );

    const [avgRow] = await query<(RowDataPacket & { avg: number | null })[]>(
      'SELECT AVG(ABS(price_change_percent)) as avg FROM price_history WHERE price_change_percent IS NOT NULL'
    );

    const [lastRow] = await query<(RowDataPacket & { created_at: Date | null })[]>(
      'SELECT MAX(created_at) as created_at FROM price_history'
    );

    return {
      total: totalRow?.total || 0,
      forReview: reviewRow?.total || 0,
      avgChangePercent: avgRow?.avg || null,
      lastCreated: lastRow?.created_at || null,
    };
  }

  // ─── АНОМАЛИИ ─────────────────────────────────────────────

  static async detectAnomaly(
    oldPrice: number,
    newPrice: number,
    thresholdPercent: number = 100
  ): { isAnomaly: boolean; changePercent: number; severity: 'low' | 'medium' | 'high' } {
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