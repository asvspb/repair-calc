/**
 * Парсер каталога Lemana PRO (бывший Леруа Мерлен)
 * 
 * Особенности:
 * - Сайт использует SPA-архитектуру и защиту от ботов (Qrator)
 * - Использует Playwright с подменой User-Agent для эмуляции реального пользователя
 * - Поиск товаров по data-атрибутам ([data-qa="product"])
 * - Извлечение цен через Regex (формат: "5 704, 60 ₽")
 * 
 * @package server/src/services/update/parsers
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { PriceParser, PriceRequest, PriceResult, RateLimit, CatalogData } from './types';
import { ParserError } from './types';

/**
 * Конфигурация парсера Lemana
 */
export interface LemanaParserConfig {
  baseUrl: string;
  maxCategories?: number;        // Максимум категорий для парсинга (0 = все)
  maxPagesPerCategory?: number;  // Максимум страниц в категории (0 = все)
  delayBetweenRequests?: number; // Задержка между запросами (мс)
  delayBetweenPages?: number;    // Задержка между страницами (мс)
  userAgent?: string;
  headless?: boolean;
}

const DEFAULT_CONFIG: LemanaParserConfig = {
  baseUrl: 'https://volgograd.lemanapro.ru/catalogue/',
  maxCategories: 3,
  maxPagesPerCategory: 3,
  delayBetweenRequests: 1000,
  delayBetweenPages: 1000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headless: true,
};

/**
 * Парсер Lemana PRO
 */
export class LemanaParser implements PriceParser {
  name = 'Lemana PRO';
  type = 'web_scraper';

  private config: LemanaParserConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: Partial<LemanaParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Проверка доступности парсера
   */
  async isAvailable(): Promise<boolean> {
    // Проверяем, что браузер ещё не запущен или работает корректно
    if (!this.browser) {
      return true;
    }
    try {
      await this.browser.contexts();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получение ограничений (Rate Limit)
   */
  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 30,
      requestsPerDay: 500,
      concurrentRequests: 1,
    };
  }

  /**
   * Поиск цены на конкретный товар
   */
  async fetch(request: PriceRequest): Promise<PriceResult> {
    await this.ensureBrowser();

    if (!this.page) {
      throw new ParserError('Browser page not initialized', true);
    }

    try {
      // Поиск товара на сайте
      const searchUrl = `${this.config.baseUrl}?search=${encodeURIComponent(request.itemName)}`;
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      // Извлечение цен со страницы результатов
      const prices = await this.page.evaluate(() => {
        const priceElements = document.querySelectorAll('[data-qa="product"] .bx_catalog_item_price');
        const prices: number[] = [];

        priceElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          // Очищаем цену: "5 704, 60 ₽" -> 5704.60
          const match = text.replace(/\s+/g, '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
          if (match) {
            prices.push(parseFloat(match[1]));
          }
        });

        return prices;
      });

      if (prices.length === 0) {
        throw new ParserError(`No prices found for "${request.itemName}"`, false);
      }

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      return {
        prices: {
          min: minPrice,
          avg: avgPrice,
          max: maxPrice,
          currency: 'RUB',
        },
        sources: ['lemanapro.ru'],
        confidenceScore: Math.min(0.9, 0.5 + (prices.length * 0.05)),
        raw: { prices, searchTerm: request.itemName },
      };
    } catch (error) {
      if (error instanceof ParserError) {
        throw error;
      }
      throw new ParserError(`Failed to fetch price: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    }
  }

  /**
   * Парсинг всего каталога
   */
  async parseCatalog(url?: string): Promise<CatalogData> {
    await this.ensureBrowser();

    if (!this.page) {
      throw new ParserError('Browser page not initialized', true);
    }

    const catalogData: CatalogData = {
      categories: [],
      products: [],
    };

    try {
      const baseUrl = url || this.config.baseUrl;
      console.log(`Открываем главную страницу каталога: ${baseUrl}`);
      await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(5000);

      // 1. Собираем все категории
      const categories = await this.extractCategories();
      console.log(`Найдено категорий: ${categories.length}`);

      const categoriesToParse = this.config.maxCategories && this.config.maxCategories > 0
        ? categories.slice(0, this.config.maxCategories)
        : categories;

      catalogData.categories = categories;

      // 2. Проходим по категориям
      for (const category of categoriesToParse) {
        console.log(`Парсинг категории: ${category.name} (${category.href})`);
        await this.parseCategory(category, catalogData);
      }

      return catalogData;
    } catch (error) {
      throw new ParserError(`Catalog parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    }
  }

  /**
   * Извлечение категорий со страницы
   */
  private async extractCategories() {
    if (!this.page) {
      throw new ParserError('Page not initialized', false);
    }

    const categories = await this.page.evaluate(() => {
      const items: Array<{ id: string; name: string; href: string }> = [];
      const links = document.querySelectorAll('a');

      links.forEach(el => {
        const href = el.href;
        if (href && href.includes('/catalogue/') && el.innerText.trim().length > 0) {
          try {
            const urlObj = new URL(href);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            if (pathParts.length >= 2 && pathParts[0] === 'catalogue') {
              items.push({
                id: pathParts[1],
                name: el.innerText.trim().replace(/\n/g, ' '),
                href: href,
              });
            }
          } catch {
            // Игнорируем невалидные URL
          }
        }
      });

      // Убираем дубликаты
      const uniqueItems: typeof items = [];
      const seen = new Set<string>();
      for (const item of items) {
        if (!seen.has(item.href)) {
          seen.add(item.href);
          uniqueItems.push(item);
        }
      }

      return uniqueItems;
    });

    return categories;
  }

  /**
   * Парсинг категории
   */
  private async parseCategory(category: { id: string; href: string }, catalogData: CatalogData) {
    if (!this.page) {
      throw new ParserError('Page not initialized', false);
    }

    let currentPageUrl = category.href;
    let hasNextPage = true;
    let pageNum = 1;
    const maxPages = this.config.maxPagesPerCategory && this.config.maxPagesPerCategory > 0
      ? this.config.maxPagesPerCategory
      : Infinity;

    while (hasNextPage && pageNum <= maxPages) {
      console.log(`  Страница ${pageNum}: ${currentPageUrl}`);
      await this.page.goto(currentPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const pageData = await this.page.evaluate((categoryId: string) => {
        const items: Array<{
          id: string;
          category_id: string;
          name: string;
          price: number;
          rawPrice: string;
          url: string;
        }> = [];

        const productElements = document.querySelectorAll('[data-qa="product"]');

        productElements.forEach(el => {
          const nameEl = el.querySelector('.bx_catalog_item_title');
          const priceEl = el.querySelector('.bx_catalog_item_price');
          const linkEl = el.querySelector('a');

          if (nameEl && priceEl) {
            const priceText = priceEl.textContent?.trim() || '';
            // Очищаем цену: "5 704, 60 ₽" -> 5704.60
            const cleanPrice = priceText.replace(/\s+/g, '').replace(',', '.').replace('₽', '');
            const priceMatch = cleanPrice.match(/(\d+(?:\.\d+)?)/);
            const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

            const href = linkEl ? linkEl.href : '';
            const id = href ? href.split('/').filter(Boolean).pop()?.replace('.prod', '') || Math.random().toString(36).substring(7) : Math.random().toString(36).substring(7);

            items.push({
              id,
              category_id: categoryId,
              name: nameEl.textContent?.trim() || '',
              price,
              rawPrice: priceText,
              url: href,
            });
          }
        });

        // Ищем ссылку на следующую страницу
        const nextLink = document.querySelector('.modern-page-next a, .bx-pag-next a, li.next a');
        const nextUrl = nextLink && nextLink.getAttribute('href');

        return { items, nextUrl };
      }, category.id);

      console.log(`    Найдено товаров: ${pageData.items.length}`);

      // Добавляем товары в каталог
      catalogData.products.push(...pageData.items.map(item => ({
        id: item.id,
        categoryId: item.category_id,
        name: item.name,
        price: item.price,
        rawPrice: item.rawPrice,
        url: item.url,
      })));

      if (pageData.nextUrl) {
        currentPageUrl = pageData.nextUrl;
        pageNum++;
        await this.delay(this.config.delayBetweenPages);
      } else {
        hasNextPage = false;
      }
    }

    await this.delay(this.config.delayBetweenRequests);
  }

  /**
   * Инициализация браузера
   */
  private async ensureBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: this.config.headless });
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
    }

    if (!this.page) {
      this.page = await this.context.newPage();
    }
  }

  /**
   * Задержка с учётом rate limiting
   */
  private async delay(ms: number) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < ms) {
      await new Promise(resolve => setTimeout(resolve, ms - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Очистка ресурсов
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
