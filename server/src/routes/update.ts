/**
 * API Routes для Update Service
 * UPDATE_SERVICE - Specification v1.1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import multer from 'multer';
import {
  UpdateJobRepository,
  UpdateJobItemRepository,
  UpdateLogRepository,
  type JobType,
  type JobStatus,
} from '../db/repositories/updateJob.repo.js';
import {
  PriceCatalogRepository,
  PriceSourceRepository,
  type PriceCategory,
  type SourceType,
} from '../db/repositories/priceCatalog.repo.js';
import {
  PriceHistoryRepository,
} from '../db/repositories/priceHistory.repo.js';
import { WebhookRepository, type WebhookEvent } from '../db/repositories/webhook.repo.js';
import { getUpdateRunner } from '../services/update/runner.js';

export const router = Router();

// ═══════════════════════════════════════════════════════
// MULTER CONFIG (file upload)
// ═══════════════════════════════════════════════════════

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
    ];
    const allowedExts = ['.csv', '.xlsx', '.json'];
    const ext = file.originalname.toLowerCase().slice(-5);
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.some(e => ext.endsWith(e))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, XLSX, and JSON are allowed.'));
    }
  },
});

// ═══════════════════════════════════════════════════════
// ВАЛИДАЦИЯ
// ═══════════════════════════════════════════════════════

const runUpdateSchema = z.object({
  city: z.string().max(100).optional(),
  categories: z.array(z.enum(['work', 'material', 'tool'])).optional(),
  sources: z.array(z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api'])).optional(),
  force: z.boolean().default(false),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  batchSize: z.number().min(1).max(50).default(10),
});

const updateScheduleSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().max(100),
  timezone: z.string().max(50),
});

const createPriceSchema = z.object({
  name: z.string().max(255),
  category: z.enum(['work', 'material', 'tool']),
  unit: z.string().max(36).default('м²'),
  city: z.string().max(100),
  price_min: z.number().min(0).optional(),
  price_avg: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  currency: z.string().length(3).default('RUB'),
  source_type: z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api', 'manual']).optional(),
  confidence_score: z.number().min(0).max(1).default(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ОБНОВЛЕНИЯМИ
// ═══════════════════════════════════════════════════════

/**
 * POST /api/update/run
 * Запуск обновления вручную
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = runUpdateSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Проверяем, есть ли уже запущенные задачи
    const runningJobs = await UpdateJobRepository.findRunning();
    if (runningJobs.length >= 3) {
      return res.status(429).json({
        status: 'error',
        error: 'Too many running jobs. Please wait.',
      });
    }

    const runner = getUpdateRunner({
      batchSize: input.batchSize,
    });

    const job = await runner.runManual({
      city: input.city,
      categories: input.categories as PriceCategory[],
      sources: input.sources as SourceType[],
      force: input.force,
      triggeredBy: userId,
    });

    res.json({
      status: 'success',
      data: {
        jobId: job.id,
        type: job.type,
        status: job.status,
        totalItems: job.total_items,
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
 * GET /api/update/status/:jobId
 * Получить статус задачи обновления
 */
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const job = await UpdateJobRepository.findById(jobId);
    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found',
      });
    }

    const progress = await UpdateJobRepository.getProgress(jobId);
    // Батч-прогресс
    const batchSize = 10;
    const totalBatches = Math.ceil((progress?.total || 0) / batchSize);
    const currentBatch = Math.ceil((progress?.processed || 0) / batchSize);

    res.json({
      status: 'success',
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: progress,
        batchProgress: {
          currentBatch,
          totalBatches,
          concurrentRequests: 5,
        },
        items: {
          created: job.items_created,
          updated: job.items_updated,
          skipped: job.items_skipped,
          failed: job.failed_items,
        },
        startedAt: job.started_at,
        completedAt: job.completed_at,
        durationMs: job.duration_ms,
        errorMessage: job.error_message,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/jobs
 * История задач обновления
 */
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as JobStatus | undefined;
    const type = req.query.type as JobType | undefined;

    const { items, total } = await UpdateJobRepository.findMany({
      limit,
      offset,
      status,
      type,
    });

    res.json({
      status: 'success',
      data: {
        jobs: items.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          itemsCreated: job.items_created,
          itemsUpdated: job.items_updated,
          itemsSkipped: job.items_skipped,
          failedItems: job.failed_items,
          durationMs: job.duration_ms,
          createdAt: job.created_at,
          completedAt: job.completed_at,
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
 * POST /api/update/cancel/:jobId
 * Отменить running задачу
 */
router.post('/cancel/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const runner = getUpdateRunner();
    const cancelled = await runner.cancel(jobId);

    if (!cancelled) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot cancel job. Job not found or not running.',
      });
    }

    res.json({
      status: 'success',
      data: {
        jobId,
        status: 'cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/update/retry/:jobId
 * Повторить failed задачу
 */
router.post('/retry/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id;

    const originalJob = await UpdateJobRepository.findById(jobId);
    if (!originalJob) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found',
      });
    }

    if (originalJob.status !== 'failed') {
      return res.status(400).json({
        status: 'error',
        error: 'Only failed jobs can be retried',
      });
    }

    // Получаем failed items
    const failedItems = await UpdateJobItemRepository.findFailed(jobId);
    if (failedItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No failed items to retry',
      });
    }

    // Запускаем новую задачу
    const runner = getUpdateRunner();
    const newJob = await runner.runManual({
      city: originalJob.city || undefined,
      categories: originalJob.categories || undefined,
      sources: originalJob.sources || undefined,
      triggeredBy: userId,
    });

    res.json({
      status: 'success',
      data: {
        jobId: newJob.id,
        originalJobId: jobId,
        status: newJob.status,
        retryItemsCount: failedItems.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ РАСПИСАНИЕМ
// ═══════════════════════════════════════════════════════

/**
 * GET /api/update/schedule
 * Получить текущее расписание
 */
router.get('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Получить из scheduler_config
    res.json({
      status: 'success',
      data: {
        enabled: true,
        cron: '0 3 * * *',
        timezone: 'Europe/Moscow',
        nextRun: null,
        lastRun: null,
        lastRunStatus: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/update/schedule
 * Обновить расписание (требует прав администратора)
 */
router.put('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    const input = updateScheduleSchema.parse(req.body);

    // TODO: Сохранить в scheduler_config

    res.json({
      status: 'success',
      data: {
        enabled: input.enabled,
        cron: input.cron,
        timezone: input.timezone,
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

// ═══════════════════════════════════════════════════════
// КАТАЛОГ ЦЕН
// ═══════════════════════════════════════════════════════

/**
 * GET /api/prices
 * Поиск в каталоге цен
 */
router.get('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    const city = req.query.city as string | undefined;
    const category = req.query.category as PriceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined;
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
 * GET /api/prices/:id
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
 * GET /api/prices/:id/history
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
 * POST /api/prices
 * Добавить цену вручную
 */
router.post('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней для manual
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
});

/**
 * PUT /api/prices/:id
 * Обновить цену вручную
 */
router.put('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
});

/**
 * DELETE /api/prices/:id
 * Удалить запись из каталога
 */
router.delete('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
});

/**
 * GET /api/prices/export
 * Экспорт каталога цен в CSV, XLSX или JSON
 */
router.get('/prices/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'json';
    const city = req.query.city as string | undefined;
    const category = req.query.category as PriceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;

    // Получаем все записи (без пагинации для экспорта)
    const { items } = await PriceCatalogRepository.search({
      city,
      category,
      sourceType,
      limit: 10000, // Максимум для экспорта
      sortBy: 'name',
      sortOrder: 'asc',
    });

    if (items.length === 0) {
      return res.status(404).json({
        status: 'error',
        error: 'No prices found for export',
      });
    }

    // Подготавливаем данные для экспорта
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

    // Формируем имя файла
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = `price_catalog_${timestamp}`;

    switch (format) {
      case 'csv': {
        // CSV экспорт
        const headers = ['name', 'category', 'unit', 'city', 'price_min', 'price_avg', 'price_max', 'currency', 'source_type', 'confidence_score', 'description', 'updated_at'];
        const csvRows = [
          headers.join(';'), // Заголовок с разделителем ;
          ...exportData.map(row => 
            headers.map(h => {
              const value = row[h as keyof typeof row];
              // Экранирование кавычек и обёртка в кавычки при наличии разделителя
              if (typeof value === 'string' && (value.includes(';') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return String(value);
            }).join(';')
          ),
        ];

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
        // Добавляем BOM для корректного отображения кириллицы в Excel
        res.send('\uFEFF' + csvRows.join('\n'));
        return;
      }

      case 'xlsx': {
        // XLSX экспорт с помощью exceljs
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Price Catalog');

        // Заголовки
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

        // Стилизация заголовков
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        // Добавляем данные
        worksheet.addRows(exportData);

        // Форматирование чисел
        worksheet.getColumn('price_min').numFmt = '#,##0.00';
        worksheet.getColumn('price_avg').numFmt = '#,##0.00';
        worksheet.getColumn('price_max').numFmt = '#,##0.00';
        worksheet.getColumn('confidence_score').numFmt = '0.00';

        // Отправляем файл
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      case 'json':
      default: {
        // JSON экспорт
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

/**
 * POST /api/prices/import
 * Импорт цен из файла (CSV, XLSX, JSON)
 */
router.post('/prices/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: 'No file uploaded',
      });
    }

    const file = req.file;
    const originalName = file.originalname.toLowerCase();
    const defaultCity = req.body.city as string || 'Москва';
    
    let importedItems: Array<{
      name: string;
      category: PriceCategory;
      unit: string;
      city: string;
      price_min?: number;
      price_avg?: number;
      price_max?: number;
      currency?: string;
      source_type?: SourceType;
      confidence_score?: number;
      description?: string;
    }> = [];

    // Определяем формат и парсим
    if (originalName.endsWith('.json')) {
      // JSON парсинг
      const content = file.buffer.toString('utf-8');
      const json = JSON.parse(content);
      
      // Поддерживаем разные форматы JSON
      const items = Array.isArray(json) ? json : (json.items || json.data || []);
      
      importedItems = items.map((item: any) => ({
        name: item.name || item.title || item.название,
        category: (item.category || item.type || 'material') as PriceCategory,
        unit: item.unit || 'м²',
        city: item.city || defaultCity,
        price_min: parseFloat(item.price_min || item.min || item.цена_мин) || undefined,
        price_avg: parseFloat(item.price_avg || item.avg || item.price || item.цена) || undefined,
        price_max: parseFloat(item.price_max || item.max || item.цена_макс) || undefined,
        currency: item.currency || 'RUB',
        source_type: 'manual' as SourceType,
        confidence_score: parseFloat(item.confidence_score || item.confidence) || 1,
        description: item.description || '',
      }));
    } else if (originalName.endsWith('.csv')) {
      // CSV парсинг
      const content = file.buffer.toString('utf-8');
      // Удаляем BOM если есть
      const cleanContent = content.replace(/^\uFEFF/, '');
      const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({
          status: 'error',
          error: 'CSV file must have header and at least one data row',
        });
      }

      // Парсим заголовок
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine);
      
      // Создаём маппинг колонок
      const columnMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().trim().replace(/['"]/g, '');
        columnMap[normalized] = i;
      });

      // Парсим данные
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;

        const getVal = (keys: string[]): string | undefined => {
          for (const key of keys) {
            const idx = columnMap[key];
            if (idx !== undefined && values[idx]) {
              return values[idx].replace(/['"]/g, '').trim();
            }
          }
          return undefined;
        };

        const name = getVal(['name', 'название', 'title']);
        if (!name) continue;

        importedItems.push({
          name,
          category: (getVal(['category', 'категория', 'type']) || 'material') as PriceCategory,
          unit: getVal(['unit', 'ед', 'единица']) || 'м²',
          city: getVal(['city', 'город']) || defaultCity,
          price_min: parseFloat(getVal(['price_min', 'цена_мин', 'min']) || '') || undefined,
          price_avg: parseFloat(getVal(['price_avg', 'цена', 'price', 'avg']) || '') || undefined,
          price_max: parseFloat(getVal(['price_max', 'цена_макс', 'max']) || '') || undefined,
          currency: getVal(['currency', 'валюта']) || 'RUB',
          source_type: 'manual' as SourceType,
          confidence_score: parseFloat(getVal(['confidence_score', 'confidence', 'доверие']) || '') || 1,
          description: getVal(['description', 'описание']) || '',
        });
      }
    } else if (originalName.endsWith('.xlsx')) {
      // XLSX парсинг с помощью exceljs
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return res.status(400).json({
          status: 'error',
          error: 'XLSX file has no worksheets',
        });
      }

      // Получаем заголовки из первой строки
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '').toLowerCase().trim();
      });

      // Создаём маппинг колонок
      const columnMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        columnMap[h] = i;
      });

      const getVal = (row: ExcelJS.Row, keys: string[]): string | undefined => {
        for (const key of keys) {
          const idx = columnMap[key];
          if (idx !== undefined) {
            const cell = row.getCell(idx + 1);
            if (cell.value !== undefined && cell.value !== null) {
              return String(cell.value);
            }
          }
        }
        return undefined;
      };

      // Читаем данные (начиная со 2-й строки)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const name = getVal(row, ['name', 'название', 'title']);
        if (!name) return;

        importedItems.push({
          name,
          category: (getVal(row, ['category', 'категория', 'type']) || 'material') as PriceCategory,
          unit: getVal(row, ['unit', 'ед', 'единица']) || 'м²',
          city: getVal(row, ['city', 'город']) || defaultCity,
          price_min: parseFloat(getVal(row, ['price_min', 'цена_мин', 'min']) || '') || undefined,
          price_avg: parseFloat(getVal(row, ['price_avg', 'цена', 'price', 'avg']) || '') || undefined,
          price_max: parseFloat(getVal(row, ['price_max', 'цена_макс', 'max']) || '') || undefined,
          currency: getVal(row, ['currency', 'валюта']) || 'RUB',
          source_type: 'manual' as SourceType,
          confidence_score: parseFloat(getVal(row, ['confidence_score', 'confidence', 'доверие']) || '') || 1,
          description: getVal(row, ['description', 'описание']) || '',
        });
      });
    } else {
      return res.status(400).json({
        status: 'error',
        error: 'Unsupported file format. Use CSV, XLSX, or JSON.',
      });
    }

    // Импортируем в базу
    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < importedItems.length; i++) {
      const item = importedItems[i];
      
      try {
        // Валидация обязательных полей
        if (!item.name || !item.category || !item.city) {
          skippedCount++;
          errors.push({ row: i + 1, error: 'Missing required fields (name, category, city)' });
          continue;
        }

        // Валидация категории
        if (!['work', 'material', 'tool'].includes(item.category)) {
          skippedCount++;
          errors.push({ row: i + 1, error: `Invalid category: ${item.category}. Must be work, material, or tool.` });
          continue;
        }

        // Создаём или обновляем запись
        await PriceCatalogRepository.upsert({
          name: item.name,
          category: item.category,
          unit: item.unit,
          city: item.city,
          price_min: item.price_min,
          price_avg: item.price_avg,
          price_max: item.price_max,
          currency: item.currency,
          source_type: item.source_type || 'manual',
          confidence_score: item.confidence_score || 1,
          description: item.description,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
        });
        
        importedCount++;
      } catch (error) {
        skippedCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ row: i + 1, error: errorMsg });
      }
    }

    res.json({
      status: 'success',
      data: {
        totalRows: importedItems.length,
        importedItems: importedCount,
        skippedItems: skippedCount,
        errors: errors.slice(0, 20), // Возвращаем первые 20 ошибок
        errorsCount: errors.length,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid JSON format',
      });
    }
    next(error);
  }
});

/**
 * Вспомогательная функция для парсинга CSV строки
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ';' || char === ',') && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// ═══════════════════════════════════════════════════════
// ВЕБХУКИ
// ═══════════════════════════════════════════════════════

const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum([
    'job.started',
    'job.completed',
    'job.failed',
    'job.cancelled',
    'job.anomaly_detected',
    'parser.circuit_open',
    'parser.circuit_closed',
  ])).min(1),
  secret: z.string().min(16).max(255),
  active: z.boolean().default(true),
  retry_count: z.number().min(0).max(10).default(3),
  retry_delay_ms: z.number().min(100).max(60000).default(5000),
  timeout_ms: z.number().min(1000).max(30000).default(5000),
});

const updateWebhookSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(z.enum([
    'job.started',
    'job.completed',
    'job.failed',
    'job.cancelled',
    'job.anomaly_detected',
    'parser.circuit_open',
    'parser.circuit_closed',
  ])).min(1).optional(),
  secret: z.string().min(16).max(255).optional(),
  active: z.boolean().optional(),
  retry_count: z.number().min(0).max(10).optional(),
  retry_delay_ms: z.number().min(100).max(60000).optional(),
  timeout_ms: z.number().min(1000).max(30000).optional(),
});

/**
 * GET /api/update/webhooks
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
 * POST /api/update/webhooks
 * Зарегистрировать вебхук
 */
router.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
 * GET /api/update/webhooks/:id
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
 * PUT /api/update/webhooks/:id
 * Обновить вебхук
 */
router.put('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
 * DELETE /api/update/webhooks/:id
 * Удалить вебхук
 */
router.delete('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
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
 * POST /api/update/webhooks/:id/test
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

    // Отправляем тестовый вебхук
    const { webhookService } = await import('../services/webhook.service.js');
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

// ═══════════════════════════════════════════════════════
// МОНИТОРИНГ
// ═══════════════════════════════════════════════════════

/**
 * GET /api/update/health
 * Health check службы обновлений
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [sources, catalogStats, jobStats] = await Promise.all([
      PriceSourceRepository.findActive(),
      PriceCatalogRepository.getStats(),
      UpdateJobRepository.getStats(),
    ]);

    const parsersHealth = sources.reduce((acc, source) => {
      acc[source.type] = {
        available: source.is_active && source.circuit_breaker_state !== 'open',
        circuitBreakerState: source.circuit_breaker_state,
        failures: source.circuit_breaker_failures,
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({
      status: 'ok',
      scheduler: {
        enabled: true,
        running: jobStats.byStatus.running > 0,
      },
      parsers: parsersHealth,
      catalog: {
        totalItems: catalogStats.total,
        staleItems: catalogStats.stale,
        itemsForReview: catalogStats.forReview,
        lastUpdated: catalogStats.lastUpdated,
      },
      jobs: {
        total: jobStats.total,
        running: jobStats.byStatus.running,
        pending: jobStats.byStatus.pending,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/metrics
 * Метрики производительности
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [jobStats, catalogStats, historyStats] = await Promise.all([
      UpdateJobRepository.getStats(),
      PriceCatalogRepository.getStats(),
      PriceHistoryRepository.getStats(),
    ]);

    res.json({
      status: 'success',
      data: {
        jobsTotal: jobStats.total,
        jobsCompleted: jobStats.byStatus.completed,
        jobsFailed: jobStats.byStatus.failed,
        jobsCancelled: jobStats.byStatus.cancelled,
        avgDurationMs: jobStats.avgDurationMs,
        lastRunAt: jobStats.lastRunAt,
        catalogTotal: catalogStats.total,
        catalogByCategory: catalogStats.byCategory,
        staleItems: catalogStats.stale,
        anomaliesDetected: historyStats.forReview,
        avgPriceChangePercent: historyStats.avgChangePercent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/logs/:jobId
 * Логи задачи
 */
router.get('/logs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const level = req.query.level as 'info' | 'debug' | 'warn' | 'error' | undefined;

    const logs = await UpdateLogRepository.findByJobId(jobId, level);

    res.json({
      status: 'success',
      data: {
        jobId,
        logs: logs.map(log => ({
          id: log.id,
          level: log.level,
          message: log.message,
          context: log.context,
          createdAt: log.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;