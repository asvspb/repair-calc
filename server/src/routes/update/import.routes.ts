import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import {
  PriceCatalogRepository,
  type PriceCategory,
  type SourceType,
} from '../../db/repositories/priceCatalog.repo.js';

import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';

export const router = Router();
router.use(authenticate, adminGuard);

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

/**
 * POST /prices/import
 * Импорт цен из файла (CSV, XLSX, JSON)
 */
router.post(
  '/prices/import',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          error: 'No file uploaded',
        });
      }

      const file = req.file;
      const originalName = file.originalname.toLowerCase();
      const defaultCity = (req.body.city as string) || 'Москва';

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

      if (originalName.endsWith('.json')) {
        const content = file.buffer.toString('utf-8');
        const json = JSON.parse(content);

        const items = Array.isArray(json) ? json : json.items || json.data || [];

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
        const content = file.buffer.toString('utf-8');
        const cleanContent = content.replace(/^\uFEFF/, '');
        const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          return res.status(400).json({
            status: 'error',
            error: 'CSV file must have header and at least one data row',
          });
        }

        const headerLine = lines[0];
        const headers = parseCSVLine(headerLine);

        const columnMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          const normalized = h.toLowerCase().trim().replace(/['"]/g, '');
          columnMap[normalized] = i;
        });

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
            confidence_score:
              parseFloat(getVal(['confidence_score', 'confidence', 'доверие']) || '') || 1,
            description: getVal(['description', 'описание']) || '',
          });
        }
      } else if (originalName.endsWith('.xlsx')) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return res.status(400).json({
            status: 'error',
            error: 'XLSX file has no worksheets',
          });
        }

        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value || '')
            .toLowerCase()
            .trim();
        });

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

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;

          const name = getVal(row, ['name', 'название', 'title']);
          if (!name) return;

          importedItems.push({
            name,
            category: (getVal(row, ['category', 'категория', 'type']) ||
              'material') as PriceCategory,
            unit: getVal(row, ['unit', 'ед', 'единица']) || 'м²',
            city: getVal(row, ['city', 'город']) || defaultCity,
            price_min: parseFloat(getVal(row, ['price_min', 'цена_мин', 'min']) || '') || undefined,
            price_avg:
              parseFloat(getVal(row, ['price_avg', 'цена', 'price', 'avg']) || '') || undefined,
            price_max:
              parseFloat(getVal(row, ['price_max', 'цена_макс', 'max']) || '') || undefined,
            currency: getVal(row, ['currency', 'валюта']) || 'RUB',
            source_type: 'manual' as SourceType,
            confidence_score:
              parseFloat(getVal(row, ['confidence_score', 'confidence', 'доверие']) || '') || 1,
            description: getVal(row, ['description', 'описание']) || '',
          });
        });
      } else {
        return res.status(400).json({
          status: 'error',
          error: 'Unsupported file format. Use CSV, XLSX, or JSON.',
        });
      }

      let importedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < importedItems.length; i++) {
        const item = importedItems[i];

        try {
          if (!item.name || !item.category || !item.city) {
            skippedCount++;
            errors.push({ row: i + 1, error: 'Missing required fields (name, category, city)' });
            continue;
          }

          if (!['work', 'material', 'tool'].includes(item.category)) {
            skippedCount++;
            errors.push({
              row: i + 1,
              error: `Invalid category: ${item.category}. Must be work, material, or tool.`,
            });
            continue;
          }

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
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
          errors: errors.slice(0, 20),
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
  },
);
