# Спецификация службы обновления баз данных

**Дата:** 2026-03-13
**Статус:** Проект
**Версия:** 1.1
**Последняя редакция:** 2026-03-13 (улучшения и оптимизации)

---

## 1. Обзор

Служба обновления баз данных (Update Service) предназначена для автоматического сбора и обновления цен на материалы и работы из различных источников (AI-провайдеры, веб-сайты, API).

### 1.1 Основные функции

- Автоматический запуск по расписанию (раз в сутки)
- Ручной запуск через API
- Инкрементальное обновление (только устаревшие записи)
- Логирование всех операций
- Обработка ошибок и повторные попытки

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Update Service                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Scheduler   │───▶│   Runner     │───▶│   Logger     │       │
│  │   (cron)      │    │              │    │              │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                    │
│  ┌──────────────┐           │           ┌──────────────┐        │
│  │  API Routes   │──────────┼──────────▶│   Database    │        │
│  │  /update/*    │           │           │   (MySQL)     │        │
│  └──────────────┘           │           └──────────────┘        │
│                             │                                    │
│                    ┌────────▼───────┐                            │
│                    │ Parser Manager │                            │
│                    └────────┬───────┘                            │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐          │
│  │   Gemini   │     │  Mistral   │     │ Web Scraper│          │
│  │   Parser   │     │   Parser   │     │   Parser   │          │
│  └────────────┘     └────────────┘     └────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Компоненты

| Компонент | Описание |
|-----------|----------|
| **Scheduler** | Планировщик задач на node-cron, запускает обновление по расписанию |
| **Runner** | Управляет процессом обновления, координирует парсеры |
| **Parser Manager** | Выбирает и запускает нужные парсеры |
| **API Routes** | REST API для ручного управления |
| **Logger** | Логирование операций в БД и файл |

---

## 3. Структура базы данных

### 3.1 Новые таблицы

#### `price_sources` — Источники цен

```sql
CREATE TABLE price_sources (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,           -- 'ai_gemini', 'ai_mistral', 'web_scraper', 'api'
  api_endpoint VARCHAR(255),           -- URL API для программных источников
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 1,               -- Чем меньше, тем выше приоритет
  rate_limit_per_minute INT DEFAULT 60, -- Ограничение запросов к источнику
  circuit_breaker_failures INT DEFAULT 0,
  circuit_breaker_state ENUM('closed', 'open', 'half-open') DEFAULT 'closed',
  circuit_breaker_last_failure_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_type_active (type, is_active),
  INDEX idx_priority (priority)
);
```

> **Изменения в v1.1:**
> - ❌ Удалено: `url`, `config JSON` (избыточные поля)
> - ✅ Добавлено: `api_endpoint`, `rate_limit_per_minute`
> - ✅ Добавлено: Поля для Circuit Breaker (`circuit_breaker_*`)

#### `price_catalog` — Каталог цен

```sql
CREATE TABLE price_catalog (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,           -- Название материала/работы
  category ENUM('work', 'material', 'tool') NOT NULL,
  unit VARCHAR(36) DEFAULT 'м²',
  city VARCHAR(100) NOT NULL,

  -- Цены
  price_min DECIMAL(12,2) DEFAULT 0,
  price_avg DECIMAL(12,2) DEFAULT 0,
  price_max DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'RUB',

  -- Источник
  source_id VARCHAR(36),                -- FK -> price_sources
  source_type VARCHAR(50),              -- 'gemini', 'mistral', 'manual'
  
  -- Метаданные
  confidence_score DECIMAL(3,2) DEFAULT 0.50,  -- 0.00 - 1.00 (вместо confidence ENUM)
  description TEXT,
  metadata JSON,                        -- Бренд, характеристики

  -- Валидность
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Индексы
  UNIQUE KEY uniq_price (name, city, category, source_type),  -- Защита от дублей
  INDEX idx_name_city_category (name, city, category),
  INDEX idx_city_category (city, category),
  INDEX idx_validity (valid_until, is_manual),
  INDEX idx_source (source_id, updated_at),
  INDEX idx_updated (updated_at),
  INDEX idx_valid_until (valid_until),
  FULLTEXT INDEX idx_name_search (name)  -- Полнотекстовый поиск
);
```

> **Изменения в v1.1:**
> - ❌ Удалено: `sources_detail JSON` (дублирование данных)
> - ❌ Удалено: `is_manual BOOLEAN` (перенесено в `price_sources.type = 'manual'`)
> - ✅ Изменено: `confidence` → `confidence_score DECIMAL(3,2)` (0.00-1.00)
> - ✅ Добавлено: `UNIQUE KEY uniq_price` (защита от дублей)
> - ✅ Добавлено: Составные индексы для оптимизации запросов

#### `price_history` — История изменений цен (НОВАЯ)

```sql
CREATE TABLE price_history (
  id VARCHAR(36) PRIMARY KEY,
  price_catalog_id VARCHAR(36) NOT NULL,  -- FK -> price_catalog
  job_id VARCHAR(36),                     -- FK -> update_jobs (какая задача обновила)
  
  -- Старые и новые значения
  old_price_min DECIMAL(12,2),
  old_price_avg DECIMAL(12,2),
  old_price_max DECIMAL(12,2),
  new_price_min DECIMAL(12,2),
  new_price_avg DECIMAL(12,2),
  new_price_max DECIMAL(12,2),
  price_change_percent DECIMAL(6,2),      -- Процент изменения
  
  -- Контекст
  source_id VARCHAR(36),
  confidence_score DECIMAL(3,2),
  requires_review BOOLEAN DEFAULT FALSE,  -- Флаг аномалии (требует проверки)
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_catalog (price_catalog_id),
  INDEX idx_job (job_id),
  INDEX idx_created (created_at)
);
```

> **Зачем:** Трекинг изменений цен во времени, аналитика роста/падения, откат изменений.

#### `update_jobs` — История обновлений

```sql
CREATE TABLE update_jobs (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('scheduled', 'manual', 'incremental') NOT NULL,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',

  -- Параметры (вынесены в update_job_params для гибкости)
  city VARCHAR(100),                    -- NULL = все города
  categories JSON,                      -- ['work', 'material']
  sources JSON,                         -- ['gemini', 'mistral']
  triggered_by VARCHAR(36),             -- FK -> users (для manual)

  -- Прогресс
  total_items INT DEFAULT 0,
  processed_items INT DEFAULT 0,
  failed_items INT DEFAULT 0,

  -- Результаты
  items_created INT DEFAULT 0,
  items_updated INT DEFAULT 0,
  items_skipped INT DEFAULT 0,

  -- Время
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INT,

  -- Ошибки
  error_message TEXT,
  error_details JSON,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_status (status),
  INDEX idx_created (created_at),
  INDEX idx_type_status (type, status)
);
```

> **Изменения в v1.1:**
> - ⚠️ Поля `city`, `categories`, `sources` помечены как устаревшие (будут вынесены в `update_job_params` в v1.2)

#### `update_job_items` — Детализация по элементам

```sql
CREATE TABLE update_job_items (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,          -- FK -> update_jobs
  item_name VARCHAR(255) NOT NULL,
  item_category VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,

  status ENUM('pending', 'success', 'failed', 'skipped') DEFAULT 'pending',
  source VARCHAR(50),

  price_catalog_id VARCHAR(36),         -- FK -> price_catalog (ссылка на запись)
  price_change DECIMAL(12,2),           -- Дельта изменения (вместо old/new)
  
  error_message TEXT,

  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INT,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_job (job_id),
  INDEX idx_status (status),
  INDEX idx_catalog (price_catalog_id)
);
```

> **Изменения в v1.1:**
> - ❌ Удалено: `old_price_avg`, `new_price_avg` (дублирование)
> - ✅ Добавлено: `price_change DECIMAL(12,2)` (дельта)
> - ✅ Добавлено: `price_catalog_id` (ссылка на основную запись)

#### `update_job_params` — Параметры задач (НОВАЯ)

```sql
CREATE TABLE update_job_params (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,          -- FK -> update_jobs
  
  param_name VARCHAR(100) NOT NULL,
  param_value JSON NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE KEY uniq_job_param (job_id, param_name)
);
```

> **Зачем:** Гибкое хранение параметров задач без изменения структуры `update_jobs`.

#### `update_job_locks` — Блокировки задач (НОВАЯ)

```sql
CREATE TABLE update_job_locks (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,          -- FK -> update_jobs
  item_key VARCHAR(255) NOT NULL,       -- Уникальный ключ элемента (name:city:category)
  locked_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE KEY uniq_item_key (item_key),
  INDEX idx_job (job_id),
  INDEX idx_expires (expires_at)
);
```

> **Зачем:** Предотвращение race condition при конкурентных задачах (SELECT ... FOR UPDATE SKIP LOCKED).

---

## 4. API Endpoints

### 4.1 Управление обновлениями

#### `POST /api/update/run`

Запуск обновления вручную.

**Request:**
```json
{
  "city": "Москва",           // Опционально, по умолчанию все города
  "categories": ["work", "material"],  // Опционально
  "sources": ["gemini", "mistral"],    // Опционально
  "force": false,             // Принудительное обновление даже свежих
  "priority": "normal",       // 'high' | 'normal' | 'low'
  "batchSize": 10             // Размер батча для параллельной обработки
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobId": "uuid",
    "type": "manual",
    "status": "running",
    "estimatedItems": 150,
    "estimatedDurationMs": 45000
  }
}
```

#### `GET /api/update/status/:jobId`

Получить статус задачи обновления.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "type": "manual",
    "status": "running",
    "progress": {
      "total": 150,
      "processed": 75,
      "failed": 2,
      "percent": 50
    },
    "batchProgress": {
      "currentBatch": 8,
      "totalBatches": 15,
      "concurrentRequests": 5
    },
    "startedAt": "2026-03-13T10:00:00Z",
    "eta": "2026-03-13T10:05:00Z"
  }
}
```

#### `GET /api/update/jobs`

История задач обновления.

**Query params:**
- `limit` — количество записей (по умолчанию 20)
- `offset` — смещение для пагинации
- `status` — фильтр по статусу
- `type` — фильтр по типу задачи

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "type": "scheduled",
        "status": "completed",
        "itemsCreated": 10,
        "itemsUpdated": 85,
        "itemsSkipped": 55,
        "durationMs": 45000,
        "createdAt": "2026-03-13T03:00:00Z"
      }
    ],
    "total": 100
  }
}
```

#### `POST /api/update/cancel/:jobId`

Отменить_running_задачу.

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobId": "uuid",
    "status": "cancelled"
  }
}
```

#### `POST /api/update/retry/:jobId`

Повторить failed задачу (только failed items).

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobId": "uuid",
    "newJobId": "uuid-2",
    "status": "running",
    "retryItemsCount": 5
  }
}
```

### 4.2 Управление расписанием

#### `GET /api/update/schedule`

Получить текущее расписание.

**Response:**
```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "cron": "0 3 * * *",
    "timezone": "Europe/Moscow",
    "nextRun": "2026-03-14T03:00:00Z",
    "lastRun": "2026-03-13T03:00:00Z",
    "lastRunStatus": "completed"
  }
}
```

#### `PUT /api/update/schedule`

Обновить расписание (требует прав администратора).

**Request:**
```json
{
  "enabled": true,
  "cron": "0 4 * * *",
  "timezone": "Europe/Moscow"
}
```

### 4.3 Каталог цен

#### `GET /api/prices`

Поиск в каталоге цен.

**Query params:**
- `q` — поисковый запрос
- `city` — город
- `category` — категория (work, material, tool)
- `sourceType` — тип источника
- `minConfidence` — минимальный confidence_score (0.0-1.0)
- `limit`, `offset` — пагинация
- `sortBy` — сортировка (name, updated_at, price_avg)
- `sortOrder` — порядок (asc, desc)

#### `GET /api/prices/:id/history`

История изменений цены.

**Response:**
```json
{
  "status": "success",
  "data": {
    "priceCatalogId": "uuid",
    "history": [
      {
        "id": "uuid",
        "oldPriceAvg": 400,
        "newPriceAvg": 450,
        "changePercent": 12.5,
        "sourceId": "uuid",
        "jobId": "uuid",
        "requiresReview": false,
        "createdAt": "2026-03-13T03:15:00Z"
      }
    ],
    "total": 10
  }
}
```

#### `POST /api/prices`

Добавить цену вручную.

**Request:**
```json
{
  "name": "Штукатурка Rotband 30кг",
  "category": "material",
  "unit": "шт",
  "city": "Москва",
  "priceAvg": 450,
  "priceMin": 420,
  "priceMax": 490,
  "sourceType": "manual",
  "confidenceScore": 1.0,
  "metadata": {
    "brand": "Knauf",
    "weight": "30кг"
  }
}
```

#### `PUT /api/prices/:id`

Обновить цену вручную.

#### `DELETE /api/prices/:id`

Удалить запись из каталога.

#### `GET /api/prices/export`

Экспорт каталога цен.

**Query params:**
- `format` — формат (csv, xlsx, json)
- `city` — фильтр по городу
- `category` — фильтр по категории

**Response:** Файл для скачивания.

#### `POST /api/prices/import`

Импорт цен из файла.

**Request:** `multipart/form-data` с файлом (CSV, XLSX).

**Response:**
```json
{
  "status": "success",
  "data": {
    "importedItems": 150,
    "skippedItems": 5,
    "errorItems": 2,
    "errors": [
      {"row": 15, "error": "Invalid category"}
    ]
  }
}
```

### 4.4 Вебхуки и уведомления

#### `POST /api/update/webhooks`

Зарегистрировать вебхук для уведомлений.

**Request:**
```json
{
  "url": "https://myapp.com/notify",
  "events": ["job.completed", "job.failed", "job.anomaly_detected"],
  "secret": "hmac-secret-for-signing",
  "active": true
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "webhookId": "uuid",
    "url": "https://myapp.com/notify",
    "events": ["job.completed", "job.failed"]
  }
}
```

#### `GET /api/update/webhooks`

Список зарегистрированных вебхуков.

#### `DELETE /api/update/webhooks/:id`

Удалить вебхук.

### 4.5 Мониторинг

#### `GET /api/update/health`

Health check службы обновлений.

**Response:**
```json
{
  "status": "ok",
  "scheduler": {
    "enabled": true,
    "running": true,
    "nextRun": "2026-03-14T03:00:00Z"
  },
  "parsers": {
    "gemini": { 
      "available": true, 
      "lastSuccess": "2026-03-13T03:15:00Z",
      "circuitBreakerState": "closed",
      "avgResponseTimeMs": 1200
    },
    "mistral": { 
      "available": true, 
      "lastSuccess": "2026-03-13T03:14:00Z",
      "circuitBreakerState": "closed",
      "avgResponseTimeMs": 980
    }
  },
  "catalog": {
    "totalItems": 1500,
    "staleItems": 45,
    "itemsForReview": 3,
    "lastUpdated": "2026-03-13T03:15:00Z"
  },
  "cache": {
    "enabled": true,
    "hitRate": 0.75,
    "size": 450
  }
}
```

#### `GET /api/update/metrics`

Метрики производительности.

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobsTotal": 120,
    "jobsCompleted": 115,
    "jobsFailed": 3,
    "jobsCancelled": 2,
    "itemsProcessed": 15000,
    "itemsFailed": 45,
    "avgDurationMs": 42000,
    "avgItemDurationMs": 280,
    "cacheHitRate": 0.75,
    "anomaliesDetected": 12,
    "anomaliesReviewed": 8,
    "lastRunAt": "2026-03-13T03:00:00Z",
    "nextRunAt": "2026-03-14T03:00:00Z"
  }
}
```

---

## 5. Модуль Scheduler

### 5.1 Конфигурация

```typescript
// server/src/services/update/scheduler.ts

interface SchedulerConfig {
  enabled: boolean;
  cron: string;           // '0 3 * * *' = каждый день в 3:00
  timezone: string;       // 'Europe/Moscow'
  retryOnFailure: boolean;
  retryDelayMs: number;   // 5 минут
  maxRetries: number;     // 3
  maxConcurrentJobs: number;  // Максимум одновременных задач
}

const defaultConfig: SchedulerConfig = {
  enabled: true,
  cron: '0 3 * * *',      // 3:00 AM Moscow time
  timezone: 'Europe/Moscow',
  retryOnFailure: true,
  retryDelayMs: 5 * 60 * 1000,
  maxRetries: 3,
  maxConcurrentJobs: 3,
};
```

### 5.2 Логика работы

```typescript
class UpdateScheduler {
  private cronJob: CronJob | null = null;
  private runningJobs = new Map<string, UpdateJob>();

  start(config: SchedulerConfig): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = new CronJob(
      config.cron,
      () => this.runScheduledUpdate(),
      null,
      true,
      config.timezone
    );
  }

  private async runScheduledUpdate(): Promise<void> {
    // Проверка на лимит одновременных задач
    if (this.runningJobs.size >= config.maxConcurrentJobs) {
      logger.warn('Max concurrent jobs reached, skipping scheduled run');
      return;
    }

    const job = await this.createJob('scheduled');
    this.runningJobs.set(job.id, job);

    try {
      await this.updateRunner.run(job);
      await this.completeJob(job);
    } catch (error) {
      logger.error('Scheduled update failed:', error);

      if (config.retryOnFailure) {
        await this.scheduleRetry(job);
      } else {
        await this.failJob(job, error);
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  getStatus(): SchedulerStatus {
    return {
      enabled: this.cronJob !== null,
      nextRun: this.cronJob?.nextDates()?.[0],
      runningJobs: this.runningJobs.size,
    };
  }
}
```

### 5.3 Circuit Breaker для планировщика

```typescript
class SchedulerCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private lastFailureTime: number | null = null;
  
  constructor(
    private threshold: number = 3,
    private resetTimeoutMs: number = 5 * 60 * 1000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened after', this.failures, 'failures');
    }
  }
}
```

---

## 6. Модуль Runner

### 6.1 Процесс обновления

```typescript
class UpdateRunner {
  private cache: Map<string, PriceResult>;
  private circuitBreakers: Map<string, CircuitBreaker>;

  async run(job: UpdateJob): Promise<void> {
    await this.updateStatus(job, 'running');

    try {
      // 1. Получить список элементов для обновления (с блокировками)
      const items = await this.getItemsToUpdate(job);
      await this.updateProgress(job, { total: items.length });

      // 2. Обработка батчами для параллелизма
      const batchSize = job.batchSize || 10;
      const batches = this.chunkArray(items, batchSize);

      for (const [index, batch] of batches.entries()) {
        await this.processBatch(job, batch, index);
      }

      // 3. Завершить задачу
      await this.completeJob(job);

    } catch (error) {
      await this.failJob(job, error);
      throw error;
    }
  }

  private async processBatch(
    job: UpdateJob,
    batch: UpdateItem[],
    batchIndex: number
  ): Promise<void> {
    logger.debug(`Processing batch ${batchIndex + 1} (${batch.length} items)`);

    // Параллельная обработка с учётом rate limits
    const results = await Promise.allSettled(
      batch.map(item => this.processItem(job, item))
    );

    // Логирование результатов батча
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.debug(`Batch ${batchIndex + 1} completed: ${succeeded} succeeded, ${failed} failed`);
  }

  private async processItem(job: UpdateJob, item: UpdateItem): Promise<void> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(item);

    try {
      // Проверка кэша
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        await this.savePrice(item, cached, cached.source);
        await this.recordSuccess(job, item, cached, Date.now() - startTime, true);
        return;
      }

      // Проверка блокировки (для конкурентных задач)
      const isLocked = await this.tryAcquireLock(job, item);
      if (!isLocked) {
        await this.recordSkipped(job, item, 'Item is locked by another job');
        return;
      }

      try {
        // Выбрать источник (с проверкой Circuit Breaker)
        const source = this.parserManager.selectSource(item);
        if (!source) {
          throw new Error('No available source');
        }

        // Получить цены
        const result = await this.parserManager.fetch(item, source);

        // Проверка на аномалии
        const anomaly = await this.detectAnomaly(item, result);
        if (anomaly) {
          result.requiresReview = true;
          logger.warn(`Anomaly detected for ${item.name}: ${anomaly.reason}`);
        }

        // Сохранить в БД
        await this.savePrice(item, result, source);

        // Сохранить в кэш
        await this.saveToCache(cacheKey, result);

        await this.recordSuccess(job, item, result, Date.now() - startTime, false);

      } finally {
        // Освободить блокировку
        await this.releaseLock(job, item);
      }

    } catch (error) {
      await this.recordFailure(job, item, error, Date.now() - startTime);
    }
  }

  private getCacheKey(item: UpdateItem): string {
    // Хэш по ключевым полям для кэширования
    const key = `${item.name}:${item.city}:${item.category}`;
    return sha256(key);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### 6.2 Приоритет обновления

Элементы для обновления выбираются по приоритету:

| Приоритет | Критерий | Score |
|-----------|----------|-------|
| 1 | Нет записи в БД | 100 |
| 2 | `valid_until < NOW()` (просрочено) | 80 |
| 3 | `updated_at < NOW() - INTERVAL 7 DAY` | 60 |
| 4 | `confidence_score < 0.5` | 40 |
| 5 | `requires_review = TRUE` | 30 |
| 6 | Плановое обновление | 20 |

```typescript
async function calculatePriority(item: UpdateItem): Promise<number> {
  let score = 0;

  if (!item.existsInDb) score += 100;
  if (item.validUntil && item.validUntil < new Date()) score += 80;
  if (item.updatedAt && item.updatedAt < subDays(new Date(), 7)) score += 60;
  if (item.confidenceScore < 0.5) score += 40;
  if (item.requiresReview) score += 30;
  else score += 20; // Плановое

  return score;
}
```

### 6.3 Валидация аномалий

```typescript
interface AnomalyResult {
  isAnomaly: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high';
}

async function detectAnomaly(
  item: UpdateItem,
  result: PriceResult,
  history: PriceHistory[]
): Promise<AnomalyResult> {
  const oldPrice = history[0]?.newPriceAvg || item.currentPrice;
  const newPrice = result.prices.avg;
  
  if (!oldPrice) {
    return { isAnomaly: false };
  }

  const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;

  // Проверка на резкое изменение
  if (changePercent > 200) {
    return {
      isAnomaly: true,
      reason: `Price changed by ${changePercent.toFixed(1)}% (>200%)`,
      severity: 'high'
    };
  }

  if (changePercent > 100) {
    return {
      isAnomaly: true,
      reason: `Price changed by ${changePercent.toFixed(1)}% (>100%)`,
      severity: 'medium'
    };
  }

  // Проверка на выход за пределы рынка
  const marketAvg = await this.getMarketAverage(item.name, item.category);
  if (marketAvg && newPrice > marketAvg * 3) {
    return {
      isAnomaly: true,
      reason: `Price ${newPrice} exceeds market average ${marketAvg} by 3x`,
      severity: 'high'
    };
  }

  return { isAnomaly: false };
}
```

### 6.4 Конфигурация Runner

```typescript
interface RunnerConfig {
  batchSize: number;              // Размер батча (по умолчанию 10)
  concurrentRequests: number;     // Параллельные запросы (по умолчанию 5)
  requestDelayMs: number;         // Задержка между запросами (500ms)
  cacheEnabled: boolean;          // Включить кэш
  cacheTtlMs: number;             // Время жизни кэша (1 час)
  anomalyDetectionEnabled: boolean;
  anomalyThresholdPercent: number;  // Порог аномалии (100%)
}
```

---

## 7. Parser Manager

### 7.1 Интерфейс парсера

```typescript
interface PriceParser {
  name: string;
  type: string;

  isAvailable(): Promise<boolean>;

  fetch(request: PriceRequest): Promise<PriceResult>;
  
  getRateLimit(): RateLimit;  // Ограничения источника
}

interface PriceRequest {
  itemName: string;
  category: 'work' | 'material' | 'tool';
  city: string;
  unit?: string;
}

interface PriceResult {
  prices: {
    min: number;
    avg: number;
    max: number;
    currency: string;
  };
  sources: string[];
  confidenceScore: number;  // 0.00 - 1.00
  raw?: unknown;
  requiresReview?: boolean;  // Флаг аномалии
}

interface RateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
  concurrentRequests: number;
}
```

### 7.2 Circuit Breaker для парсеров

```typescript
class ParserCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  
  constructor(
    private parserType: string,
    private threshold: number = 5,
    private resetTimeoutMs: number = 10 * 60 * 1000,  // 10 минут
    private halfOpenMaxRequests: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Проверка на возможность перехода в half-open
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
        logger.info(`Circuit breaker for ${this.parserType} entering half-open state`);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker for ${this.parserType} is open`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    
    if (this.state === 'half-open' && this.successes >= this.halfOpenMaxRequests) {
      this.state = 'closed';
      this.failures = 0;
      this.successes = 0;
      logger.info(`Circuit breaker for ${this.parserType} closed (recovered)`);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;
    
    if (this.state === 'half-open') {
      this.state = 'open';
      logger.warn(`Circuit breaker for ${this.parserType} opened from half-open`);
    } else if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn(`Circuit breaker for ${this.parserType} opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
```

### 7.3 Gemini Parser

```typescript
class GeminiParser implements PriceParser {
  name = 'Google Gemini';
  type = 'ai_gemini';

  private client: GoogleGenerativeAI;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.circuitBreaker = new ParserCircuitBreaker('gemini');
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 60,
      requestsPerDay: 10000,
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.circuitBreaker.getState().state !== 'open';
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 60,
      requestsPerDay: 10000,
      concurrentRequests: 5,
    };
  }

  async fetch(request: PriceRequest): Promise<PriceResult> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.wait();

      const prompt = this.buildPrompt(request);
      const result = await this.client.generateContent(prompt);

      return this.parseResult(result);
    });
  }

  private buildPrompt(request: PriceRequest): string {
    return `Найди актуальные цены на "${request.itemName}"
            (${request.category}) в городе ${request.city}.
            Единица измерения: ${request.unit || 'м²'}.

            Верни JSON с полями:
            - prices: { min, avg, max, currency }
            - sources: массив источников (URL или название)
            - confidenceScore: число от 0.0 до 1.0
            
            Пример ответа:
            {
              "prices": { "min": 500, "avg": 750, "max": 1000, "currency": "RUB" },
              "sources": ["petrovich.ru", "leroymerlin.ru"],
              "confidenceScore": 0.85
            }`;
  }

  private parseResult(result: GenerateContentResult): PriceResult {
    const text = result.response.text();
    const json = JSON.parse(text);

    return {
      prices: {
        min: Number(json.prices.min),
        avg: Number(json.prices.avg),
        max: Number(json.prices.max),
        currency: json.currency || 'RUB',
      },
      sources: json.sources || [],
      confidenceScore: Math.min(1.0, Math.max(0.0, json.confidenceScore || 0.5)),
      raw: json,
    };
  }
}
```

### 7.4 Mistral Parser

```typescript
class MistralParser implements PriceParser {
  name = 'Mistral AI';
  type = 'ai_mistral';

  private client: MistralClient;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(config: MistralConfig) {
    this.client = new MistralClient(config.apiKey);
    this.circuitBreaker = new ParserCircuitBreaker('mistral');
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 100,
      requestsPerDay: 50000,
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.circuitBreaker.getState().state !== 'open';
  }

  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 100,
      requestsPerDay: 50000,
      concurrentRequests: 10,
    };
  }

  async fetch(request: PriceRequest): Promise<PriceResult> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.wait();

      const prompt = this.buildPrompt(request);
      const result = await this.client.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      return this.parseResult(result);
    });
  }

  // Аналогично Gemini Parser
}
```

### 7.5 Web Scraper Parser

#### Lemana PRO Parser ✅

```typescript
class LemanaParser implements PriceParser {
  name = 'Lemana PRO';
  type = 'web_scraper';
  
  // Сайт: https://volgograd.lemanapro.ru
  // Особенности: SPA-архитектура, защита Qrator
  // Использует Playwright с подменой User-Agent
  
  private config: LemanaParserConfig = {
    baseUrl: 'https://volgograd.lemanapro.ru/catalogue/',
    maxCategories: 3,
    maxPagesPerCategory: 3,
    delayBetweenRequests: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    headless: true,
  };

  async fetch(request: PriceRequest): Promise<PriceResult> {
    // Поиск товара на сайте
    const searchUrl = `${this.config.baseUrl}?search=${encodeURIComponent(request.itemName)}`;
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    // Извлечение цен через data-атрибуты [data-qa="product"]
    const prices = await this.extractPrices();
    
    return {
      prices: { min, avg, max, currency: 'RUB' },
      sources: ['lemanapro.ru'],
      confidenceScore: 0.8,
    };
  }

  async parseCatalog(): Promise<CatalogData> {
    // Полный парсинг каталога
    // 1. Извлечение категорий
    // 2. Проход по страницам пагинации (Битрикс)
    // 3. Сохранение в JSON + SQL
  }
}
```

**Файл:** `server/src/services/update/parsers/lemanaParser.ts`

**Особенности:**
- ✅ Playwright-based (Headless Chromium)
- ✅ Маскировка под реального пользователя (User-Agent, viewport)
- ✅ Поиск товаров по data-атрибутам (`[data-qa="product"]`)
- ✅ Извлечение цен через Regex (формат: "5 704, 60 ₽")
- ✅ Поддержка пагинации
- ✅ Rate limiting (1000ms между запросами)

---

#### Bazavit Parser ✅

```typescript
class BazavitParser implements PriceParser {
  name = 'Bazavit';
  type = 'web_scraper';
  
  // Сайт: https://bazavit.ru
  // Особенности: Битрикс-пагинация, классическая вёрстка

  private config: BazavitParserConfig = {
    baseUrl: 'https://bazavit.ru/catalog/',
    maxCategories: 3,
    maxPagesPerCategory: 3,
    delayBetweenRequests: 1000,
    headless: true,
  };

  async fetch(request: PriceRequest): Promise<PriceResult> {
    // Поиск товара на сайте
    const searchUrl = `https://bazavit.ru/search/?query=${encodeURIComponent(request.itemName)}`;
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    // Извлечение цен из .catalog-item .bx_catalog_item_price
    const prices = await this.extractPrices();
    
    return {
      prices: { min, avg, max, currency: 'RUB' },
      sources: ['bazavit.ru'],
      confidenceScore: 0.8,
    };
  }

  async parseCatalog(): Promise<CatalogData> {
    // Полный парсинг каталога
    // 1. Извлечение категорий из /catalog/
    // 2. Проход по страницам (.modern-page-next, .bx-pag-next)
    // 3. Сохранение в JSON + SQL
  }
}
```

**Файл:** `server/src/services/update/parsers/bazavitParser.ts`

**Особенности:**
- ✅ Playwright-based (Headless Chromium)
- ✅ Парсинг категорий и товаров
- ✅ Поддержка пагинации Битрикс
- ✅ Экспорт в JSON + SQL
- ✅ Rate limiting (1000ms между страницами)

---

#### Future: Multi-Source Aggregator

```typescript
class WebScraperParser implements PriceParser {
  name = 'Web Scraper Aggregator';
  type = 'web_scraper';

  private sources: ScraperSource[] = [
    { name: 'LemanaPRO', parser: LemanaParser, priority: 1 },
    { name: 'Bazavit', parser: BazavitParser, priority: 2 },
    { name: 'Ozon', url: 'https://ozon.ru', parser: 'ozon' },         // TODO
    { name: 'YandexMarket', url: 'https://market.yandex.ru' },        // TODO
    { name: 'Petrovich', url: 'https://petrovich.ru' },               // TODO
  ];

  async fetch(request: PriceRequest): Promise<PriceResult> {
    const results = await Promise.allSettled(
      this.sources.map(s => this.scrapeSource(s, request))
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<ScrapeResult> => r.status === 'fulfilled')
      .map(r => r.value);

    return this.aggregateResults(successful);
  }
}
```

### 7.6 Parser Manager — выбор источника

```typescript
class ParserManager {
  private parsers: Map<string, PriceParser>;
  private abTestConfig?: ABTestConfig;

  selectSource(request: PriceRequest): PriceParser | null {
    // A/B тестирование (если настроено)
    if (this.abTestConfig?.enabled) {
      return this.selectForABTest(request);
    }

    // Выбор по приоритету
    const available = Array.from(this.parsers.values())
      .filter(p => p.isAvailable())
      .sort((a, b) => {
        const limitA = a.getRateLimit();
        const limitB = b.getRateLimit();
        return limitB.requestsPerMinute - limitA.requestsPerMinute;
      });

    return available[0] || null;
  }

  private selectForABTest(request: PriceRequest): PriceParser {
    // 50/50 распределение между Gemini и Mistral
    const hash = sha256(`${request.itemName}:${request.city}`);
    const lastChar = parseInt(hash.slice(-1), 16);
    
    if (lastChar < 8) {
      return this.parsers.get('gemini') || null;
    } else {
      return this.parsers.get('mistral') || null;
    }
  }
}
```

---

## 8. Конфигурация

### 8.1 Переменные окружения

```env
# .env

# Scheduler
UPDATE_SCHEDULER_ENABLED=true
UPDATE_CRON="0 3 * * *"
UPDATE_TIMEZONE="Europe/Moscow"
UPDATE_MAX_CONCURRENT_JOBS=3

# Retry
UPDATE_RETRY_ON_FAILURE=true
UPDATE_RETRY_DELAY_MS=300000
UPDATE_MAX_RETRIES=3

# Cache (Redis или in-memory)
UPDATE_CACHE_ENABLED=true
UPDATE_CACHE_PROVIDER=redis           # 'redis' | 'memory'
UPDATE_CACHE_TTL_MS=3600000           # 1 час
UPDATE_CACHE_HOST=localhost
UPDATE_CACHE_PORT=6379

# Concurrency
UPDATE_BATCH_SIZE=10
UPDATE_CONCURRENT_REQUESTS=5
UPDATE_REQUEST_DELAY_MS=500

# Anomaly Detection
UPDATE_ANOMALY_DETECTION_ENABLED=true
UPDATE_ANOMALY_THRESHOLD_PERCENT=100   # 100% изменение цены
UPDATE_ANOMALY_REVIEW_REQUIRED=true

# Circuit Breaker
UPDATE_CIRCUIT_BREAKER_THRESHOLD=5
UPDATE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS=600000  # 10 минут

# Rate Limits (по умолчанию для парсеров)
UPDATE_GEMINI_RATE_LIMIT_PER_MINUTE=60
UPDATE_GEMINI_RATE_LIMIT_PER_DAY=10000
UPDATE_MISTRAL_RATE_LIMIT_PER_MINUTE=100
UPDATE_MISTRAL_RATE_LIMIT_PER_DAY=50000

# A/B Testing
UPDATE_AB_TEST_ENABLED=false
UPDATE_AB_TEST_GEMINI_WEIGHT=50        # Процент запросов к Gemini

# Источники
GEMINI_API_KEY=your_key
MISTRAL_API_KEY=your_key
GEMINI_ENABLED=true
MISTRAL_ENABLED=true
LLM_PRIMARY=gemini

# Вебхуки
UPDATE_WEBHOOKS_ENABLED=false
UPDATE_WEBHOOK_RETRY_COUNT=3
UPDATE_WEBHOOK_TIMEOUT_MS=5000
```

### 8.2 Структура файлов

```
server/src/
├── services/
│   └── update/
│       ├── index.ts              # Экспорты
│       ├── scheduler.ts          # Планировщик (cron)
│       ├── runner.ts             # Запуск обновления
│       ├── parserManager.ts      # Управление парсерами
│       ├── parsers/
│       │   ├── index.ts          # Экспорты парсеров
│       │   ├── types.ts          # Интерфейсы (PriceParser, PriceRequest, PriceResult)
│       │   ├── circuitBreaker.ts # Circuit Breaker паттерн
│       │   ├── rateLimiter.ts    # Rate Limiting
│       │   ├── gemini.ts         # Gemini AI ✅
│       │   ├── mistral.ts        # Mistral AI ✅
│       │   ├── lemanaParser.ts   # Lemana PRO ✅
│       │   ├── bazavitParser.ts  # Bazavit ✅
│       │   └── webScraper.ts     # Web Scraper Aggregator (TODO)
│       ├── utils/
│       │   ├── priority.ts       # Приоритизация элементов
│       │   ├── validation.ts     # Валидация цен
│       │   ├── cache.ts          # Кэширование
│       │   └── batch.ts          # Batch-обработка
│       └── config/
│           └── update.config.ts  # Конфигурация
│
├── routes/
│   └── update.ts                 # API endpoints
│
├── db/
│   ├── migrations/
│   │   └── 20260313_price_catalog.ts
│   └── repositories/
│       ├── priceCatalog.repo.ts
│       ├── priceHistory.repo.ts
│       └── updateJob.repo.ts
│
└── webhooks/
    └── webhook.service.ts        # Отправка уведомлений
```

---

## 9. Мониторинг и логирование

### 9.1 Метрики

```typescript
interface UpdateMetrics {
  // Задачи
  jobsTotal: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsCancelled: number;
  
  // Элементы
  itemsProcessed: number;
  itemsFailed: number;
  itemsSkipped: number;
  itemsForReview: number;  // Требуют ручной проверки
  
  // Производительность
  avgDurationMs: number;
  avgItemDurationMs: number;
  lastRunAt: Date;
  nextRunAt: Date;
  
  // Кэш
  cacheHitRate: number;
  cacheSize: number;
  
  // Аномалии
  anomaliesDetected: number;
  anomaliesReviewed: number;
  
  // Circuit Breaker
  circuitBreakerStates: Record<string, 'closed' | 'open' | 'half-open'>;
}
```

### 9.2 Health Check

```
GET /api/update/health
```

```json
{
  "status": "ok",
  "scheduler": {
    "enabled": true,
    "running": true,
    "nextRun": "2026-03-14T03:00:00Z",
    "concurrentJobs": 0,
    "maxConcurrentJobs": 3
  },
  "parsers": {
    "gemini": { 
      "available": true, 
      "lastSuccess": "2026-03-13T03:15:00Z",
      "circuitBreakerState": "closed",
      "avgResponseTimeMs": 1200,
      "requestsToday": 450,
      "rateLimitRemaining": 9550
    },
    "mistral": { 
      "available": true, 
      "lastSuccess": "2026-03-13T03:14:00Z",
      "circuitBreakerState": "closed",
      "avgResponseTimeMs": 980,
      "requestsToday": 320,
      "rateLimitRemaining": 49680
    }
  },
  "catalog": {
    "totalItems": 1500,
    "staleItems": 45,
    "itemsForReview": 3,
    "lastUpdated": "2026-03-13T03:15:00Z",
    "pricesByCategory": {
      "work": 800,
      "material": 650,
      "tool": 50
    }
  },
  "cache": {
    "enabled": true,
    "provider": "redis",
    "hitRate": 0.75,
    "size": 450,
    "ttlMs": 3600000
  },
  "database": {
    "connection": "ok",
    "latencyMs": 5
  }
}
```

### 9.3 Логирование

Все операции логируются с уровнями:

| Уровень | Описание | Пример |
|---------|----------|--------|
| `info` | Старт/завершение задачи | `"Update job started: type=scheduled, items=150"` |
| `debug` | Обработка каждого элемента | `"Processing item: name=Штукатурка, city=Москва"` |
| `debug` | Результаты кэша | `"Cache hit for item: key=abc123"` |
| `warn` | Повторные попытки, пропуски | `"Item skipped: locked by job xyz"` |
| `warn` | Аномалии цен | `"Anomaly detected: price changed by 150%"` |
| `error` | Ошибки парсеров, сбои | `"Parser failed: type=gemini, error=Rate limit exceeded"` |

### 9.4 Логирование в БД

```typescript
interface UpdateLog {
  id: string;
  jobId: string;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

// Пример записи
{
  id: "uuid",
  jobId: "job-uuid",
  level: "warn",
  message: "Anomaly detected for item",
  context: {
    itemName: "Штукатурка Rotband",
    oldPrice: 400,
    newPrice: 1000,
    changePercent: 150
  },
  createdAt: "2026-03-13T03:15:00Z"
}
```

### 9.5 Вебхуки для уведомлений

```typescript
interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;  // Для HMAC-подписи
  active: boolean;
  retryCount: number;
  retryDelayMs: number;
}

type WebhookEvent = 
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.anomaly_detected'
  | 'parser.circuit_open'
  | 'parser.circuit_closed';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;  // HMAC-SHA256
}
```

### 9.6 Dashboard (опционально)

Пример метрик для Grafana/Prometheus:

```
# Scheduler
update_scheduler_enabled{instance="..."} 1
update_scheduler_next_run_timestamp{instance="..."} 1710403200

# Jobs
update_jobs_total{type="scheduled"} 120
update_jobs_completed{type="scheduled"} 115
update_jobs_failed{type="manual"} 2

# Items
update_items_processed_total 15000
update_items_failed_total 45
update_items_for_review 3

# Performance
update_job_duration_seconds{quantile="0.5"} 42
update_item_duration_seconds{quantile="0.95"} 2.5

# Cache
update_cache_hit_rate 0.75
update_cache_size 450

# Circuit Breaker
update_circuit_breaker_state{parser="gemini"} 0  # 0=closed, 1=open, 2=half-open
update_circuit_breaker_failures{parser="gemini"} 0

# Anomalies
update_anomalies_detected_total 12
update_anomalies_reviewed_total 8
```

---

## 10. Безопасность

### 10.1 Авторизация

| Endpoint | Требуется авторизация | Требуемая роль |
|----------|----------------------|----------------|
| `POST /api/update/run` | ✅ | `user` |
| `PUT /api/update/schedule` | ✅ | `admin` |
| `POST /api/update/cancel/:jobId` | ✅ | `admin` или владелец |
| `POST /api/update/retry/:jobId` | ✅ | `admin` |
| `POST /api/prices` | ✅ | `admin` |
| `PUT /api/prices/:id` | ✅ | `admin` |
| `DELETE /api/prices/:id` | ✅ | `admin` |
| `POST /api/update/webhooks` | ✅ | `admin` |
| `GET /api/prices/export` | ✅ | `user` |
| `POST /api/prices/import` | ✅ | `admin` |

### 10.2 Rate Limiting

| Действие | Лимит |
|----------|-------|
| Ручной запуск обновления | 1 в 5 минут на пользователя |
| Конкурентные задачи | Максимум 3 одновременно |
| API запросы к парсерам | Зависит от провайдера (Gemini: 60/мин, Mistral: 100/мин) |
| Экспорт цен | 5 в час |
| Импорт цен | 2 в час |

### 10.3 Защита API ключей

- Ключи хранятся в `.env` на сервере
- Не логируются в open-source логах
- Используются только на серверной стороне
- Ротация ключей через переменные окружения без перезапуска (опционально)

### 10.4 Валидация входных данных

```typescript
// Пример валидации для POST /api/update/run
const schema = z.object({
  city: z.string().max(100).optional(),
  categories: z.array(z.enum(['work', 'material', 'tool'])).optional(),
  sources: z.array(z.enum(['gemini', 'mistral', 'web'])).optional(),
  force: z.boolean().default(false),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  batchSize: z.number().min(1).max(50).default(10),
});
```

### 10.5 Аудит действий

Все действия администраторов логируются в таблицу `audit_log`:

```sql
CREATE TABLE audit_log (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. План реализации

### Фаза 1: Основа (4-5 дней)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ✅ Создать миграцию для таблиц | 2ч | Готово |
| ⬜ Создать репозитории (priceCatalog.repo, updateJob.repo, priceHistory.repo) | 3ч | Pending |
| ⬜ Реализовать базовый Runner | 4ч | Pending |
| ⬜ Реализовать API endpoints (базовые) | 4ч | Pending |
| ⬜ Реализовать блокировки (update_job_locks) | 2ч | Pending |

**Итого:** ~15 часов

### Фаза 2: AI-парсеры (3-4 дня)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ⬜ Gemini Parser (адаптация клиентского кода) | 4ч | Pending |
| ⬜ Mistral Parser | 3ч | Pending |
| ⬜ Parser Manager с выбором провайдера | 3ч | Pending |
| ⬜ Circuit Breaker для парсеров | 3ч | Pending |
| ⬜ Rate Limiter для парсеров | 2ч | Pending |

**Итого:** ~15 часов

### Фаза 3: Оптимизации (2-3 дня)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ⬜ Кэширование результатов (Redis) | 4ч | Pending |
| ⬜ Batch-обработка | 3ч | Pending |
| ⬜ Валидация аномалий | 3ч | Pending |
| ⬜ Приоритетная очередь задач | 2ч | Pending |

**Итого:** ~12 часов

### Фаза 4: Scheduler (1-2 дня)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ⬜ Интеграция node-cron | 2ч | Pending |
| ⬜ Конфигурация через env | 1ч | Pending |
| ⬜ Обработка retry | 2ч | Pending |
| ⬜ Circuit Breaker для планировщика | 2ч | Pending |

**Итого:** ~7 часов

### Фаза 5: Мониторинг (2 дня)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ⬜ Health check endpoint | 2ч | Pending |
| ⬜ Метрики (Prometheus format) | 3ч | Pending |
| ⬜ Логирование в БД | 2ч | Pending |
| ⬜ Dashboard (Grafana, опционально) | 4ч | Pending |

**Итого:** ~11 часов

### Фаза 6: Дополнительные возможности (2-3 дня)

| Задача | Оценка | Статус |
|--------|--------|--------|
| ⬜ Вебхуки для уведомлений | 4ч | Pending |
| ⬜ Экспорт/импорт цен (CSV/XLSX) | 6ч | Pending |
| ⬜ A/B тестирование парсеров | 4ч | Pending |
| ⬜ Аудит действий администраторов | 2ч | Pending |

**Итого:** ~16 часов

---

### Сводная таблица

| Фаза | Описание | Часы | Дни (8ч) |
|------|----------|------|----------|
| 1 | Основа | 15 | ~2 |
| 2 | AI-парсеры | 15 | ~2 |
| 3 | Оптимизации | 12 | ~1.5 |
| 4 | Scheduler | 7 | ~1 |
| 5 | Мониторинг | 11 | ~1.5 |
| 6 | Дополнительно | 16 | ~2 |
| **Всего** | | **76** | **~10** |

---

## 12. Риски и решения

| Риск | Вероятность | Влияние | Решение |
|------|-------------|---------|---------|
| Лимиты AI API | Средняя | Высокое | Кэширование, приоритизация, delay между запросами, Circuit Breaker |
| Некорректные данные от AI | Средняя | Высокое | Валидация цен, проверка на аномалии, флаг requires_review |
| Долгое выполнение | Высокая | Среднее | Batch-обработка, прогресс-бар, возможность отмены |
| Сбой сервера | Низкая | Высокое | Сохранение состояния в БД, возобновление прерванных задач |
| Race condition при конкурентных задачах | Средняя | Среднее | Блокировки (update_job_locks), SELECT ... FOR UPDATE SKIP LOCKED |
| Дублирование записей | Высокая | Среднее | UNIQUE KEY uniq_price, валидация перед вставкой |
| Переполнение кэша | Низкая | Низкое | LRU eviction, TTL для кэшированных записей |
| Утечка API ключей | Низкая | Критичное | Хранение в .env, запрет логирования, ротация ключей |

---

## 13. Changelog

### v1.1 (2026-03-13) — Улучшения и оптимизации

**Добавлено:**
- ✅ Таблица `price_history` для трекинга изменений цен
- ✅ Таблица `update_job_params` для гибких параметров задач
- ✅ Таблица `update_job_locks` для предотвращения race condition
- ✅ Circuit Breaker для парсеров и планировщика
- ✅ Кэширование результатов AI-запросов
- ✅ Batch-обработка для параллелизма
- ✅ Валидация аномалий цен
- ✅ Вебхуки для уведомлений
- ✅ Экспорт/импорт цен
- ✅ A/B тестирование парсеров
- ✅ Полнотекстовый поиск по каталогу

**Изменено:**
- ✅ `confidence` (ENUM) → `confidence_score` (DECIMAL 0.00-1.00)
- ✅ `update_job_items.old/new_price_avg` → `price_change` (дельта)
- ✅ Расширенные API endpoints (retry, export/import, webhooks)
- ✅ Детализированные метрики и health check

**Удалено:**
- ✅ `price_sources.url`, `price_sources.config` (избыточные поля)
- ✅ `price_catalog.sources_detail` (дублирование)
- ✅ `price_catalog.is_manual` (перенесено в price_sources.type)

**Исправлено:**
- ✅ Добавлен UNIQUE KEY для предотвращения дублей
- ✅ Добавлены составные индексы для оптимизации запросов

---

**Последнее обновление:** 2026-03-13
**Версия:** 1.1