import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import {
  PriceCatalogRepository,
  type PriceCategory,
  type SourceType,
} from '../../db/repositories/priceCatalog.repo.js';
import { PriceHistoryRepository } from '../../db/repositories/priceHistory.repo.js';
import { createPriceSchema } from './schemas.js';
import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';

export const router = Router();

/**
 * GET /prices
 * Поиск в каталоге цен
 */
router.get('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    const city = req.query.city as string | undefined;
    const category = req.query.category as PriceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;
    const minConfidence = req.query.minConfidence
      ? parseFloat(req.query.minConfidence as string)
      : undefined;
    const stale = req.query.stale === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as 'name' | 'updated_at' | 'price_avg') || 'updated_at';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const { items, total } = await PriceCatalogRepository.search({
      q,
      city,
      category,
      sourceType,
      minConfidence,
      stale,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    res.json({
      status: 'success',
      data: {
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          city: item.city,
          prices: {
            min: item.price_min,
            avg: item.price_avg,
            max: item.price_max,
            currency: item.currency,
          },
          sourceType: item.source_type,
          confidenceScore: item.confidence_score,
          updatedAt: item.updated_at,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prices/:id
 * Получить цену по ID
 */
router.get('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const item = await PriceCatalogRepository.findById(id);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        error: 'Price not found',
      });
    }

    res.json({
      status: 'success',
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prices/:id/history
 * История изменений цены
 */
router.get('/prices/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await PriceHistoryRepository.findByCatalogId(id, limit);

    res.json({
      status: 'success',
      data: {
        priceCatalogId: id,
        history: history.map(h => ({
          id: h.id,
          oldPrices: {
            min: h.old_price_min,
            avg: h.old_price_avg,
            max: h.old_price_max,
          },
          newPrices: {
            min: h.new_price_min,
            avg: h.new_price_avg,
            max: h.new_price_max,
          },
          changePercent: h.price_change_percent,
          sourceId: h.source_id,
          confidenceScore: h.confidence_score,
          requiresReview: h.requires_review,
          createdAt: h.created_at,
        })),
        total: history.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /prices
 * Добавить цену вручную
 */
router.post(
  '/prices',
  authenticate,
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createPriceSchema.parse(req.body);

      const price = await PriceCatalogRepository.create({
        name: input.name,
        category: input.category,
        unit: input.unit,
        city: input.city,
        price_min: input.price_min,
        price_avg: input.price_avg,
        price_max: input.price_max,
        currency: input.currency,
        source_type: input.source_type || 'manual',
        confidence_score: input.confidence_score,
        description: input.description,
        metadata: input.metadata,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      res.status(201).json({
        status: 'success',
        data: price,
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
  },
);

/**
 * PUT /prices/:id
 * Обновить цену вручную
 */
router.put(
  '/prices/:id',
  authenticate,
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const input = req.body;

      const existing = await PriceCatalogRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          error: 'Price not found',
        });
      }

      const updated = await PriceCatalogRepository.update(id, {
        price_min: input.price_min,
        price_avg: input.price_avg,
        price_max: input.price_max,
        confidence_score: input.confidence_score,
        description: input.description,
        metadata: input.metadata,
      });

      res.json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /prices/:id
 * Удалить запись из каталога
 */
router.delete(
  '/prices/:id',
  authenticate,
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const deleted = await PriceCatalogRepository.delete(id);
      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          error: 'Price not found',
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
  },
);

/**
 * GET /prices/export
 * Экспорт каталога цен в CSV, XLSX или JSON
 */
router.get('/prices/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'json';
    const city = req.query.city as string | undefined;
    const category = req.query.category as PriceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;

    const { items } = await PriceCatalogRepository.search({
      city,
      category,
      sourceType,
      limit: 10000,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    if (items.length === 0) {
      return res.status(404).json({
        status: 'error',
        error: 'No prices found for export',
      });
    }

    const exportData = items.map(item => ({
      name: item.name,
      category: item.category,
      unit: item.unit,
      city: item.city,
      price_min: item.price_min,
      price_avg: item.price_avg,
      price_max: item.price_max,
      currency: item.currency,
      source_type: item.source_type || '',
      confidence_score: item.confidence_score,
      description: item.description || '',
      updated_at: item.updated_at.toISOString(),
    }));

    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = `price_catalog_${timestamp}`;

    switch (format) {
      case 'csv': {
        const headers = [
          'name',
          'category',
          'unit',
          'city',
          'price_min',
          'price_avg',
          'price_max',
          'currency',
          'source_type',
          'confidence_score',
          'description',
          'updated_at',
        ];
        const csvRows = [
          headers.join(';'),
          ...exportData.map(row =>
            headers
              .map(h => {
                const value = row[h as keyof typeof row];
                if (
                  typeof value === 'string' &&
                  (value.includes(';') || value.includes('"') || value.includes('\n'))
                ) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return String(value);
              })
              .join(';'),
          ),
        ];

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
        res.send('\uFEFF' + csvRows.join('\n'));
        return;
      }

      case 'xlsx': {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Price Catalog');

        worksheet.columns = [
          { header: 'Название', key: 'name', width: 40 },
          { header: 'Категория', key: 'category', width: 12 },
          { header: 'Ед. изм.', key: 'unit', width: 10 },
          { header: 'Город', key: 'city', width: 20 },
          { header: 'Цена мин.', key: 'price_min', width: 12 },
          { header: 'Цена средн.', key: 'price_avg', width: 12 },
          { header: 'Цена макс.', key: 'price_max', width: 12 },
          { header: 'Валюта', key: 'currency', width: 8 },
          { header: 'Источник', key: 'source_type', width: 15 },
          { header: 'Доверие', key: 'confidence_score', width: 10 },
          { header: 'Описание', key: 'description', width: 30 },
          { header: 'Обновлено', key: 'updated_at', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        worksheet.addRows(exportData);

        worksheet.getColumn('price_min').numFmt = '#,##0.00';
        worksheet.getColumn('price_avg').numFmt = '#,##0.00';
        worksheet.getColumn('price_max').numFmt = '#,##0.00';
        worksheet.getColumn('confidence_score').numFmt = '0.00';

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      case 'json':
      default: {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.json"`);
        res.json({
          status: 'success',
          data: {
            exportedAt: new Date().toISOString(),
            totalItems: exportData.length,
            filters: { city, category, sourceType },
            items: exportData,
          },
        });
        return;
      }
    }
  } catch (error) {
    next(error);
  }
});
