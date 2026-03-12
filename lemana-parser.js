import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Парсер каталога lemanapro.ru (бывший Леруа Мерлен)
 * 
 * Особенности:
 * - Сайт использует SPA-архитектуру и защиту от ботов (Qrator)
 * - Использует Playwright с подменой User-Agent для эмуляции реального пользователя
 * - Поиск товаров по data-атрибутам ([data-qa="product"])
 * - Извлечение цен через Regex (формат: "5 704, 60 ₽")
 */
export async function parseLemanaCatalog(url = 'https://volgograd.lemanapro.ru/catalogue/') {
  // Запускаем браузер в фоновом режиме, маскируясь под обычного пользователя
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });
  
  const page = await context.newPage();
  
  const catalogData = {
    categories: [],
    products: []
  };
  
  try {
    console.log(`Открываем главную страницу каталога: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Ждем загрузки динамического контента
    await page.waitForTimeout(5000);
    
    // 1. Собираем все категории
    const categories = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a');
      
      links.forEach(el => {
        const href = el.href;
        if (href && href.includes('/catalogue/') && el.innerText.trim().length > 0) {
          const urlObj = new URL(href);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          
          // Категории обычно имеют 2 части в пути: catalogue и category_name
          // Исключаем ссылки на главную страницу каталога
          if (pathParts.length >= 2 && pathParts[0] === 'catalogue') {
            items.push({
              id: pathParts[1],
              name: el.innerText.trim().replace(/\n/g, ' '),
              href: href
            });
          }
        }
      });
      
      // Убираем дубликаты
      const uniqueItems = [];
      const seen = new Set();
      for (const item of items) {
        if (!seen.has(item.href)) {
          seen.add(item.href);
          uniqueItems.push(item);
        }
      }
      
      return uniqueItems;
    });
    
    console.log(`Найдено категорий: ${categories.length}`);
    catalogData.categories = categories;
    
    // 2. Проходим по первым 3 категориям для демонстрации
    // ВНИМАНИЕ: Для полного парсинга замените на: const categoriesToParse = categories;
    const categoriesToParse = categories.slice(0, 3);
    
    for (const category of categoriesToParse) {
      console.log(`Парсинг категории: ${category.name} (${category.href})`);
      
      let currentPageUrl = category.href;
      let hasNextPage = true;
      let pageNum = 1;
      
      // Ограничение в 3 страницы для теста
      while (hasNextPage && pageNum <= 3) { 
        console.log(`  Страница ${pageNum}: ${currentPageUrl}`);
        await page.goto(currentPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000); // Ждем подгрузки товаров
        
        // Извлекаем товары и ссылку на следующую страницу
        const pageData = await page.evaluate((categoryId) => {
          const items = [];
          const productElements = document.querySelectorAll('[data-qa="product"]');
          
          productElements.forEach(el => {
            const nameEl = el.querySelector('[data-qa="product-name"]');
            const linkEl = el.querySelector('a');
            
            if (nameEl && linkEl) {
              let price = 0;
              let rawPrice = '';
              const text = el.innerText.replace(/\n/g, ' ');
              
              // Ищем все вхождения цены (например "5 704, 60 ₽" или "25 090 ₽")
              const priceMatches = text.match(/(\d[\d\s]*)(?:,\s*\d+)?\s*₽/g);
              if (priceMatches && priceMatches.length > 0) {
                // Берем последнюю цену (обычно это текущая цена со скидкой)
                rawPrice = priceMatches[priceMatches.length - 1];
                const cleanPrice = rawPrice.replace(/\s+/g, '').replace(',', '.').replace('₽', '');
                price = parseFloat(cleanPrice);
              }
              
              const href = linkEl.href;
              const idMatch = href.match(/-(\d+)\/?$/);
              const id = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);
              
              items.push({
                id: id,
                category_id: categoryId,
                name: nameEl.innerText.trim(),
                price: price,
                raw_price: rawPrice.trim(),
                url: href
              });
            }
          });
          
          // Ищем ссылку на следующую страницу
          let nextUrl = null;
          const nextLink = document.querySelector('[data-qa="pagination-next"]');
          if (nextLink && nextLink.href) {
            nextUrl = nextLink.href;
          } else {
            // Альтернативный поиск пагинации
            const allLinks = Array.from(document.querySelectorAll('a'));
            const nextBtn = allLinks.find(a => a.innerText.trim().toLowerCase() === 'следующая' || a.getAttribute('aria-label') === 'Следующая страница');
            if (nextBtn && nextBtn.href) {
              nextUrl = nextBtn.href;
            }
          }
          
          return { items, nextUrl };
        }, category.id);
        
        console.log(`    Найдено товаров: ${pageData.items.length}`);
        catalogData.products.push(...pageData.items);
        
        if (pageData.nextUrl) {
          currentPageUrl = pageData.nextUrl;
          pageNum++;
          await page.waitForTimeout(2000); // Защита от бана
        } else {
          hasNextPage = false;
        }
      }
      
      await page.waitForTimeout(2000);
    }
    
    return catalogData;
  } finally {
    await browser.close();
  }
}

/**
 * Генерация SQL-запросов для MySQL
 */
export function generateSqlInserts(data) {
  let sql = '';
  const escapeStr = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
  
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
}

// Запуск парсера
if (process.argv[1] === __filename) {
  console.log('Запуск парсера lemanapro.ru...');
  parseLemanaCatalog()
    .then(data => {
      console.log(`\nПарсинг завершен!`);
      console.log(`Всего категорий: ${data.categories.length}`);
      console.log(`Всего товаров: ${data.products.length}`);
      
      const sql = generateSqlInserts(data);
      fs.writeFileSync('lemana_output.sql', sql);
      console.log('SQL-запросы успешно сохранены в файл lemana_output.sql');
      
      // Также сохраняем JSON для анализа
      fs.writeFileSync('lemana_data.json', JSON.stringify(data, null, 2));
      console.log('Данные сохранены в файл lemana_data.json');
    })
    .catch(err => {
      console.error('Ошибка парсинга:', err);
      process.exit(1);
    });
}