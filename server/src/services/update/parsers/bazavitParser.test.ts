/**
 * Тесты для парсера Bazavit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BazavitParser } from './bazavitParser';

// Моки для Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => ({
      newContext: vi.fn(() => ({
        newPage: vi.fn(() => ({
          goto: vi.fn(),
          waitForTimeout: vi.fn(),
          evaluate: vi.fn(),
          close: vi.fn(),
        })),
      })),
      contexts: vi.fn(),
      close: vi.fn(),
    })),
  },
}));

describe('BazavitParser', () => {
  let parser: BazavitParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new BazavitParser({
      maxCategories: 3,
      maxPagesPerCategory: 3,
      delayBetweenRequests: 0,
      delayBetweenPages: 0,
      headless: true,
    });
  });

  afterEach(async () => {
    await parser.close();
  });

  describe('Basic properties', () => {
    it('should have correct name', () => {
      expect(parser.name).toBe('Bazavit');
    });

    it('should have correct type', () => {
      expect(parser.type).toBe('web_scraper');
    });
  });

  describe('Rate limits', () => {
    it('should return correct rate limits', () => {
      const limits = parser.getRateLimit();

      expect(limits.requestsPerMinute).toBe(30);
      expect(limits.requestsPerDay).toBe(500);
      expect(limits.concurrentRequests).toBe(1);
    });
  });

  describe('Availability check', () => {
    it('should be available when browser is not initialized', async () => {
      const available = await parser.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Price extraction regex', () => {
    // Паттерн из парсера: /(\d+)/g (только цифры)
    const extractPrice = (text: string): number => {
      const cleanText = text.replace(/\s+/g, '');
      const match = cleanText.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    it('should extract simple price', () => {
      const text = '6690';
      expect(extractPrice(text)).toBe(6690);
    });

    it('should extract price with spaces', () => {
      const text = '6 690';
      expect(extractPrice(text)).toBe(6690);
    });

    it('should extract price with ruble symbol', () => {
      const text = '6 690 ₽';
      expect(extractPrice(text)).toBe(6690);
    });

    it('should extract price with kopecks', () => {
      const text = '5 704,60 ₽';
      expect(extractPrice(text)).toBe(5704);
    });

    it('should return 0 for no digits', () => {
      const text = 'Без цены';
      expect(extractPrice(text)).toBe(0);
    });

    it('should handle large prices', () => {
      const text = '148 951';
      expect(extractPrice(text)).toBe(148951);
    });
  });

  describe('URL parsing for category ID', () => {
    const extractCategoryId = (href: string): string | null => {
      try {
        const urlObj = new URL(href);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        return pathParts[pathParts.length - 1] || null;
      } catch {
        return null;
      }
    };

    it('should extract category ID from URL', () => {
      expect(extractCategoryId('https://bazavit.ru/catalog/sad')).toBe('sad');
      expect(extractCategoryId('https://bazavit.ru/catalog/instrumenty')).toBe('instrumenty');
    });

    it('should handle nested paths', () => {
      expect(extractCategoryId('https://bazavit.ru/catalog/sad/tools')).toBe('tools');
    });

    it('should return null for root URL', () => {
      expect(extractCategoryId('https://bazavit.ru/')).toBe(null);
    });
  });

  describe('Product ID extraction from URL', () => {
    const extractProductId = (href: string): string | null => {
      const idMatch = href.match(/-(\d+)\.prod\/?$/);
      return idMatch ? idMatch[1] : null;
    };

    it('should extract product ID from .prod URL', () => {
      expect(extractProductId('https://bazavit.ru/catalog/sad/nasos-83338207.prod/')).toBe('83338207');
      expect(extractProductId('https://bazavit.ru/catalog/sad/item-92585053.prod')).toBe('92585053');
    });

    it('should return null for URLs without .prod', () => {
      expect(extractProductId('https://bazavit.ru/catalog/sad')).toBe(null);
      expect(extractProductId('https://bazavit.ru/catalog/sad/no-id')).toBe(null);
    });
  });

  describe('Remove duplicates from categories', () => {
    const removeDuplicates = <T extends { href: string }>(items: T[]): T[] => {
      const uniqueItems: T[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        if (!seen.has(item.href)) {
          seen.add(item.href);
          uniqueItems.push(item);
        }
      }
      return uniqueItems;
    };

    it('should remove duplicate categories by href', () => {
      const categories = [
        { id: '1', name: 'Сад', href: 'https://bazavit.ru/catalog/sad' },
        { id: '1', name: 'Сад', href: 'https://bazavit.ru/catalog/sad' },
        { id: '2', name: 'Дом', href: 'https://bazavit.ru/catalog/dom' }
      ];

      const unique = removeDuplicates(categories);

      expect(unique).toHaveLength(2);
      expect(unique[0].id).toBe('1');
      expect(unique[1].id).toBe('2');
    });

    it('should preserve order', () => {
      const categories = [
        { id: 'a', name: 'A', href: 'https://bazavit.ru/catalog/a' },
        { id: 'b', name: 'B', href: 'https://bazavit.ru/catalog/b' },
        { id: 'a', name: 'A', href: 'https://bazavit.ru/catalog/a' },
        { id: 'c', name: 'C', href: 'https://bazavit.ru/catalog/c' }
      ];

      const unique = removeDuplicates(categories);

      expect(unique.map(c => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array for empty input', () => {
      expect(removeDuplicates([])).toHaveLength(0);
    });
  });

  describe('SQL Generation', () => {
    const escapeStr = (str: string | null | undefined): string => {
      return str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
    };

    const generateSqlInserts = (data: {
      categories: Array<{ id: string; name: string; href: string }>;
      products: Array<{ id: string; category_id: string; name: string; price: number; raw_price: string; url: string }>;
    }): string => {
      let sql = '';

      // Таблица категорий
      if (data.categories.length > 0) {
        sql += 'CREATE TABLE IF NOT EXISTS categories (\n';
        sql += '  id VARCHAR(255) PRIMARY KEY,\n';
        sql += '  name VARCHAR(255) NOT NULL,\n';
        sql += '  url VARCHAR(255)\n';
        sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n';

        sql += 'INSERT IGNORE INTO categories (id, name, url) VALUES\n';
        sql += data.categories.map(c => `(${escapeStr(c.id)}, ${escapeStr(c.name)}, ${escapeStr(c.href)})`).join(',\n') + ';\n\n';
      }

      // Таблица товаров
      if (data.products.length > 0) {
        sql += 'CREATE TABLE IF NOT EXISTS products (\n';
        sql += '  id VARCHAR(255) PRIMARY KEY,\n';
        sql += '  category_id VARCHAR(255),\n';
        sql += '  name VARCHAR(255) NOT NULL,\n';
        sql += '  price DECIMAL(10, 2),\n';
        sql += '  raw_price VARCHAR(255),\n';
        sql += '  url VARCHAR(255),\n';
        sql += '  FOREIGN KEY (category_id) REFERENCES categories(id)\n';
        sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n';

        sql += 'INSERT IGNORE INTO products (id, category_id, name, price, raw_price, url) VALUES\n';
        sql += data.products.map(p => `(${escapeStr(p.id)}, ${escapeStr(p.category_id)}, ${escapeStr(p.name)}, ${p.price}, ${escapeStr(p.raw_price)}, ${escapeStr(p.url)})`).join(',\n') + ';\n\n';
      }

      return sql;
    };

    it('should generate SQL for categories', () => {
      const data = {
        categories: [
          { id: 'sad', name: 'Сад', href: 'https://bazavit.ru/catalog/sad' }
        ],
        products: []
      };

      const sql = generateSqlInserts(data);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
      expect(sql).toContain("'sad'");
      expect(sql).toContain("'Сад'");
      expect(sql).toContain('INSERT IGNORE INTO categories');
    });

    it('should generate SQL for products', () => {
      const data = {
        categories: [],
        products: [
          { id: '83338207', category_id: 'sad', name: 'Насос погружной', price: 6690, raw_price: '6 690 ₽', url: 'https://bazavit.ru/catalog/sad/nasos-83338207.prod' }
        ]
      };

      const sql = generateSqlInserts(data);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(sql).toContain("'83338207'");
      expect(sql).toContain('6690');
      expect(sql).toContain('INSERT IGNORE INTO products');
    });

    it('should escape single quotes in strings', () => {
      const data = {
        categories: [
          { id: 'test', name: "O'Brien's Garden", href: 'https://bazavit.ru/catalog/test' }
        ],
        products: []
      };

      const sql = generateSqlInserts(data);

      expect(sql).toContain("O''Brien''s Garden");
    });

    it('should return empty string for empty data', () => {
      const sql = generateSqlInserts({ categories: [], products: [] });
      expect(sql).toBe('');
    });

    it('should handle multiple categories and products', () => {
      const data = {
        categories: [
          { id: 'sad', name: 'Сад', href: 'https://bazavit.ru/catalog/sad' },
          { id: 'dom', name: 'Дом', href: 'https://bazavit.ru/catalog/dom' }
        ],
        products: [
          { id: '1', category_id: 'sad', name: 'Товар 1', price: 100, raw_price: '100 ₽', url: 'https://bazavit.ru/1' },
          { id: '2', category_id: 'sad', name: 'Товар 2', price: 200, raw_price: '200 ₽', url: 'https://bazavit.ru/2' }
        ]
      };

      const sql = generateSqlInserts(data);

      expect(sql).toContain('Сад');
      expect(sql).toContain('Дом');
      expect(sql).toContain('Товар 1');
      expect(sql).toContain('Товар 2');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultParser = new BazavitParser();

      expect(defaultParser.name).toBe('Bazavit');
      expect(defaultParser.type).toBe('web_scraper');
    });

    it('should accept custom configuration', () => {
      const customParser = new BazavitParser({
        baseUrl: 'https://custom.bazavit.ru/catalog/',
        maxCategories: 10,
        maxPagesPerCategory: 5,
        delayBetweenRequests: 2000,
        headless: false,
      });

      expect(customParser).toBeDefined();
    });
  });
});
