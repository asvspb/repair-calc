import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type {
  PriceCatalog as _PriceCatalog,
  PriceSource,
  PriceCategory as _PriceCategory,
} from '../../types/index.js';

export type PriceCatalog = _PriceCatalog;
export type PriceCategory = _PriceCategory;
export type SourceType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api' | 'manual';

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

export class PriceCatalogRepository {
  static async create(input: CreatePriceCatalogInput): Promise<PriceCatalog> {
    const id = uuidv4();

    await db('price_catalog').insert({
      id,
      name: input.name,
      category: input.category,
      unit: input.unit || 'м²',
      city: input.city,
      price_min: input.price_min || 0,
      price_avg: input.price_avg || 0,
      price_max: input.price_max || 0,
      currency: input.currency || 'RUB',
      source_id: input.source_id || null,
      source_type: input.source_type || null,
      confidence_score: input.confidence_score || 0.5,
      description: input.description || null,
      metadata: input.metadata || null,
      valid_until: input.valid_until || null,
    });

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<PriceCatalog | null> {
    const row = await db('price_catalog').where({ id }).first();
    return row ? this.parseRow(row as PriceCatalog) : null;
  }

  static async findByNameCityCategory(
    name: string,
    city: string,
    category: PriceCategory,
    sourceType?: SourceType,
  ): Promise<PriceCatalog | null> {
    let query = db('price_catalog').where({ name, city, category });

    if (sourceType) {
      query = query.where({ source_type: sourceType });
    }

    const row = await query.orderBy('updated_at', 'desc').first();

    return row ? this.parseRow(row as PriceCatalog) : null;
  }

  static async update(id: string, input: UpdatePriceCatalogInput): Promise<PriceCatalog | null> {
    const updateData: Record<string, unknown> = {};
    const fields: (keyof UpdatePriceCatalogInput)[] = [
      'name',
      'unit',
      'price_min',
      'price_avg',
      'price_max',
      'source_id',
      'source_type',
      'confidence_score',
      'description',
      'metadata',
      'valid_until',
    ];

    for (const field of fields) {
      if (input[field] !== undefined) {
        updateData[field] = input[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    updateData.updated_at = db.fn.now();

    await db('price_catalog').where({ id }).update(updateData);

    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const deleted = await db('price_catalog').where({ id }).delete();
    return deleted > 0;
  }

  static async search(
    filter: PriceCatalogFilter,
  ): Promise<{ items: PriceCatalog[]; total: number }> {
    let query = db('price_catalog');
    let countQuery = db('price_catalog');

    if (filter.q) {
      query = query.where('name', 'like', `%${filter.q}%`);
      countQuery = countQuery.where('name', 'like', `%${filter.q}%`);
    }
    if (filter.city) {
      query = query.where({ city: filter.city });
      countQuery = countQuery.where({ city: filter.city });
    }
    if (filter.category) {
      query = query.where({ category: filter.category });
      countQuery = countQuery.where({ category: filter.category });
    }
    if (filter.sourceType) {
      query = query.where({ source_type: filter.sourceType });
      countQuery = countQuery.where({ source_type: filter.sourceType });
    }
    if (filter.minConfidence !== undefined) {
      query = query.where('confidence_score', '>=', filter.minConfidence);
      countQuery = countQuery.where('confidence_score', '>=', filter.minConfidence);
    }
    if (filter.stale) {
      const now = new Date();
      query = query.where(function () {
        this.where('valid_until', '<', now).orWhereNull('valid_until');
      });
      countQuery = countQuery.where(function () {
        this.where('valid_until', '<', now).orWhereNull('valid_until');
      });
    }

    const [countRow] = await countQuery.count('id as total');
    const total = Number(countRow?.total ?? 0);

    const sortBy = filter.sortBy || 'updated_at';
    const sortOrder = filter.sortOrder || 'desc';
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const rows = await query.orderBy(sortBy, sortOrder).limit(limit).offset(offset);

    return {
      items: (rows as PriceCatalog[]).map(row => this.parseRow(row)),
      total,
    };
  }

  static async findByCity(city: string, limit: number = 100): Promise<PriceCatalog[]> {
    const rows = await db('price_catalog')
      .where({ city })
      .orderBy('updated_at', 'desc')
      .limit(limit);

    return (rows as PriceCatalog[]).map(row => this.parseRow(row));
  }

  static async findStale(limit: number = 100): Promise<PriceCatalog[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const rows = await db('price_catalog')
      .where(function () {
        this.where('valid_until', '<', now).orWhere('updated_at', '<', sevenDaysAgo);
      })
      .orderBy('updated_at', 'asc')
      .limit(limit);

    return (rows as PriceCatalog[]).map(row => this.parseRow(row));
  }

  static async findForReview(limit: number = 100): Promise<PriceCatalog[]> {
    const rows = await db('price_catalog as pc')
      .join('price_history as ph', 'pc.id', 'ph.price_catalog_id')
      .where('ph.requires_review', true)
      .orderBy('ph.created_at', 'desc')
      .select('pc.*')
      .limit(limit);

    return (rows as PriceCatalog[]).map(row => this.parseRow(row));
  }

  static async getStats(): Promise<{
    total: number;
    byCategory: Record<PriceCategory, number>;
    stale: number;
    forReview: number;
    lastUpdated: Date | null;
  }> {
    const [totalRow] = await db('price_catalog').count('id as total');

    const categoryRows = await db('price_catalog')
      .select('category')
      .count('id as count')
      .groupBy('category');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const staleRows = await db('price_catalog')
      .where(function () {
        this.where('valid_until', '<', now).orWhere('updated_at', '<', sevenDaysAgo);
      })
      .count('id as total');
    const staleRow = staleRows?.[0];

    const reviewRows = await db('price_catalog as pc')
      .join('price_history as ph', 'pc.id', 'ph.price_catalog_id')
      .where('ph.requires_review', true)
      .countDistinct('pc.id as total');
    const reviewRow = reviewRows?.[0];

    const lastUpdatedRow = await db('price_catalog').max('updated_at as updated_at').first();

    const byCategory: Record<PriceCategory, number> = {
      work: 0,
      material: 0,
      tool: 0,
    };

    for (const row of categoryRows as Array<{ category: PriceCategory; count: number }>) {
      byCategory[row.category] = Number(row.count);
    }

    return {
      total: Number(totalRow?.total ?? 0),
      byCategory,
      stale: Number(staleRow?.total ?? 0),
      forReview: Number(reviewRow?.total ?? 0),
      lastUpdated: (lastUpdatedRow as any)?.updated_at ?? null,
    };
  }

  static async upsert(input: CreatePriceCatalogInput): Promise<PriceCatalog> {
    const existing = await this.findByNameCityCategory(
      input.name,
      input.city,
      input.category,
      input.source_type as SourceType,
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

  private static parseRow(row: PriceCatalog): PriceCatalog {
    return {
      ...row,
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata
        : null,
    };
  }
}

export class PriceSourceRepository {
  static async findAll(): Promise<PriceSource[]> {
    const rows = await db('price_sources').orderBy('priority', 'asc');
    return rows as PriceSource[];
  }

  static async findActive(): Promise<PriceSource[]> {
    const rows = await db('price_sources').where({ is_active: true }).orderBy('priority', 'asc');

    return rows as PriceSource[];
  }

  static async findById(id: string): Promise<PriceSource | null> {
    const row = await db('price_sources').where({ id }).first();
    return (row as PriceSource) || null;
  }

  static async findByType(type: SourceType): Promise<PriceSource | null> {
    const row = await db('price_sources')
      .where({ type, is_active: true })
      .orderBy('priority', 'asc')
      .first();

    return (row as PriceSource) || null;
  }

  static async updateCircuitBreaker(
    id: string,
    state: 'closed' | 'open' | 'half-open',
    failures: number,
  ): Promise<void> {
    await db('price_sources')
      .where({ id })
      .update({
        circuit_breaker_state: state,
        circuit_breaker_failures: failures,
        circuit_breaker_last_failure_at: state !== 'closed' ? new Date() : null,
        updated_at: new Date(),
      });
  }

  static async setActive(id: string, isActive: boolean): Promise<void> {
    await db('price_sources').where({ id }).update({ is_active: isActive, updated_at: new Date() });
  }
}
