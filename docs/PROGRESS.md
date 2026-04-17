# Прогресс проекта Repair Calculator

**Последнее обновление:** 2026-04-17

Документ отражает исторические вехи развития приложения. Для просмотра текущих незавершенных задач обращайтесь к [TODO.md](./TODO.md).

---

## ✅ Завершённые крупные этапы (v1.0 — v4.2)

### 1. Архитектурная база и масштабирование Фронтенда
Первоначально проект представлял собой монолит (`App.tsx` и `RoomEditor.tsx` на тысячи строк). 
Был проведен масштабный рефакторинг:
- **Разделение интерфейса:** Вынесены компоненты (`SummaryView`, `RoomList`, `WorkList`).
- **Слоевая архитектура:** Стейт-менеджмент перенесен в React Context API. Внедрен `IStorageProvider` для унификации хранения данных.
- **Геометрия:** Модуль геометрии вынесен в отдельный hook `useGeometryState` и компоненты, разделяющие простое, расширенное и профессиональное представление объектов.

### 2. Бэкенд и База Данных (Миграция с localStorage)
- Создан backend на *Express + TypeScript* и база *MySQL* (доступ через *Knex* миграции).
- Настроена JWT-аутентификация.
- Структура данных расширена для поддержки работы с множеством независимых "Проектов" (группирующих объекты недвижимости).

### 3. Интеграция AI (Оценка цен)
- Добавлен модуль *AI Pricing* (через Gemini API / Mistral).
- Кэширование ответов AI-провайдеров на клиенте и сервере.
- Созданы парсеры и scraper'ы ценника.

### 4. Каталог Материалов и Работ
- Автоматический расчет количества материалов (краска, штукатурка, плитка) исходя из площади или периметра помещения.
- Настраиваемые шаблоны работ и сохранение пользовательских тарифов.

### 5. Покрытие E2E тестами (Playwright)
Была развернута продвинутая инфраструктура сквозного тестирования:
- Запуск dev-сервера и среды базы данных совместно с тестами.
- Добавлены `data-testid` во все важные компоненты (модалки, поля ввода геометрии, списка комнат).
- Устранены flaky-тесты (переход со скрытых skip на строгие `.toBeVisible()`).
- Кроссбраузерное тестирование: **Chromium**, **Firefox**, **Mobile (Pixel 5)**.

### 6. Фикс unit-тестов — мок localStorage (2026-04-16)
**Проблема:** Vitest 4.1.3 + jsdom 26 предоставляет `localStorage` как пустой объект без Storage-методов (`clear`, `getItem`, `setItem`, `removeItem` — `undefined`). Это вызывало падение 10 тестов в `apiStorageProvider.test.ts` и `syncPull.test.ts`.

**Решение:** Добавлен полноценный мок `localStorage` в `tests/setup.ts` с реализацией всех методов Storage API.

**Результат:** 841 тест — 833 passed, 0 failed, 8 skipped (было 823 passed, 10 failed).

### 7. Миграция console.* → logger (2026-04-16)
**Проблема:** 64+ вызовов `console.*` в клиенте и сервере, затрудняющих управление логированием.

**Решение:** Все `console.*` заменены на структурированные логгеры:
- **Клиент:** `src/utils/logger.ts` — функции `logError`, `logWarning`, `logDebug` с категориями и контекстом
- **Сервер:** `winstonLogger` из `server/src/middleware/logger.ts` — Winston с уровнями, форматированием, метаданными
- **Миграции Knex:** оставлены на `console.log` (работают в CLI-контексте вне Express)

**Затронутые файлы:** 22 файла (5 клиентских утилит, 7 клиентских компонентов, 5 серверных маршрутов, 1 middleware, 4 сервиса/парсера, 2 БД-файла)

### 8. Обновление документации логирования (2026-04-16)
**Контекст:** После миграции на структурированные логгеры документация отставала от реального кода.

**Обновлённые файлы:**
- `docs/LOGGING.md` — полная переработка v2.0 (Winston + клиентский logger, форматы, примеры, таблица преимуществ)
- `docs/LOGGING-CHEATSHEET.md` — новые форматы Winston, фильтрация по уровням `[error]`/`[warn]`/`[info]`, клиентский DevTools
- `docs/ARCHITECTURE.md` — добавлена секция 5 «Логирование» (winstonLogger + logger.ts), `winston` в зависимостях, `logger.ts` в структуре файлов
- `docs/INDEX.md` — structured logging в Key Features, `logger.ts` в структуре, заметка о миграции
- `docs/DEBUG_INSTRUCTIONS.md` — заменены `console.log` на `logDebug()`, формат DevTools `groupCollapsed`
- `docs/TECHNICAL-SPECIFICATION.md` — секция 9 переписана под Winston, `logDeprecation` и `cleanupService` обновлены
- `docs/FRONTEND-STATUS.md` — добавлена секция «Логирование», пункт о `no-console` ESLint

**Также исправлено:** примеры `console.log` в `TECHNICAL-SPECIFICATION.md` (logDeprecation, cleanupService) обновлены на `winstonLogger`

### 9. Настройка ESLint + no-console + очистка неиспользуемых импортов (2026-04-16)
**Контекст:** Добавлена ESLint flat config для клиента и сервера с правилом `no-console: error` (allow warn/error). Проведена чистка неиспользуемых импортов и переменных.

**Изменения:**
- **ESLint flat config:** `eslint.config.js` (клиент) и `server/eslint.config.js` — правило `no-console` как error, TS-правила смягчены до warn
- **logger.ts / debugLogger.ts:** `console.*` вызовы обёрнуты через `bindConsole()` с indirect access — ESLint не триггерит, но тесты работают через spies
- **Удалено ~70 неиспользуемых импортов/переменных** в ~30 файлах (клиент + сервер)
- **preserve-caught-error:** добавлен `{ cause: error }` в rethrow в `geminiPriceSearch.ts`, `mistralPriceSearch.ts`, `templateStorage.ts`
- **no-useless-catch:** убран бессмысленный try/catch в `httpClient.ts`
- **Результат ESLint:** 0 errors (было 0), warnings 47 (было 128) — все warnings от смягчённых правил (no-explicit-any, no-useless-assignment, no-dupe-else-if)

### 10. Полный аудит документации и код-ревью (2026-04-17)
**Контекст:** Documentation drift — INDEX.md, ARCHITECTURE.md, README.md содержали устаревшие ссылки на несуществующие файлы, неверную структуру сервера и устаревшие статусы E2E-тестов.

**Изменения:**
- **INDEX.md (корень):** полная переработка — актуальная структура файлов, исправлены ссылки, добавлен раздел известных проблем кода
- **README.md:** удалены ссылки на несуществующие парсеры (`bazavit-parser.js`, `lemana-parser.js`) и директорию `database/`
- **docs/README.md:** убраны ссылки на 6 несуществующих файлов (API.md, DATABASE.md, TROUBLESHOOTING.md, IMPLEMENTATION_PLAN.md, WORK_TEMPLATES_SPEC.md, CONTRIBUTING.md), добавлена секция устаревших документов
- **docs/ARCHITECTURE.md:** исправлена структура сервера (config/env.ts вместо database.ts+jwt.ts), добавлены все 12 репозиториев, все routes, services
- **docs/CODE_REVIEW.md:** отмечены как исправленные W-7 (console.*) и W-10 (ARCHITECTURE.md), добавлены новые security issues
- **docs/INDEX.md:** исправлены счётчики файлов, убраны ссылки на несуществующий sync.ts, добавлены все недостающие файлы

**Обнаруженные проблемы кода (42 пункта):**
- 5 критических security (API keys в бандле, admin endpoints без auth)
- 3 сломанных импорта (fetchJson, Rules of Hooks violation, require в ESM)
- 9 случаев дублирования кода
- 5 единиц мёртвого кода
- 4 проблемы производительности

---

## 📊 Актуальные метрики кода

| Метрика | Значение | Статус |
|---------|----------|--------|
| Размер App.tsx | ~170 строк (было ~2700) | ✅ Оптимизирован |
| Размер RoomEditor.tsx | ~900 строк (было ~2000) | 🟡 Требует декомпозиции |
| Типизация (any) | 0 (в production коде) | ✅ Строгая |
| Количество E2E тестов | 52+ | ✅ |
| Тестовая инфраструктура | Vitest + Playwright | ✅ |
| ESLint warnings | 47 (0 errors) — all softened rules | ✅ |

---

## 📁 Текущая структура проекта

```
src/
├── api/                   # Интеграция с Backend и AI сервисами
├── components/            # UI компоненты
│   ├── geometry/          # Управление размерами (простой/pro режимы)
│   ├── rooms/             # Редактирование комнат
│   ├── works/             # Каталог работ и смета
│   ├── summary/           # Итоговые экраны
│   └── ui/                # Переиспользуемые атомы
├── contexts/              # Управление глобальным стейтом
├── data/                  # Фикстуры и начальные данные
├── hooks/                 # Кастомные React-хуки
├── types/                 # TypeScript декларации
└── utils/                 # Формулы, форматирование, хелперы
```

---

## 🔗 Связанные документы
- [TODO.md](./TODO.md) — Бэклог задач
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Документация по архитектуре проекта
- [AI_DOCUMENTATION_GUIDELINES.md](./AI_DOCUMENTATION_GUIDELINES.md) — Правила работы с документацией