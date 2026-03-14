# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-04
**Обновлено:** 2026-03-12
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## ✅ Выполнено

### Критичные (Blockers) — ВСЕ ИСПРАВЛЕНЫ

- [x] **Stale closure в `updateActiveProject`** — ✅ Исправлено ранее
- [x] **CSV-экспорт игнорирует extended/advanced режимы** — ✅ Исправлено 2026-03-04
- [x] **Расхождение портов** — ✅ Исправлено ранее
- [x] **Утечка API-ключа в клиентский бандл** — ✅ Исправлено ранее
- [x] **Rules of Hooks в `App.tsx`** — ✅ Исправлено 2026-03-09 (useEffect перемещён выше условного возврата)

### Фаза 1: Декомпозиция App.tsx — ВЫПОЛНЕНО

- [x] **God Component `App.tsx`** — декомпозиция завершена. App.tsx теперь ~170 строк (было ~2700).
- [x] Типы вынесены в `src/types/`
- [x] Утилиты вынесены в `src/utils/` (geometry.ts, costs.ts, factories.ts, storage.ts)
- [x] Компоненты вынесены: `SummaryView`, `RoomEditor`, `BackupManager`, `RoomList`, `WorkList`, `NumberInput`
- [x] Хуки вынесены: `useProjects`, `useWorkTemplates`
- [x] Начальные данные вынесены в `src/data/initialData.ts`

### Фаза 2: Исправление багов — ВЫПОЛНЕНО

- [x] Stale closure исправлен
- [x] CSV экспорт исправлен
- [x] Порты унифицированы
- [x] Все `any` заменены на конкретные типы (проверено поиском)

### Зависимости

- [x] **Мёртвые зависимости** — `@google/genai`, `better-sqlite3`, `express`, `dotenv`, `motion` удалены ✅

### Шаблоны работ

- [x] **`CATEGORY_LABELS` в модальном окне** — исправлено, импортируется из `workTemplate.ts` ✅
- [x] **`index.ts` бочки обновлены** ✅

---

## 🚧 В работе / Следующие задачи

### Фаза 2.1: Исправление критических багов (BUGFIX_EXTENDED_MODE_RESET) — ✅ ВЫПОЛНЕНО

- [x] **Баг сброса данных в расширенном режиме (BUGFIX_EXTENDED_MODE_RESET.md)** — ✅ Исправлено 2026-03-07
  - [x] Рефакторинг `handleGeometryModeChange` в `useGeometryState.ts` (functional update)
  - [x] Защита от сохранения "нулевых" данных в `simpleModeData`
  - [x] Рефакторинг всех хендлеров в `useGeometryState.ts` на functional updates (`updateRoomById`)
  - [x] Исправление обновления высоты в `GeometrySection.tsx` (functional update)
  - [x] Все существующие тесты проходят (175 тестов)

### Фаза 3: Улучшение архитектуры — ВЫПОЛНЕНО ✅

- [x] **3.1** Создать интерфейс `IStorageProvider` для абстракции storage ✅
- [x] **3.2** Добавить React Error Boundaries ✅
- [x] **3.3** Вынести глобальное состояние в Context API (решить prop drilling) ✅
- [x] **3.4** Добавить `React.memo` для тяжёлых компонентов ✅
  - `RoomListItem`, `WorkListItem`, `SummaryView`, `NumberInput`

### Фаза 4: Тестирование (1 неделя)

- [x] **4.1** Unit-тесты для utils (geometry.ts, costs.ts, storage.ts) ✅ 113 тестов
- [x] **4.2** Unit-тесты для хуков (useProjects, useWorkTemplates) ✅ 33 теста
- [x] **4.3** Integration тесты для полного flow ✅ 4 теста (базовое покрытие)
- [x] **4.4** Расширение E2E тестов (экспорт/импорт, шаблоны) ✅ 16 тестов
  - room-input.spec.ts: 3 теста
  - export-import.spec.ts: 6 тестов
  - work-templates.spec.ts: 7 тестов

---

## ⚠️ Замечания (Warnings) — Низкий приоритет

### Архитектура

- [x] **Prop drilling** — ✅ Исправлено: React Context (`ProjectProvider`, `WorkTemplateProvider`)

- [x] **Дублирование логики обновления** — ✅ Исправлено: созданы generic-хелперы в `src/utils/roomHelpers.ts`. Хук `useGeometryState` использует чистые функции для обновления данных.

### Типизация

- [x] **Скрытые `any` в `RoomEditor`** — ✅ Исправлено: используются `WorkTemplate` и `SaveResult`

### Мелкие улучшения (Nitpicks)

- [x] **Импорт типов из `App.tsx`** — ✅ Все компоненты используют `../../types`
- [x] **`confirm()` в модалке удаления** — ✅ Заменён на `ConfirmDialog` с анимацией
- [x] **Отсутствие анимации модального окна** — ✅ Добавлены CSS анимации `fade-in`, `scale-in`
- [x] **`sessionStorage` для `isGeometryCollapsed`** — ✅ Реализовано в `useGeometryState.ts`

---

## 🚀 Выполненные работы (2026-03-09)

### ✅ Вариант А: Технический долг

- [x] **А.1** Generic-хелперы в `src/utils/roomHelpers.ts` — уже существуют
- [x] **А.2** Решение: архитектура функциональных обновлений несовместима с чистыми функциями

### ✅ Вариант Б: Улучшение покрытия тестами

- [x] **Б.1** Добавлены тесты для `roomHelpers.test.ts` — 38 тестов
- [x] **Б.2** Всего тестов: 213 (было 175)

### ✅ Исправление багов

- [x] **Rules of Hooks** — исправлен в `App.tsx` (useEffect перемещён выше условного возврата)

---

## 🚀 Фаза 6: Каталог материалов и расчёт — ✅ ВЫПОЛНЕНО

**Спецификация:** [MATERIALS_CATALOG_FEATURE.md](./MATERIALS_CATALOG_FEATURE.md)

### Этап 1-3: Типы данных, утилиты, каталог — ✅ ВЫПОЛНЕНО

- [x] **1.1** Обновить `Material` в `src/types/workTemplate.ts`
- [x] **1.2** Добавить `MaterialTemplate`, `WorkTemplateCatalog`, `ToolTemplate`
- [x] **2.1** Создать `src/utils/materialCalculations.ts` с 5 формулами расчёта
- [x] **2.2** Unit-тесты для формул расчёта (40+ тестов)
- [x] **3.1** Создать `src/data/workTemplatesCatalog.ts` с 19 типовыми работами
  - Пол: 4 работы (ламинат, плитка, линолеум, стяжка)
  - Стены: 6 работ (обои, покраска, штукатурка, шпаклёвка, плитка, панели)
  - Потолок: 3 работы (покраска, натяжной, ГКЛ)
  - Проёмы: 3 работы (дверь, окно, откосы)
  - Дополнительно: 3 работы (демонтаж, электрика, сантехника)

### Этап 4: UI выбора из каталога — ✅ ВЫПОЛНЕНО

- [x] **4.1** Создать `WorkCatalogPicker.tsx` (модальное окно)
- [x] **4.2** Фильтр по категориям (пол/стены/потолок/проёмы/другое)
- [x] **4.3** Поиск по названию работы
- [x] **4.4** Карточки работ с превью материалов и инструментов
- [x] **4.5** Интеграция в `RoomEditor.tsx` (кнопка "📋 Из каталога")
- [x] **4.6** Integration-тесты (15 тестов)

### Этап 5: UI расчёта материалов — ✅ ВЫПОЛНЕНО

- [x] **5.1** Создать `MaterialCalculationCard.tsx` ✅
- [x] **5.2** Создать `PaintMaterialCard.tsx` (поддержка слоёв) ✅
- [x] **5.3** Создать `TileMaterialCard.tsx` (расчёт плитки) ✅
- [x] **5.4** Хук `useMaterialCalculation` ✅
- [x] **5.5** Интеграция в RoomEditor (импорты добавлены) ✅
- [x] **5.6** Unit-тесты для компонентов ✅ (12 тестов)

### Этап 6: Расширенная общая смета — ✅ ВЫПОЛНЕНО

- [x] **6.1** Создать `src/components/summary/SummaryMaterials.tsx` ✅
- [x] **6.2** Создать `src/components/summary/SummaryTools.tsx` ✅
- [x] **6.3** Создать `src/components/summary/SummaryWorks.tsx` ✅
- [x] **6.4** Обновить `SummaryView.tsx` ✅

### Этап 7: Поиск цен через Gemini — ✅ ВЫПОЛНЕНО

- [x] **7.1** Создать `src/api/prices/types.ts` ✅
- [x] **7.2** Создать `src/api/prices/priceCache.ts` ✅
- [x] **7.3** Создать `src/api/prices/geminiPriceSearch.ts` ✅
- [x] **7.4** Создать `src/api/prices/index.ts` ✅
- [x] **7.5** Тесты для API (22 теста) ✅
- [x] **7.6** UI кнопки "Найти цену" в MaterialCalculationCard ✅
- [x] **7.7** Добавить поле `city` в настройки проекта ✅

---

## 🔮 Будущие задачи

### Фаза 8: Служба обновления баз данных (Update Service) — НОВАЯ

**Спецификация:** [UPDATE_SERVICE_SPEC.md](./UPDATE_SERVICE_SPEC.md)

#### Этап 8.1: Основа (Фаза 1 спецификации) — ❌ Не начато

- [ ] **8.1.1** Создать миграцию для таблиц Update Service
  - [ ] `price_sources` — источники цен (AI, web scrapers, API)
  - [ ] `price_catalog` — каталог цен с индексами
  - [ ] `price_history` — история изменений цен
  - [ ] `update_jobs` — задачи обновления
  - [ ] `update_job_items` — детализация по элементам
  - [ ] `update_job_params` — параметры задач
  - [ ] `update_job_locks` — блокировки для конкурентности
- [ ] **8.1.2** Создать репозитории
  - [ ] `server/src/db/repositories/priceCatalog.repo.ts`
  - [ ] `server/src/db/repositories/priceHistory.repo.ts`
  - [ ] `server/src/db/repositories/updateJob.repo.ts`
- [ ] **8.1.3** Реализовать базовый Runner (`runner.ts`)
- [ ] **8.1.4** Реализовать API endpoints (`routes/update.ts`)
  - [ ] `POST /api/update/run` — запуск обновления
  - [ ] `GET /api/update/status/:jobId` — статус задачи
  - [ ] `GET /api/update/jobs` — история задач
  - [ ] `POST /api/update/cancel/:jobId` — отмена задачи
  - [ ] `POST /api/update/retry/:jobId` — повтор задачи
- [ ] **8.1.5** Реализовать блокировки (`update_job_locks`)

#### Этап 8.2: AI-парсеры (Фаза 2 спецификации) — ❌ Не начато

- [ ] **8.2.1** Gemini Parser (`gemini.ts`) — адаптация клиентского кода
- [ ] **8.2.2** Mistral Parser (`mistral.ts`)
- [ ] **8.2.3** Parser Manager (`parserManager.ts`) — выбор провайдера
- [ ] **8.2.4** Интеграция Circuit Breaker (уже готов в `parsers/circuitBreaker.ts`)
- [ ] **8.2.5** Интеграция Rate Limiter (уже готов в `parsers/rateLimiter.ts`)

#### Этап 8.3: Web Scraper парсеры — ✅ Частично выполнено

- [x] **8.3.1** Types & Interfaces (`parsers/types.ts`) ✅
- [x] **8.3.2** Circuit Breaker (`parsers/circuitBreaker.ts`) ✅
- [x] **8.3.3** Rate Limiter (`parsers/rateLimiter.ts`) ✅
- [x] **8.3.4** Bazavit Parser (`parsers/bazavitParser.ts`) ✅
- [x] **8.3.5** Lemana Parser (`parsers/lemanaParser.ts`) ✅
- [ ] **8.3.6** Web Scraper Aggregator (`webScraper.ts`) — объединение источников

#### Этап 8.4: Оптимизации (Фаза 3 спецификации) — ❌ Не начато

- [ ] **8.4.1** Кэширование результатов (Redis/in-memory)
- [ ] **8.4.2** Batch-обработка для параллелизма
- [ ] **8.4.3** Валидация аномалий цен
- [ ] **8.4.4** Приоритетная очередь задач

#### Этап 8.5: Scheduler (Фаза 4 спецификации) — ❌ Не начато

- [ ] **8.5.1** Интеграция node-cron
- [ ] **8.5.2** Конфигурация через env переменные
- [ ] **8.5.3** Обработка retry при сбоях
- [ ] **8.5.4** Circuit Breaker для планировщика

#### Этап 8.6: Мониторинг (Фаза 5 спецификации) — ❌ Не начато

- [ ] **8.6.1** Health check endpoint (`GET /api/update/health`)
- [ ] **8.6.2** Метрики (`GET /api/update/metrics`)
- [ ] **8.6.3** Логирование в БД
- [ ] **8.6.4** Dashboard (Grafana, опционально)

#### Этап 8.7: Дополнительные возможности (Фаза 6 спецификации) — ❌ Не начато

- [ ] **8.7.1** Вебхуки для уведомлений
- [ ] **8.7.2** Экспорт цен (CSV/XLSX/JSON)
- [ ] **8.7.3** Импорт цен из файла
- [ ] **8.7.4** A/B тестирование парсеров
- [ ] **8.7.5** Аудит действий администраторов

#### Оценка времени

| Этап | Часы | Дни (8ч) | Статус |
|------|------|----------|--------|
| 8.1 Основа | 15 | ~2 | ❌ |
| 8.2 AI-парсеры | 15 | ~2 | ❌ |
| 8.3 Web Scrapers | 8 | ~1 | 🟡 70% |
| 8.4 Оптимизации | 12 | ~1.5 | ❌ |
| 8.5 Scheduler | 7 | ~1 | ❌ |
| 8.6 Мониторинг | 11 | ~1.5 | ❌ |
| 8.7 Дополнительно | 16 | ~2 | ❌ |
| **Всего** | **84** | **~11** | **~15%** |

---

### Фаза 7: Миграция на базу данных — ПОДРОБНОЕ ТЗ

**Полное ТЗ:** [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)

#### Фаза 7.1: Подготовка сервера (3-4 дня) — ✅ ВЫПОЛНЕНО

- [x] **7.1.1** Создать структуру `server/` с TypeScript
- [x] **7.1.2** Настроить Express + middleware (cors, errorHandler)
- [x] **7.1.3** Настроить MySQL connection pool (mysql2/promise)
- [x] **7.1.4** Создать Knex-миграции для всех таблиц (14 таблиц)
- [x] **7.1.5** Написать репозитории (UserRepository, ProjectRepository, RoomRepository, WorkRepository)
- [x] **7.1.6** Добавить zod-схемы валидации для всех входных данных

#### Фаза 7.2: Аутентификация (2-3 дня) — ✅ ВЫПОЛНЕНО

- [x] **7.2.1** Реализовать регистрацию (POST /api/auth/register)
- [x] **7.2.2** Реализовать вход (POST /api/auth/login)
- [x] **7.2.3** Реализовать JWT middleware
- [x] **7.2.4** Создать AuthContext на клиенте
- [x] **7.2.5** Создать страницы Login/Register
- [x] **7.2.6** Добавить защиту роутов (PrivateRoute)

#### Фаза 7.3: CRUD для проектов (3-4 дня) — ✅ ВЫПОЛНЕНО

- [x] **7.3.1** GET /api/projects — список проектов пользователя
- [x] **7.3.2** POST /api/projects — создать проект
- [x] **7.3.3** GET /api/projects/:id — получить проект с вложениями
- [x] **7.3.4** PUT /api/projects/:id — обновить проект
- [x] **7.3.5** DELETE /api/projects/:id — удалить проект
- [x] **7.3.6** Реализовать ApiStorageProvider на клиенте
- [x] **7.3.7** Интегрировать в ProjectContext

#### Фаза 7.4: CRUD для комнат и работ (2-3 дня)

- [ ] **7.4.1** Все CRUD для rooms
- [ ] **7.4.2** Все CRUD для works, materials, tools
- [ ] **7.4.3** Все CRUD для геометрии (openings, subsections, segments, obstacles, wall_sections)
- [ ] **7.4.4** Drag-and-drop сортировка (rooms/order, works/order)

#### Фаза 7.5: Offline-first (2-3 дня)

- [ ] **7.5.1** Установить idb (IndexedDB wrapper)
- [ ] **7.5.2** Реализовать OfflineQueue для хранения изменений
- [ ] **7.5.3** Реализовать POST /api/sync/push
- [ ] **7.5.4** Реализовать GET /api/sync/pull
- [ ] **7.5.5** Добавить детекцию online/offline статуса
- [ ] **7.5.6** UI-индикатор синхронизации

#### Фаза 7.6: AI-интеграция (3-4 дня)

- [ ] **7.6.1** Абстрактный AIProvider интерфейс
- [ ] **7.6.2** GeminiProvider (@google/genai)
- [ ] **7.6.3** MistralProvider (@mistralai/mistralai)
- [ ] **7.6.4** POST /api/ai/estimate
- [ ] **7.6.5** POST /api/ai/suggest-materials
- [ ] **7.6.6** Кэширование ответов в ai_requests

#### Фаза 7.7: Тестирование (2-3 дня)

- [ ] **7.7.1** Unit-тесты для сервера (Jest + Supertest)
- [ ] **7.7.2** Integration-тесты API

**Итого: 15-20 рабочих дней**

---

### Фаза 9: PWA (Опционально) — 2-3 дня

**Цель:** Сделать приложение устанавливаемым и работающим офлайн

- [ ] **9.1** Установить vite-plugin-pwa
- [ ] **9.2** Настроить service worker
- [ ] **9.3** Создать иконки (192, 512, maskable)
- [ ] **9.4** Протестировать offline-режим
- [ ] **9.5** Тестировать установку на мобильных устройствах

---

## 📈 Метрики успеха

| Метрика | Было | Стало | Целевое |
|---------|------|-------|---------|
| Размер App.tsx | ~2700 строк | ~170 строк | <300 строк ✅ |
| Покрытие тестами | ~5% | ~50% (402 теста) | >60% 🟡 |
| Типизация (any) | 3 места | 0 | 0 ✅ |

### Статистика тестов:
- **Unit тесты (utils):** 220 тестов (включая materialCalculations: 40+)
- **Unit тесты (hooks):** 72 теста
- **Integration тесты:** 7 тестов
- **API тесты:** 22 теста
- **E2E тесты:** 16 тестов
- **Итого:** 402 теста ✅

---

**См. также:** [CODE_REVIEW.md](./CODE_REVIEW.md), [ARCHITECTURE.md](./ARCHITECTURE.md)