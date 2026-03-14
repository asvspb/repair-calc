import { query, execute } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export type PriceCategory = 'work' | 'material' | 'tool';
export type SourceType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api' | 'manual';

export interface PriceCatalog {
  id: string;
  name: string;
  category: PriceCategory;
  unit: string;
  city: string;
  price_min: number;
  price_avg: number;
  price_max: number;
  currency: string;
  source_id: string | null;
  source_type: SourceType | null;
  confidence_score: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  valid_from: Date;
  valid_until: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePriceCatalogInput {
  name: string;
  category: PriceCategory;
  unit?: string;
  city: string;
  price_min?: number;
  price_avg?: number;
  price_max?: number;
  currency?: string;
  source_id?: string;
  source_type?: SourceType;
  confidence_score?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  valid_until?: Date;
}

export interface UpdatePriceCatalogInput {
  name?: string;
  unit?: string;
  price_min?: number;
  price_avg?: number;
  price_max?: number;
  source_id?: string;
  source_type?: SourceType;
  confidence_score?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  valid_until?: Date;
}

export interface PriceCatalogFilter {
  q?: string;
  city?: string;
  category?: PriceCategory;
  sourceType?: SourceType;
  minConfidence?: number;
  stale?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'updated_at' | 'price_avg';
  sortOrder?: 'asc' | 'desc';
}

export interface PriceSource {
  id: string;
  name: string;
  type: SourceType;
  api_endpoint: string | null;
  is_active: boolean;
  priority: number;
  rate_limit_per_minute: number;
  circuit_breaker_failures: number;
  circuit_breaker_state: 'closed' | 'open' | 'half-open';
  circuit_breaker_last_failure_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ КАТАЛОГА ЦЕН
// ═══════════════════════════════════════════════════════

export class PriceCatalogRepository {
  // ─── CRUD ────────────────────────────────────────────────

  static async create(input: CreatePriceCatalogInput): Promise<PriceCatalog> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO price_catalog (
        id, name, category, unit, city,
        price_min, price_avg, price_max, currency,
        source_id, source_type, confidence_score, description, metadata,
        valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.category,
        input.unit || 'м²',
        input.city,
        input.price_min || 0,
        input.price_avg || 0,
        input.price_max || 0,
        input.currency || 'RUB',
        input.source_id || null,
        input.source_type || null,
        input.confidence_score || 0.5,
        input.description || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.valid_until || null,
      ]
    );
    
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      'SELECT * FROM price_catalog WHERE id = ?',
      [id]
    );
    
    return this.parseRow(rows[0]!);
  }

  static async findById(id: string): Promise<PriceCatalog | null> {
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      'SELECT * FROM price_catalog WHERE id = ?',
      [id]
    );
    
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  static async findByNameCityCategory(
    name: string,
    city: string,
    category: PriceCategory,
    sourceType?: SourceType
  ): Promise<PriceCatalog | null> {
    let sql = 'SELECT * FROM price_catalog WHERE name = ? AND city = ? AND category = ?';
    const params: (string | number)[] = [name, city, category];
    
    if (sourceType) {
      sql += ' AND source_type = ?';
      params.push(sourceType);
    }
    
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(sql, params);
    
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  static async update(id: string, input: UpdatePriceCatalogInput): Promise<PriceCatalog | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.unit !== undefined) {
      fields.push('unit = ?');
      values.push(input.unit);
    }
    if (input.price_min !== undefined) {
      fields.push('price_min = ?');
      values.push(input.price_min);
    }
    if (input.price_avg !== undefined) {
      fields.push('price_avg = ?');
      values.push(input.price_avg);
    }
    if (input.price_max !== undefined) {
      fields.push('price_max = ?');
      values.push(input.price_max);
    }
    if (input.source_id !== undefined) {
      fields.push('source_id = ?');
      values.push(input.source_id);
    }
    if (input.source_type !== undefined) {
      fields.push('source_type = ?');
      values.push(input.source_type);
    }
    if (input.confidence_score !== undefined) {
      fields.push('confidence_score = ?');
      values.push(input.confidence_score);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description);
    }
    if (input.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(input.metadata));
    }
    if (input.valid_until !== undefined) {
      fields.push('valid_until = ?');
      values.push(input.valid_until);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('version = version + 1');
    
    values.push(id);
    
    await execute(
      `UPDATE price_catalog SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM price_catalog WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  // ─── ПОИСК И ФИЛЬТРАЦИЯ ───────────────────────────────────

  static async search(filter: PriceCatalogFilter): Promise<{ items: PriceCatalog[]; total: number }> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.q) {
      conditions.push('name LIKE ?');
      params.push(`%${filter.q}%`);
    }
    if (filter.city) {
      conditions.push('city = ?');
      params.push(filter.city);
    }
    if (filter.category) {
      conditions.push('category = ?');
      params.push(filter.category);
    }
    if (filter.sourceType) {
      conditions.push('source_type = ?');
      params.push(filter.sourceType);
    }
    if (filter.minConfidence !== undefined) {
      conditions.push('confidence_score >= ?');
      params.push(filter.minConfidence);
    }
    if (filter.stale) {
      conditions.push('(valid_until IS NOT NULL AND valid_until < NOW())');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM price_catalog ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Get items
    const sortBy = filter.sortBy || 'updated_at';
    const sortOrder = filter.sortOrder || 'desc';
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      `SELECT * FROM price_catalog ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      items: rows.map(row => this.parseRow(row)),
      total,
    };
  }

  static async findByCity(city: string, limit: number = 100): Promise<PriceCatalog[]> {
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      'SELECT * FROM price_catalog WHERE city = ? ORDER BY updated_at DESC LIMIT ?',
      [city, limit]
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async findStale(limit: number = 100): Promise<PriceCatalog[]> {
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      `SELECT * FROM price_catalog 
       WHERE valid_until IS NOT NULL AND valid_until < NOW() 
       OR updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY updated_at ASC 
       LIMIT ?`,
      [limit]
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async findForReview(limit: number = 100): Promise<PriceCatalog[]> {
    const rows = await query<(PriceCatalog & RowDataPacket)[]>(
      `SELECT pc.* FROM price_catalog pc
       JOIN price_history ph ON pc.id = ph.price_catalog_id
       WHERE ph.requires_review = TRUE
       ORDER BY ph.created_at DESC
       LIMIT ?`,
      [limit]
    );
    
    return rows.map(row => this.parseRow(row));
  }

  // ─── СТАТИСТИКА ───────────────────────────────────────────

  static async getStats(): Promise<{
    total: number;
    byCategory: Record<PriceCategory, number>;
    stale: number;
    forReview: number;
    lastUpdated: Date | null;
  }> {
    const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM price_catalog'
    );

    const categoryRows = await query<(RowDataPacket & { category: PriceCategory; count: number })[]>(
      'SELECT category, COUNT(*) as count FROM price_catalog GROUP BY category'
    );

    const [staleRow] = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM price_catalog 
       WHERE valid_until IS NOT NULL AND valid_until < NOW() 
       OR updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    const [reviewRow] = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(DISTINCT pc.id) as total FROM price_catalog pc
       JOIN price_history ph ON pc.id = ph.price_catalog_id
       WHERE ph.requires_review = TRUE`
    );

    const [lastUpdatedRow] = await query<(RowDataPacket & { updated_at: Date | null })[]>(
      'SELECT MAX(updated_at) as updated_at FROM price_catalog'
    );

    const byCategory: Record<PriceCategory, number> = {
      work: 0,
      material: 0,
      tool: 0,
    };
    
    for (const row of categoryRows) {
      byCategory[row.category] = row.count;
    }

    return {
      total: totalRow?.total || 0,
      byCategory,
      stale: staleRow?.total || 0,
      forReview: reviewRow?.total || 0,
      lastUpdated: lastUpdatedRow?.updated_at || null,
    };
  }

  // ─── UPSERT ───────────────────────────────────────────────

  static async upsert(input: CreatePriceCatalogInput): Promise<PriceCatalog> {
    const existing = await this.findByNameCityCategory(
      input.name,
      input.city,
      input.category,
      input.source_type
    );

    if (existing) {
      return this.update(existing.id, {
        price_min: input.price_min,
        price_avg: input.price_avg,
        price_max: input.price_max,
        source_id: input.source_id,
        confidence_score: input.confidence_score,
        description: input.description,
        metadata: input.metadata,
        valid_until: input.valid_until,
      }) as Promise<PriceCatalog>;
    }

    return this.create(input);
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private static parseRow(row: PriceCatalog): PriceCatalog {
    return {
      ...row,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    };
  }
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ИСТОЧНИКОВ ЦЕН
// ═══════════════════════════════════════════════════════

export class PriceSourceRepository {
  static async findAll(): Promise<PriceSource[]> {
    const rows = await query<(PriceSource & RowDataPacket)[]>(
      'SELECT * FROM price_sources ORDER BY priority ASC'
    );
    
    return rows;
  }

  static async findActive(): Promise<PriceSource[]> {
    const rows = await query<(PriceSource & RowDataPacket)[]>(
      'SELECT * FROM price_sources WHERE is_active = TRUE ORDER BY priority ASC'
    );
    
    return rows;
  }

  static async findById(id: string): Promise<PriceSource | null> {
    const rows = await query<(PriceSource & RowDataPacket)[]>(
      'SELECT * FROM price_sources WHERE id = ?',
      [id]
    );
    
    return rows[0] || null;
  }

  static async findByType(type: SourceType): Promise<PriceSource | null> {
    const rows = await query<(PriceSource & RowDataPacket)[]>(
      'SELECT * FROM price_sources WHERE type = ? AND is_active = TRUE ORDER BY priority ASC LIMIT 1',
      [type]
    );
    
    return rows[0] || null;
  }

  static async updateCircuitBreaker(
    id: string,
    state: 'closed' | 'open' | 'half-open',
    failures: number
  ): Promise<void> {
    const lastFailureAt = state !== 'closed' ? new Date() : null;
    
    await execute(
      `UPDATE price_sources 
       SET circuit_breaker_state = ?, 
           circuit_breaker_failures = ?,
           circuit_breaker_last_failure_at = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [state, failures, lastFailureAt, id]
    );
  }

  static async setActive(id: string, isActive: boolean): Promise<void> {
    await execute(
      'UPDATE price_sources SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [isActive, id]
    );
  }
}