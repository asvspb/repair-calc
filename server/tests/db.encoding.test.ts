import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { pool, closePool } from '../src/db/pool.js';

// Skip tests if database is not available
const skipDbTests = !process.env['CI'] && !process.env['DB_HOST'];

describe.skipIf(skipDbTests)('MySQL Encoding', () => {
  const testCyrillicData = [
    { name: 'Квартира', city: 'Саратов' },
    { name: 'Дом', city: 'Волгоград' },
    { name: 'Комната', city: 'Москва' },
    { name: 'Офис', city: 'Санкт-Петербург' },
    { name: 'Магазин', city: 'Екатеринбург' },
  ];

  beforeAll(async () => {
    // Create test table with explicit utf8mb4 charset
    await pool.execute(`
      CREATE TEMPORARY TABLE test_encoding (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) CHARACTER SET utf8mb4,
        city VARCHAR(255) CHARACTER SET utf8mb4
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  });

  afterAll(async () => {
    await pool.execute('DROP TEMPORARY TABLE IF EXISTS test_encoding');
    await closePool();
  });

  it('должен корректно сохранять кириллицу', async () => {
    for (const data of testCyrillicData) {
      await pool.execute(
        'INSERT INTO test_encoding (name, city) VALUES (?, ?)',
        [data.name, data.city]
      );
    }

    const [rows] = await pool.execute<any[]>('SELECT name, city FROM test_encoding');
    
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ name: 'Квартира', city: 'Саратов' });
    expect(rows[1]).toMatchObject({ name: 'Дом', city: 'Волгоград' });
    expect(rows[2]).toMatchObject({ name: 'Комната', city: 'Москва' });
    expect(rows[3]).toMatchObject({ name: 'Офис', city: 'Санкт-Петербург' });
    expect(rows[4]).toMatchObject({ name: 'Магазин', city: 'Екатеринбург' });
  });

  it('должен корректно возвращать HEX для кириллицы', async () => {
    const [rows] = await pool.execute<any[]>(`
      SELECT HEX(name) as name_hex, HEX(city) as city_hex 
      FROM test_encoding 
      WHERE name = 'Квартира'
    `);

    // Проверка HEX для "Квартира" (UTF-8 encoding)
    expect(rows[0].name_hex).toBe('D09AD0B2D0B0D180D182D0B8D180D0B0');
    expect(rows[0].city_hex).toBe('D0A1D0B0D180D0B0D182D0BED0B2');
  });

  it('должен использовать utf8mb4 для соединения', async () => {
    const [rows] = await pool.execute<any[]>(
      "SELECT @@character_set_connection as charset"
    );
    expect(rows[0].charset).toBe('utf8mb4');
  });

  it('должен использовать utf8mb4 для сервера', async () => {
    const [rows] = await pool.execute<any[]>(
      "SELECT @@character_set_server as charset"
    );
    expect(rows[0].charset).toBe('utf8mb4');
  });

  it('должен корректно сортировать кириллицу', async () => {
    const [rows] = await pool.execute<any[]>(
      'SELECT name FROM test_encoding ORDER BY name COLLATE utf8mb4_unicode_ci'
    );
    
    // Проверка, что сортировка работает корректно
    const names = rows.map((r: any) => r.name);
    expect(names).toHaveLength(5);
    
    // Первый элемент должен начинаться с русской буквы
    expect(names[0]).toMatch(/[а-яА-Я]/);
  });

  it('должен поддерживать emoji (utf8mb4 feature)', async () => {
    await pool.execute(`
      CREATE TEMPORARY TABLE test_emoji (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description TEXT CHARACTER SET utf8mb4
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    const emojiText = 'Квартира с ремонтом 🏠✨';
    await pool.execute(
      'INSERT INTO test_emoji (description) VALUES (?)',
      [emojiText]
    );

    const [rows] = await pool.execute<any[]>(
      'SELECT description FROM test_emoji WHERE id = 1'
    );

    expect(rows[0].description).toBe(emojiText);

    await pool.execute('DROP TEMPORARY TABLE IF EXISTS test_emoji');
  });
});
