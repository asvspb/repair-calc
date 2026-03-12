import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Парсер каталога bazavit.ru
 */
export async function parseBazavitCatalog(url = 'https://bazavit.ru/catalog/') {
  // Запускаем браузер в фоновом режиме
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const catalogData = {
    categories: [],
    products: []
  };
  
  try {
    console.log(`Открываем главную страницу каталога: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // 1. Собираем все категории с главной страницы каталога
    const categories = await page.evaluate(() => {
      const cats = [];
      const links = document.querySelectorAll('a');
      
      links.forEach(el => {
        const href = el.href;
        const text = el.innerText.trim().replace(/\n/g, ' ');
        
        // Отфильтровываем ссылки, которые ведут вглубь каталога
        if (href && href.includes('/catalog/') && text.length > 0 && !href.endsWith('.prod')) {
          if (href !== 'https://bazavit.ru/catalog/' && !href.includes('#')) {
            if (!cats.find(c => c.href === href)) {
              cats.push({
                id: href.split('/').filter(Boolean).pop(), // Последняя часть URL как ID
                name: text,
                href: href
              });
            }
          }
        }
      });
      return cats;
    });
    
    console.log(`Найдено категорий: ${categories.length}`);
    catalogData.categories = categories;
    
    // 2. Проходим по категориям
    // ВНИМАНИЕ: Для теста я оставил парсинг только первых 3 категорий. 
    // Для полного парсинга замените на: const categoriesToParse = categories;
    const categoriesToParse = categories.slice(0, 3);
    
    for (const category of categoriesToParse) {
      console.log(`Парсинг категории: ${category.name} (${category.href})`);
      
      let currentPageUrl = category.href;
      let hasNextPage = true;
      let pageNum = 1;
      
      // Идем по страницам пагинации
      while (hasNextPage) { 
        console.log(`  Страница ${pageNum}: ${currentPageUrl}`);
        await page.goto(currentPageUrl, { waitUntil: 'domcontentloaded' });
        
        // Извлекаем товары и ссылку на следующую страницу
        const pageData = await page.evaluate((categoryId) => {
          const items = [];
          const productElements = document.querySelectorAll('.catalog-item');
          
          productElements.forEach(el => {
            const nameEl = el.querySelector('.bx_catalog_item_title');
            const priceEl = el.querySelector('.bx_catalog_item_price');
            const linkEl = el.querySelector('a');
            
            if (nameEl && priceEl) {
              // Очищаем цену (оставляем только цифры)
              const priceText = priceEl.innerText.trim();
              const priceMatch = priceText.replace(/\s+/g, '').match(/(\d+)/);
              const price = priceMatch ? parseInt(priceMatch[1], 10) : 0;
              
              const href = linkEl ? linkEl.href : '';
              const id = href ? href.split('/').filter(Boolean).pop().replace('.prod', '') : Math.random().toString(36).substring(7);
              
              items.push({
                id: id,
                category_id: categoryId,
                name: nameEl.innerText.trim(),
                price: price,
                raw_price: priceText,
                url: href
              });
            }
          });
          
          // Ищем ссылку на следующую страницу (пагинация Битрикса)
          let nextUrl = null;
          const nextLink = document.querySelector('.modern-page-next, .bx-pag-next a, li.next a');
          if (nextLink && nextLink.href) {
            nextUrl = nextLink.href;
          }
          
          return { items, nextUrl };
        }, category.id);
        
        console.log(`    Найдено товаров: ${pageData.items.length}`);
        catalogData.products.push(...pageData.items);
        
        if (pageData.nextUrl) {
          currentPageUrl = pageData.nextUrl;
          pageNum++;
          // Пауза между страницами (защита от бана)
          await new Promise(r => setTimeout(r, 1000));
        } else {
          hasNextPage = false;
        }
      }
      
      // Небольшая пауза между категориями
      await new Promise(r => setTimeout(r, 1000));
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
}

// Запуск парсера, если скрипт вызван напрямую (например: node bazavit-parser.js)
if (process.argv[1] === __filename) {
  console.log('Запуск парсера bazavit.ru...');
  parseBazavitCatalog()
    .then(data => {
      console.log(`\nПарсинг завершен!`);
      console.log(`Всего категорий: ${data.categories.length}`);
      console.log(`Всего товаров: ${data.products.length}`);
      
      const sql = generateSqlInserts(data);
      fs.writeFileSync('bazavit_output.sql', sql);
      console.log('SQL-запросы успешно сохранены в файл bazavit_output.sql');
      
      // Также сохраняем JSON для следующего этапа
      fs.writeFileSync('bazavit_data.json', JSON.stringify(data, null, 2));
      console.log('Данные сохранены в файл bazavit_data.json');
    })
    .catch(err => {
      console.error('Ошибка парсинга:', err);
      process.exit(1);
    });
}