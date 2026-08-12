# PROGRESS — Завершённые вехи (Repair Calculator)

**Последнее обновление:** 2026-08-12
**Назначение:** лента завершённых вех (по регламенту `AI_DOCUMENTATION_GUIDELINES.md`).
Свежий аудит — [`AUDIT-2026-08-11.md`](./AUDIT-2026-08-11.md); бэклог — [`TODO.md`](./TODO.md); направление — [`INDEX.md` → 🧭 Компас](../INDEX.md).

---

## 2026-08-12 — Нормализация (SPEC-005, Фаза 1+2)

- ✅ **Merge `refactor/architecture-v2` → `main`** (`--no-ff`, `588c76b`): 164 коммита рефактора влиты; `main..refactor = 0`. Долг ~5.5 мес. погашен.
- ✅ **CI активирован** (`.github/workflows/ci.yml` в VCS, `b60b352`): lint + lint:deps + test на push/PR в `main` и `refactor/*`. Первый прогон CI в истории проекта.
- ✅ **Push в origin**: `main` и `refactor/architecture-v2` синхронизированы.
- ✅ **Триаж дерева (BATCH-04)**: 7 «висящих» файлов закоммичены (4 фронт-теста, `migrations.test.ts`, RU-`AGENTS.md`, шаблон плана). Рабочее дерево чистое.
- ⚠️ **BATCH-06 отменён**: `playwright` — runtime-dep сервера (скрейперы цен), перенос в devDeps сломал бы prod. Медленная сборка → отдельная задача по Docker browser-cache.

## 2026-08-11 — Стабилизация и документирование

- ✅ Фикс двойного префикса роутинга (`110f7f0`) + интеграционные тесты (8, mutation-verified).
- ✅ Фикс переносимости vitest (`@shared` → `path.resolve`, `c3a9f4c`).
- ✅ Аудит состояния `AUDIT-2026-08-11.md` (вердикт 🟡), `TODO.md` переписан, `INDEX.md` получил секцию «🧭 Компас».
- ✅ Дрейф документации устранён (`AGENTS.md` Prisma→Knex, `INDEX.md` MySQL→PG, `pool.ts`).

## 2026-06 — Рефактор architecture-v2 (основной объём)

- ✅ Миграция БД MySQL → PostgreSQL + Knex-репозитории (`909efb7`).
- ✅ Состояние: god-context `ProjectContext` → **zustand slices** (`17f13b9`, + `createAuthSlice`).
- ✅ Persistence → **IndexedDB (Dexie)** (`8e40441`); sync push/pull.
- ✅ **i18n** scaffold `react-i18next` (`85f4b4e`).
- ✅ Security: `adminGuard` RBAC + миграция `20260332_add_user_role` (`be33ddb`).
- ✅ Декомпозиция `routes/update.ts` (2184 строки) → модуль `routes/update/` (`175aeb6`).
- ✅ Domain-слой: чистая бизнес-логика в `src/domain` (`c2ef4e8`).
- ✅ Docker multi-stage frontend build; `deploy-local.sh`; husky + dep-cruiser (`lint:deps`).

## 2026-04 — v1–v4.2: базовые фичи

- ✅ Проекты/объекты/комнаты, 3 режима геометрии, AI-поиск цен (серверный прокси), экспорт Excel/CSV, JWT-auth, автосохранение.
- ✅ Миграция `console.*` → структурированные логгеры (winston + `logger.ts`).
- ✅ E2E (Playwright): auth, core-workflow, objects стабилизированы.

---

**См. также:** [TODO.md](./TODO.md) (бэклог), [INDEX.md → 🧭 Компас](../INDEX.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
