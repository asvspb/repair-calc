import { describe, it, expect } from 'vitest';

/**
 * Тесты для парсера Lemana PRO
 * 
 * Примечание: parseLemanaCatalog() требует Playwright и реальный браузер,
 * поэтому тестируем только утилитарные функции и regex-паттерны.
 */

// ---------------------------------------------------------------------------
// Regex паттерны для извлечения цен
// ---------------------------------------------------------------------------

describe('Price extraction regex', () => {
  // Паттерн из парсера: /(\d[\d\s]*)(?:,\s*\d+)?\s*₽/g
  const priceRegex = /(\d[\d\s]*)(?:,\s*\d+)?\s*₽/g;

  const extractPrices = (text: string): string[] => {
    const matches = text.match(priceRegex);
    return matches || [];
  };

  const parsePrice = (rawPrice: string): number => {
    const cleanPrice = rawPrice.replace(/\s+/g, '').replace(',', '.').replace('₽', '');
    return parseFloat(cleanPrice);
  };

  describe('extractPrices', () => {
    it('should extract simple price', () => {
      const text = 'Насос погружной 6 690 ₽';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe('6 690 ₽');
    });

    it('should extract price with kopecks', () => {
      const text = 'Товар 5 704, 60 ₽ со скидкой';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe('5 704, 60 ₽');
    });

    it('should extract multiple prices', () => {
      const text = 'Старая цена: 10 000 ₽ Новая цена: 7 500 ₽';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(2);
      expect(prices[0]).toBe('10 000 ₽');
      expect(prices[1]).toBe('7 500 ₽');
    });

    it('should handle price without spaces', () => {
      const text = 'Товар 500₽';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe('500₽');
    });

    it('should return empty array for no prices', () => {
      const text = 'Товар без цены';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(0);
    });

    it('should handle large prices', () => {
      const text = 'Снегоуборщик 148 951 ₽';
      const prices = extractPrices(text);
      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe('148 951 ₽');
    });
  });

  describe('parsePrice', () => {
    it('should parse simple price', () => {
      expect(parsePrice('6 690 ₽')).toBe(6690);
    });

    it('should parse price with kopecks', () => {
      expect(parsePrice('5 704, 60 ₽')).toBe(5704.60);
    });

    it('should parse price without spaces', () => {
      expect(parsePrice('500₽')).toBe(500);
    });

    it('should parse large price', () => {
      expect(parsePrice('148 951 ₽')).toBe(148951);
    });

    it('should parse price with comma decimal', () => {
      expect(parsePrice('1 234,50 ₽')).toBe(1234.50);
    });
  });
});

// ---------------------------------------------------------------------------
// SQL Generation
// ---------------------------------------------------------------------------

describe('generateSqlInserts', () => {
  // Воссоздаём функцию из парсера
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
      sql += 'CREATE TABLE IF NOT EXISTS lemana_categories (\n';
      sql += '  id VARCHAR(255) PRIMARY KEY,\n';
      sql += '  name VARCHAR(255) NOT NULL,\n';
      sql += '  url VARCHAR(255)\n';
      sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n';
      
      sql += 'INSERT IGNORE INTO lemana_categories (id, name, url) VALUES\n';
      sql += data.categories.map(c => `(${escapeStr(c.id)}, ${escapeStr(c.name)}, ${escapeStr(c.href)})`).join(',\n') + ';\n\n';
    }
    
    // Таблица товаров
    if (data.products.length > 0) {
      sql += 'CREATE TABLE IF NOT EXISTS lemana_products (\n';
      sql += '  id VARCHAR(255) PRIMARY KEY,\n';
      sql += '  category_id VARCHAR(255),\n';
      sql += '  name VARCHAR(255) NOT NULL,\n';
      sql += '  price DECIMAL(10, 2),\n';
      sql += '  raw_price VARCHAR(255),\n';
      sql += '  url VARCHAR(255),\n';
      sql += '  FOREIGN KEY (category_id) REFERENCES lemana_categories(id)\n';
      sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n';
      
      sql += 'INSERT IGNORE INTO lemana_products (id, category_id, name, price, raw_price, url) VALUES\n';
      sql += data.products.map(p => `(${escapeStr(p.id)}, ${escapeStr(p.category_id)}, ${escapeStr(p.name)}, ${p.price}, ${escapeStr(p.raw_price)}, ${escapeStr(p.url)})`).join(',\n') + ';\n\n';
    }
    
    return sql;
  };

  it('should generate SQL for categories', () => {
    const data = {
      categories: [
        { id: 'sad', name: 'Сад', href: 'https://volgograd.lemanapro.ru/catalogue/sad' }
      ],
      products: []
    };

    const sql = generateSqlInserts(data);
    
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS lemana_categories');
    expect(sql).toContain("'sad'");
    expect(sql).toContain("'Сад'");
    expect(sql).toContain('INSERT IGNORE INTO lemana_categories');
  });

  it('should generate SQL for products', () => {
    const data = {
      categories: [],
      products: [
        { id: '83338207', category_id: 'sad', name: 'Насос погружной', price: 6690, raw_price: '6 690 ₽', url: 'https://volgograd.lemanapro.ru/product/nasos-83338207/' }
      ]
    };

    const sql = generateSqlInserts(data);
    
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS lemana_products');
    expect(sql).toContain("'83338207'");
    expect(sql).toContain('6690');
    expect(sql).toContain('INSERT IGNORE INTO lemana_products');
  });

  it('should escape single quotes in strings', () => {
    const data = {
      categories: [
        { id: 'test', name: "O'Brien's Garden", href: 'https://example.com' }
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
        { id: 'sad', name: 'Сад', href: 'https://example.com/sad' },
        { id: 'instrumenty', name: 'Инструменты', href: 'https://example.com/instrumenty' }
      ],
      products: [
        { id: '1', category_id: 'sad', name: 'Товар 1', price: 100, raw_price: '100 ₽', url: 'https://example.com/1' },
        { id: '2', category_id: 'sad', name: 'Товар 2', price: 200, raw_price: '200 ₽', url: 'https://example.com/2' }
      ]
    };

    const sql = generateSqlInserts(data);
    
    expect(sql).toContain('Сад');
    expect(sql).toContain('Инструменты');
    expect(sql).toContain('Товар 1');
    expect(sql).toContain('Товар 2');
  });
});

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

describe('URL parsing for category ID', () => {
  const extractCategoryId = (href: string): string | null => {
    const urlObj = new URL(href);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 2 && pathParts[0] === 'catalogue') {
      return pathParts[1];
    }
    return null;
  };

  it('should extract category ID from URL', () => {
    expect(extractCategoryId('https://volgograd.lemanapro.ru/catalogue/sad')).toBe('sad');
    expect(extractCategoryId('https://volgograd.lemanapro.ru/catalogue/instrumenty')).toBe('instrumenty');
  });

  it('should return null for non-catalogue URLs', () => {
    expect(extractCategoryId('https://volgograd.lemanapro.ru/product/test')).toBe(null);
    expect(extractCategoryId('https://volgograd.lemanapro.ru/')).toBe(null);
  });

  it('should handle nested paths', () => {
    expect(extractCategoryId('https://volgograd.lemanapro.ru/catalogue/sad/nested')).toBe('sad');
  });
});

// ---------------------------------------------------------------------------
// Product ID extraction
// ---------------------------------------------------------------------------

describe('Product ID extraction from URL', () => {
  const extractProductId = (href: string): string | null => {
    const idMatch = href.match(/-(\d+)\/?$/);
    return idMatch ? idMatch[1] : null;
  };

  it('should extract product ID from URL', () => {
    expect(extractProductId('https://volgograd.lemanapro.ru/product/nasos-pogruzhnoy-makita-pf0410-83338207/')).toBe('83338207');
    expect(extractProductId('https://volgograd.lemanapro.ru/product/snegouborshchik-92585053')).toBe('92585053');
  });

  it('should return null for URLs without product ID', () => {
    expect(extractProductId('https://volgograd.lemanapro.ru/catalogue/sad')).toBe(null);
    expect(extractProductId('https://volgograd.lemanapro.ru/product/no-id')).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Duplicate removal
// ---------------------------------------------------------------------------

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
      { id: '1', name: 'Сад', href: 'https://example.com/sad' },
      { id: '1', name: 'Сад', href: 'https://example.com/sad' },
      { id: '2', name: 'Дом', href: 'https://example.com/dom' }
    ];

    const unique = removeDuplicates(categories);
    
    expect(unique).toHaveLength(2);
    expect(unique[0].id).toBe('1');
    expect(unique[1].id).toBe('2');
  });

  it('should preserve order', () => {
    const categories = [
      { id: 'a', name: 'A', href: 'https://a.com' },
      { id: 'b', name: 'B', href: 'https://b.com' },
      { id: 'a', name: 'A', href: 'https://a.com' },
      { id: 'c', name: 'C', href: 'https://c.com' }
    ];

    const unique = removeDuplicates(categories);
    
    expect(unique.map(c => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('should return empty array for empty input', () => {
    expect(removeDuplicates([])).toHaveLength(0);
  });
});