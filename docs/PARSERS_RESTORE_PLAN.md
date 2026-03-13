# План восстановления и интеграции парсеров

**Дата:** 2026-03-13
**Версия:** 1.0
**Статус:** В работе

---

## 📋 Обзор

Этот документ описывает план восстановления парсеров из git-истории и их интеграцию в архитектуру UPDATE_SERVICE.

### Исходные парсеры

| Парсер | Коммит добавления | Коммит удаления | Статус |
|--------|-------------------|-----------------|--------|
| **Bazavit** | `f511f92` | `609a37a` | ✅ Восстановлен |
| **Lemana PRO** | `d0b7ad9` | `609a37a` | ✅ Восстановлен |
| **Gemini AI** | - | - | ✅ Активен |
| **Mistral AI** | `f69a561` | - | ✅ Активен |

---

## ✅ Выполненные задачи

### 1. Восстановление парсеров из git

**Задача:** Восстановить код парсеров из git-истории

**Результат:**
- ✅ `bazavit-parser.js` → `server/src/services/update/parsers/bazavitParser.ts`
- ✅ `lemana-parser.js` → `server/src/services/update/parsers/lemanaParser.ts`

**Изменения:**
- Конвертация из JavaScript в TypeScript
- Адаптация под интерфейс `PriceParser`
- Добавлена поддержка Circuit Breaker
- Добавлена поддержка Rate Limiter

---

### 2. Создание структуры директорий

**Задача:** Создать директорию для парсеров в серверной части

**Результат:**
```
server/src/services/update/parsers/
├── index.ts              # Экспорты
├── types.ts              # Интерфейсы и типы
├── circuitBreaker.ts     # Circuit Breaker паттерн
├── rateLimiter.ts        # Rate Limiting
├── lemanaParser.ts       # Lemana PRO parser ✅
├── bazavitParser.ts      # Bazavit parser ✅
└── webScraper.ts         # Aggregator (TODO)
```

---

### 3. Создание базовых интерфейсов

**Задача:** Определить общие интерфейсы для всех парсеров

**Файл:** `types.ts`

**Интерфейсы:**
```typescript
interface PriceParser {
  name: string;
  type: string;
  isAvailable(): Promise<boolean>;
  fetch(request: PriceRequest): Promise<PriceResult>;
  getRateLimit(): RateLimit;
}

interface PriceRequest {
  itemName: string;
  category: 'work' | 'material' | 'tool';
  city: string;
  unit?: string;
}

interface PriceResult {
  prices: { min: number; avg: number; max: number; currency: string };
  sources: string[];
  confidenceScore: number;  // 0.00 - 1.00
  requiresReview?: boolean;
}
```

---

### 4. Реализация Circuit Breaker

**Задача:** Защита от частых ошибок парсеров

**Файл:** `circuitBreaker.ts`

**Особенности:**
- 3 состояния: `closed`, `open`, `half-open`
- Автоматический сброс через 10 минут
- Порог ошибок: 5
- Half-open тест: 3 успешных запроса

---

### 5. Реализация Rate Limiter

**Задача:** Ограничение частоты запросов

**Файл:** `rateLimiter.ts`

**Особенности:**
- Лимит запросов в минуту
- Лимит запросов в день
- Минимальная задержка между запросами
- Автоматический сброс дневного счётчика

---

### 6. Адаптация Lemana Parser

**Файл:** `lemanaParser.ts`

**Особенности:**
- Playwright-based (Headless Chromium)
- Маскировка под реального пользователя
- Поиск по data-атрибутам `[data-qa="product"]`
- Regex для цен: `/(\d[\d\s]*)(?:,\s*\d+)?\s*₽/g`
- Пагинация (Битрикс)
- Rate limiting: 1000ms между запросами

**Конфигурация:**
```typescript
{
  baseUrl: 'https://volgograd.lemanapro.ru/catalogue/',
  maxCategories: 3,
  maxPagesPerCategory: 3,
  delayBetweenRequests: 1000,
  userAgent: 'Mozilla/5.0...',
  headless: true,
}
```

---

### 7. Адаптация Bazavit Parser

**Файл:** `bazavitParser.ts`

**Особенности:**
- Playwright-based (Headless Chromium)
- Классическая вёрстка
- Селекторы: `.catalog-item`, `.bx_catalog_item_price`
- Пагинация Битрикс (`.modern-page-next`, `.bx-pag-next`)
- Rate limiting: 1000ms между страницами

**Конфигурация:**
```typescript
{
  baseUrl: 'https://bazavit.ru/catalog/',
  maxCategories: 3,
  maxPagesPerCategory: 3,
  delayBetweenRequests: 1000,
  headless: true,
}
```

---

### 8. Обновление документации

**Файл:** `docs/UPDATE_SERVICE_SPEC.md`

**Изменения:**
- ✅ Добавлены разделы для Lemana и Bazavit парсеров
- ✅ Обновлена структура файлов
- ✅ Добавлены примеры использования
- ✅ Указаны статусы реализации

---

### 9. Конфигурация .env

**Файл:** `.env.example`

**Добавлено:**
```env
# Web Scrapers
UPDATE_LEMANA_ENABLED=true
UPDATE_LEMANA_BASE_URL="..."
UPDATE_LEMANA_MAX_CATEGORIES=3
UPDATE_LEMANA_DELAY_MS=1000

UPDATE_BAZAVIT_ENABLED=true
UPDATE_BAZAVIT_BASE_URL="..."
UPDATE_BAZAVIT_MAX_CATEGORIES=3
UPDATE_BAZAVIT_DELAY_MS=1000

# Playwright
# npx playwright install-deps (для Docker/CI)
```

---

## 🔄 Текущие задачи

### 10. Интеграция с ParserManager

**Задача:** Создать менеджер управления парсерами

**План:**
```typescript
class ParserManager {
  private parsers: Map<string, PriceParser>;
  
  selectSource(request: PriceRequest): PriceParser | null;
  registerParser(parser: PriceParser): void;
  unregisterParser(type: string): void;
}
```

**Статус:** ⬜ Pending

---

### 11. Создание Runner

**Задача:** Реализовать базовый Runner для обновления цен

**План:**
```typescript
class UpdateRunner {
  async run(job: UpdateJob): Promise<void>;
  private async processBatch(job, batch, index): Promise<void>;
  private async processItem(job, item): Promise<void>;
}
```

**Статус:** ⬜ Pending

---

### 12. Интеграция с Scheduler

**Задача:** Настроить планировщик на node-cron

**План:**
```typescript
class UpdateScheduler {
  start(config: SchedulerConfig): void;
  private async runScheduledUpdate(): Promise<void>;
}
```

**Статус:** ⬜ Pending

---

### 13. API Endpoints

**Задача:** Реализовать REST API для управления обновлениями

**Endpoints:**
- `POST /api/update/run` — Запуск обновления
- `GET /api/update/status/:jobId` — Статус задачи
- `GET /api/update/jobs` — История задач
- `POST /api/update/cancel/:jobId` — Отмена задачи

**Статус:** ⬜ Pending

---

### 14. Database Repositories

**Задача:** Создать репозитории для работы с БД

**План:**
```typescript
// priceCatalog.repo.ts
class PriceCatalogRepository {
  findById(id: string): Promise<PriceCatalog>;
  findByFilters(filters: Filters): Promise<PriceCatalog[]>;
  upsert(item: PriceCatalog): Promise<void>;
}

// updateJob.repo.ts
class UpdateJobRepository {
  create(job: UpdateJob): Promise<void>;
  updateStatus(jobId: string, status: JobStatus): Promise<void>;
  findById(jobId: string): Promise<UpdateJob>;
}
```

**Статус:** ⬜ Pending

---

### 15. Миграции БД

**Задача:** Создать SQL миграции для новых таблиц

**Таблицы:**
- `price_sources`
- `price_catalog`
- `price_history`
- `update_jobs`
- `update_job_items`
- `update_job_params`
- `update_job_locks`

**Статус:** ⬜ Pending

---

## 📅 Дорожная карта

### Фаза 1: Основа (завершена) ✅
- [x] Восстановление парсеров
- [x] Создание структуры
- [x] Базовые интерфейсы
- [x] Circuit Breaker
- [x] Rate Limiter
- [x] Документация

### Фаза 2: Интеграция (в работе) 🔄
- [ ] ParserManager
- [ ] UpdateRunner
- [ ] Database Repositories
- [ ] Миграции БД

### Фаза 3: Планировщик (следующая)
- [ ] Scheduler (node-cron)
- [ ] API Endpoints
- [ ] Конфигурация

### Фаза 4: Мониторинг
- [ ] Health Check
- [ ] Метрики (Prometheus)
- [ ] Логирование
- [ ] Вебхуки

### Фаза 5: Оптимизация
- [ ] Кэширование (Redis)
- [ ] Batch-обработка
- [ ] A/B тестирование
- [ ] Dashboard (Grafana)

---

## 📊 Метрики готовности

| Компонент | Готовность | Статус |
|-----------|------------|--------|
| Парсеры (Lemana, Bazavit) | 100% | ✅ Готово |
| Circuit Breaker | 100% | ✅ Готово |
| Rate Limiter | 100% | ✅ Готово |
| ParserManager | 0% | ⬜ Pending |
| UpdateRunner | 0% | ⬜ Pending |
| Scheduler | 0% | ⬜ Pending |
| API Endpoints | 0% | ⬜ Pending |
| Database Repositories | 0% | ⬜ Pending |
| Миграции БД | 0% | ⬜ Pending |
| Мониторинг | 0% | ⬜ Pending |

**Общая готовность:** ~30%

---

## 🔧 Технические требования

### Зависимости

```json
{
  "dependencies": {
    "playwright": "^1.58.2",
    "node-cron": "^3.0.3",
    "ioredis": "^5.4.1"
  }
}
```

### Команды для установки

```bash
# Установка Playwright
npm install playwright
npx playwright install chromium

# Для Docker/CI
npx playwright install-deps
```

### Конфигурация Playwright

```typescript
// playwright.config.ts
export default {
  use: {
    headless: true,
    userAgent: 'Mozilla/5.0...',
    viewport: { width: 1920, height: 1080 },
  },
};
```

---

## 📝 Примечания

### Приоритеты реализации

1. **Критично (P0):**
   - Database Repositories
   - Миграции БД
   - UpdateRunner

2. **Важно (P1):**
   - ParserManager
   - API Endpoints
   - Scheduler

3. **Желательно (P2):**
   - Мониторинг
   - Вебхуки
   - Кэширование

4. **Опционально (P3):**
   - A/B тестирование
   - Dashboard

### Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Блокировка сайтов | Средняя | Высокое | Rate limiting, User-Agent ротация |
| Изменение вёрстки | Средняя | Среднее | Регулярные тесты, мониторинг |
| Лимиты API | Высокая | Среднее | Кэширование, Circuit Breaker |
| Race conditions | Средняя | Среднее | Блокировки (update_job_locks) |

---

## 📞 Контакты

**Ответственный:** asv-spb
**Репозиторий:** repair-calc
**Документация:** docs/UPDATE_SERVICE_SPEC.md

---

**Последнее обновление:** 2026-03-13
**Версия плана:** 1.0
