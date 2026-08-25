# AGENTS.md — контекст проекта для ИИ-агента

> **Прочитай этот файл целиком перед началом работы.** Здесь — что это за проект, как он устроен, какие команды запускать и где что искать. Живой журнал изменений — в `INDEX.md` и `devAI/developer_log.md`; **обновляй их после правок** (регламент — `docs/AI_DOCUMENTATION_GUIDELINES.md`).

## 1. О проекте

**Repair Calculator** — калькулятор стоимости ремонта: проекты/объекты/комнаты, 3 режима геометрии, AI-поиск цен (Gemini/Mistral через серверный прокси), экспорт смет в Excel/CSV, JWT-аутентификация, автосохранение в localStorage + синхронизация через API.

- **Домен:** утилиты / расчёты
- **Версия:** 2.0 (из `INDEX.md`)

## 2. Стек технологий

| Слой      | Технология                                                                            |
| --------- | ------------------------------------------------------------------------------------- |
| Frontend  | React + TypeScript + Vite                                                             |
| Стили     | Tailwind CSS                                                                          |
| Состояние | Context API + hooks (`src/contexts/`, `src/hooks/`)                                   |
| Backend   | Express + Zod (валидация)                                                             |
| ORM/БД    | Knex (query builder) + PostgreSQL                                                     |
| AI        | Gemini + Mistral — серверный прокси (`server/services/`, ключи НЕ в клиентский бандл) |
| Тесты     | Vitest (unit) + Playwright (e2e)                                                      |
| Линт      | ESLint + Prettier + dependency-cruiser                                                |
| Деплой    | Docker (docker-compose) + `scripts/deploy-local.sh`                                   |

## 3. Структура проекта

```
repair-calc/
├── src/                      # FRONTEND (React + TS)
│   ├── components/           # По доменам: auth, geometry, layout, objects, projects, rooms, works, summary, ui
│   ├── contexts/             # AuthContext, WorkTemplateContext
│   ├── data/                 # initialData, workTemplatesCatalog
│   ├── hooks/                # useGeometryState, useMaterialCalculation, useProjects, useWorkTemplates
│   ├── api/                  # API-клиенты (auth, httpClient, objects, projects, rooms, totals, users, storage/, prices/)
│   ├── types/                # index (ProjectData, ObjectData, RoomData...), auth, storage, workTemplate
│   ├── utils/                # costs, geometry, format, idMapper, localStorageProvider, logger, migration, factories
│   └── App.tsx
├── server/                   # BACKEND (Express + Knex)
│   ├── routes/               # HTTP-обработчики (update, ab-test.routes, room.repo...)
│   ├── services/             # Бизнес-логика + AI-прокси
│   ├── repositories/         # Доступ к данным (room.repo и др.)
│   ├── middleware/           # auth, rate-limit, error-handler
│   ├── schemas/              # Zod-схемы валидации
│   ├── dist/                 # Скомпилированный бэкенд (НЕ в git)
│   ├── index.js              # Точка входа Express
│   └── worker.js             # Фоновый воркер
├── server/src/db/            # Knex: db.ts, pool.ts, migrations/, repositories/
├── tests/                    # Vitest (unit)
├── e2e/                      # Playwright
├── shared/                   # Типы/утилиты, общие для frontend и backend
├── docs/                     # ARCHITECTURE, CODE_REVIEW, LOGGING, PROGRESS, AI_DOCUMENTATION_GUIDELINES
├── devAI/                    # SDD-флоу: spec/, PLANNING.md, developer_log.md (см. раздел 13)
├── scripts/                  # deploy-local.sh, docker-rebuild, monitor
└── INDEX.md                  # Главный живой индекс (обновляй после ЛЮБЫХ изменений!)
```

## 4. Команды

| Команда                         | Что делает                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                   | Dev-сервер: frontend http://localhost:3993, backend http://localhost:3994     |
| `npm run build`                 | Production-сборка (только анализ, **НЕ для деплоя** — для деплоя Docker!)     |
| `npm test`                      | Unit-тесты (Vitest)                                                           |
| `npm run test:e2e`              | E2E-тесты (Playwright)                                                        |
| `npm run lint`                  | TypeScript-проверка + ESLint                                                  |
| `npm run lint:deps`             | **dependency-cruiser** — проверка архитектуры зависимостей (src + server/src) |
| `npm run migrate` (в `server/`) | Knex-миграции (migrate:latest)                                                |
| `./scripts/deploy-local.sh`     | **Единственный способ деплоя**: тесты + линтер + Docker-сборка                |

## 5. Порты и окружение

- **Frontend:** http://localhost:3993
- **Backend:** http://localhost:3994

### Переменные окружения (`.env`, **НЕ коммитить**)

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...          # ≥32 символа
JWT_REFRESH_SECRET=...
GEMINI_API_KEY=...             # AI — ТОЛЬКО на сервере
MISTRAL_API_KEY=...            # AI — ТОЛЬКО на сервере
```

Эталон — `.env.example`. Секреты никогда не класть в код и не отправлять в git.

## 6. Режим разработки (Hybrid Dev Scheme — ВАЖНО)

Для мгновенной отладки и HMR используется гибридная схема:

- **БД и бэкенд** крутятся в Docker (`docker compose up -d db backend migrate`).
- **Фронтенд** разрабатывается **локально** без Docker.

**Действия при старте задачи по фронтенду:**

1. Останови фронтенд в Docker, чтобы освободить порт 3993: `docker compose stop frontend`.
2. Запусти локально: `npm run dev`.

**Строгие правила деплоя (Multi-Stage Docker):**

- **Никогда** не используй `npm run build` локально для релиза (соберёт файлы только на хосте).
- Production-проверка: `./scripts/deploy-local.sh` (линтеры, тесты, `docker compose build --no-cache`).
- Ручной перезапуск прод-образа: `docker compose up -d --build frontend`.

**Docker / Инфраструктура**

- **Всегда** указывай `container_name` и политику `restart: unless-stopped` для всех сервисов в `docker-compose.yml`, чтобы избежать плодящихся безымянных контейнеров.

## 7. Архитектурные конвенции

**Frontend**

- Компоненты — по доменам в `src/components/<Domain>/`.
- Состояние — React Context (`src/contexts/`: AuthContext, WorkTemplateContext) + hooks.
- Storage abstraction: `src/api/storage/` (apiStorageProvider через REST) + `src/utils/localStorageProvider.ts`. Данные автосохраняются в localStorage (1с debounce) + синхронизация с сервером при авторизации.
- API-вызовы — через `src/api/` (httpClient с interceptors/retry/timeout).

**Backend**

- Слои: `routes` → `services` → `repositories` (Knex изолирован в `server/src/db/repositories/`).
- Валидация входа — Zod-схемы в `server/src/middleware/validation.ts` (проекты/общие) и `server/src/routes/update/schemas.ts` (update-сервисы).
- Логирование сервера — winstonLogger (`server/src/middleware/logger.ts`).
- AI-поиск цен: клиент `src/api/prices/` → серверный прокси `/api/ai/search-price` → Gemini/Mistral. Ключи только на сервере.

## 8. Правила работы агента

Перед правками:

- [ ] Остановлен dev-сервер (`Ctrl+C`)
- [ ] Прочитан этот файл и `INDEX.md`

После ЛЮБЫХ изменений:

- [ ] `npm test` — тесты зелёные
- [ ] `npm run lint` — без ошибок типов/линта
- [ ] `npm run lint:deps` — без нарушений архитектуры
- [ ] Обновлён `INDEX.md` (новые файлы, изменённые типы, зависимости, архитектура)
- [ ] Секреты остались в `.env`

**Не трогать:** `node_modules/`, `dist/`, `server/dist/`, `server/node_modules/`, `.vite/`, `coverage/`, `playwright-report/`.

## 9. Где что искать (навигация)

| Хочу изменить...             | Иду в...                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| HTTP-маршрут                 | `server/src/routes/`                                                               |
| Бизнес-логику                | `server/services/`                                                                 |
| Запрос к БД                  | `server/src/db/repositories/` + `server/src/db/db.ts` (Knex)                       |
| Экран/UI                     | `src/components/<Domain>/`                                                         |
| Состояние (Context)          | `src/contexts/`                                                                    |
| Хук логики                   | `src/hooks/`                                                                       |
| API-клиент                   | `src/api/`                                                                         |
| Хранилище (localStorage/API) | `src/api/storage/`, `src/utils/localStorageProvider.ts`                            |
| Типы (общие)                 | `src/types/`, `shared/`                                                            |
| Расчёт стоимости/геометрии   | `src/utils/costs.ts`, `src/utils/geometry.ts`, `src/utils/materialCalculations.ts` |
| AI-поиск цен                 | `src/api/prices/` (клиент), `server/services/` (прокси)                            |
| Валидацию                    | `server/src/middleware/validation.ts` (Zod)                                        |

## 10. Git-конвенции (разработка через ИИ-агентов)

**Ветвление:** `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/...`, `chore/...`. Одна задача — одна ветка.
**Коммиты:** small atomic. Одно изменение — один коммит. Conventional Commits (есть commitlint + husky).

- **Никогда не коммить код, который не можешь объяснить.**
- ИИ-коммиты: trailer `Co-Authored-By: <инструмент>` для атрибуции.
  **Перед слиянием:** PR → ревью → merge.

## 11. Plan-then-execute

**Правило:** задача >3 файлов или меняет архитектуру → **сначала план**. В этом проекте уже есть SDD-флоу (см. раздел 13) — крупные задачи оформляй через `devAI/spec/` (как уже принято), средние — через `docs/plan-<feature>.md`.

## 12. Cross-model review

Код пишет одна модель → ревьюит другая (или человек). AI-код внешне убедителен, скрывает дефекты. PR → review-промпт в другой модели → merge после «looks good».

## 13. SDD-флоу (devAI/) — ПРИОРИТЕТ для крупных задач

Проект уже использует собственный Spec-Driven флоу в `devAI/`:

- `devAI/spec/SPEC-NNN-*.md` — спецификации (SYSTEM, E2E-REPAIR, STABILIZATION, CRITICAL-FIXES)
- `devAI/PLANNING.md` — планирование
- `devAI/developer_log.md` — **append-only** лента работы агента

**Регламент:** см. `docs/AI_DOCUMENTATION_GUIDELINES.md`. **НЕ плодить** `*_SPEC/*_TASK/*_PLAN.md` в `/docs/` — всё крупное идёт в `devAI/`. Временное планирование — в `~/.gemini/antigravity/brain` (если используешь Antigravity).

## 14. Известные ограничения и грабли

- `dist/` компилируется **внутри Docker** (Multi-Stage), не маунтится снаружи — локальный `npm run build` не равен деплою.
- localStorage и сервер могут расходиться — есть миграции (`src/utils/migration.ts`) и idMapper (`src/utils/idMapper.ts`) для маппинга локальных/серверных ID.
- `.env` и `.env.local` в корне — не коммитить (правило в `.gitignore`).
