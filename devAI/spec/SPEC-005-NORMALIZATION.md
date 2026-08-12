# 📋 SPEC-005-NORMALIZATION — Приведение проекта в норму

**Версия:** 1.0
**Дата создания:** 2026-08-12
**Статус:** Draft (ожидает аппрута владельцем → запуск фаз)
**Автор:** Архитектор-контролёр (AI)
**Base:** `refactor/architecture-v2` @ `6a8dca0`
**Решения владельца:** merge `--no-ff` (сохранить 164 атомарных коммита + явная граница); объём — разблокировка + техдолг (as-any отдельной фазой).

**Связанные документы:** [`docs/AUDIT-2026-08-11.md`](../../docs/AUDIT-2026-08-11.md), [`docs/TODO.md`](../../docs/TODO.md), [`INDEX.md` → 🧭 Компас](../../INDEX.md), [`devAI/spec/SPEC-001-SYSTEM.md`](./SPEC-001-SYSTEM.md).

---

## Содержание

1. [Введение и цель](#1-введение-и-цель)
2. [Текущее состояние (снимок)](#2-текущее-состояние-снимок)
3. [Границы (scope in/out)](#3-границы-scope-inout)
4. [План нормализации — фазы и task-batch'и](#4-план-нормализации--фазы-и-task-batchи)
5. [Карта конфликтов (параллельная безопасность)](#5-карта-конфликтов-параллельная-безопасность)
6. [Критерии приёмки (DoD спеки)](#6-критерии-приёмки-dod-спеки)
7. [Риски и эскалация](#7-риски-и-эскалация)
8. [Порядок исполнения и параллельность](#8-порядок-исполнения-и-параллельность)
9. [Формат отчётности](#9-формат-отчётности)

---

## 1. Введение и цель

`AUDIT-2026-08-11` поставил проекту вердикт **🟡**: кодовая база технически здорова, но
**операционно в долгу**. Эта спецификация — план перевода проекта из 🟡 в 🟢 по всем
измерениям аудита: влить рефактор в `main`, ожить CI, прибрать рабочее дерево, верифицировать
деплой и закрыть накопленный техдолг.

**Главная цель (проверяемая):** на `main` работает CI, `main` содержит всю современную
архитектуру (= `refactor/architecture-v2`), рабочее дерево чистое (или содержит только
осмысленные незавершёнки), деплой актуален, все gates зелёные, документация не дрейфит.

**Не-цели:** новые фичи, декомпозиция монолитов (`RoomEditor`/`BackupManager`/`apiStorageProvider`),
PWA, расширение i18n — отдельные ТЗ.

---

## 2. Текущее состояние (снимок)

| Измерение                                          | Факт                                                                                                                             | Источник                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Коммитов в `refactor/architecture-v2` нет в `main` | **164**                                                                                                                          | `git rev-list --count main..HEAD`                            |
| Объём диффа `main..HEAD`                           | 339 файлов, **+73 060 / −10 286**                                                                                                | `git diff --numstat`                                         |
| Новых файлов                                       | **263 ≈ 62 197 LOC**                                                                                                             | `--diff-filter=A`                                            |
| `main` — прямой предок рефактора?                  | **Да** (`behind=0`) → merge без конфликтов                                                                                       | `git rev-list --count HEAD..main == 0`                       |
| CI в VCS                                           | ⛔ `.github/workflows/ci.yml` **untracked** → ни разу не запускался                                                              | `git status`                                                 |
| Незакоммичено файлов                               | **12** (~540 строк: CI, husky-хуки, скрипты, 4 фронт-теста, `migrations.test.ts`, RU-AGENTS)                                     | `git status`                                                 |
| Не запушено в origin                               | **9 коммитов**                                                                                                                   | `git rev-list --count origin/refactor/architecture-v2..HEAD` |
| Боковые ветки                                      | `master`, `docs/update-architecture`, `feat-material-ctalogue` — **полностью внутри** рефактора (0 потерь)                       | `git rev-list --count HEAD..<branch> == 0`                   |
| Деплой                                             | бэкенд-образ 11.08 (фикс роутинга live, `/api/objects → 401`); фронт-образ 22.06 ≈ код (после — только docs/CI + серверный фикс) | `docker inspect`, curl                                       |
| Gates                                              | 🟢 `npm test` 934+115 · `npm run lint` 0 errors · `npm run lint:deps` 0 violations                                               | AUDIT-2026-08-11 §1                                          |
| npm audit                                          | ⚠️ 9 (2 low, 7 high; `ws`)                                                                                                       | `npm audit`                                                  |
| `playwright`                                       | в `server/dependencies` (не `devDependencies`) → медленные Docker-сборки                                                         | `server/package.json`                                        |

---

## 3. Границы (scope in/out)

**В scope:**

- Влитие `refactor/architecture-v2` → `main` (`--no-ff`).
- Активация CI (commit workflow + husky-хуки + скрипты секрет/трейлер-чек).
- Push в origin.
- Триаж 12 незакоммиченных файлов.
- Верификация деплоя (образы актуальны, live path-matrix).
- Техдолг: `playwright` → `devDependencies`; `npm audit fix`; `server` lint scope → `tests/`;
  выравнивание версий (root `2.0.0` / server `1.0.0`); создание `docs/PROGRESS.md`.
- Типизация: `as any` cleanup (39 warnings) — отдельной фазой.

**Вне scope (отдельные ТЗ):**

- Декомпозиция монолитов (`RoomEditor`, `BackupManager`, `apiStorageProvider`, `createProjectSlice`).
- Мёртвый код (`useProjects.ts`, `projectContextPatch.ts`).
- E2E-распроп (`.skip`-тесты).
- PWA, расширение i18n, тёмная тема, печать сметы.
- `fallow`/SonarQube (отдельная инфра-задача).

---

## 4. План нормализации — фазы и task-batch'и

Каждый batch = ≤5 файлов в write-set, одна измеримая функция, эксклюзивный write-set
(см. §5). Формат соответствует `TASK-BATCH-NNN-<slug>` (роль Архитектора-контролёра).

### Фаза 1 — Разблокировка (P0, последовательна)

#### TASK-BATCH-01 — Активация CI

- **Ветка:** `ci/activate-gate` (от `refactor/architecture-v2`)
- **Цель:** CI запускается на push/PR в `main` и `refactor/*` и прогоняет `lint`+`lint:deps`+`test`.
- **Read:** `.github/workflows/ci.yml` (untracked), `.husky/pre-commit`, `.husky/commit-msg`, `scripts/check-secrets.sh`, `scripts/ai-trailer-check.sh`, `.lintstagedrc.json`
- **Write (EXCLUSIVE):** `.github/workflows/ci.yml`, `.husky/pre-commit`, `.husky/commit-msg`, `scripts/check-secrets.sh`, `scripts/ai-trailer-check.sh`
- **Запреты:** не менять логику хуков (только активация уже написанного); не трогать `package.json`.
- **DoD:** `git status` clean по этим файлам; локально `bash scripts/check-secrets.sh` и `bash scripts/ai-trailer-check.sh` работают (exit 0 на чистом коммите); CI-конфиг валиден.
- **Зависит от:** нет.

#### TASK-BATCH-02 — Push в origin

- **Исполнитель:** Архитектор (git-op, без отдельной ветки).
- **Цель:** `origin/refactor/architecture-v2` содержит все локальные коммиты (9 + будущий BATCH-01).
- **Read/Write:** нет файловых изменений.
- **DoD:** `git rev-list --count origin/refactor/architecture-v2..HEAD == 0`.
- **Зависит от:** BATCH-01 (чтобы CI-коммит тоже уехал).

#### TASK-BATCH-03 — Merge `refactor/architecture-v2` → `main` (`--no-ff`)

- **Исполнитель:** Архитектор.
- **Цель:** `main` содержит всю современную архитектуру; явный merge-коммит маркирует влитие рефактора.
- **Read/Write:** нет файловых изменений (`git checkout main && git merge --no-ff refactor/architecture-v2`).
- **DoD:** `git diff main refactor/architecture-v2` пуст; merge-коммит присутствует; `npm test`+`lint`+`lint:deps` зелёные на `main`; CI-прогон на `main` запущен и зелёный.
- **Зависит от:** BATCH-01, BATCH-02.
- **Риск:** main — прямой предок (0 конфликтов), но проверить `git rev-list --count HEAD..main == 0` непосредственно перед merge.

### Фаза 2 — Триаж и верификация (P1)

#### TASK-BATCH-04 — Триаж оставшихся незакоммиченных файлов

- **Ветка:** `chore/triage-uncommitted`
- **Цель:** рабочее дерево чистое (или содержит только задокументированные незавершёнки).
- **Read:** `git status` (оставшиеся после BATCH-01 файлы).
- **Write (EXCLUSIVE):** `tests/components/SummaryView.header.test.tsx`, `tests/components/SummaryView.project.test.tsx`, `tests/components/layout/LeftSidebar.nav.test.tsx`, `tests/i18n.test.ts`, `server/tests/integration/migrations.test.ts`, `.agents/AGENTS.md`, `docs/_templates/*`
- **Запреты:** не править содержимое тестов (только commit); если тест красный — отремонтировать или `.skip` с пометкой в `developer_log`.
- **DoD:** `npm test` зелёный с подключёнными тестами; `git status` не содержит этих файлов; `INDEX.md` обновлён при изменении структуры.
- **Зависит от:** BATCH-01 (disjoint partition одного дерева).

#### TASK-BATCH-05 — Верификация деплоя

- **Исполнитель:** Архитектор (read-only).
- **Цель:** факт, что запущенный стек соответствует коду `main`.
- **Read:** `docker ps`, `docker inspect ... --format Created`, `curl /api/health`, live path-matrix (`/api/objects` → 401, `/api/auth/login` → 400 и т.д.).
- **Write:** нет (при необходимости — запись в `developer_log`).
- **DoD:** бэкенд-образ датируется после merge; фронт-образ содержит текущий код (или зафиксирован plan по пересборке); все documented-пути отвечают корректно.
- **Параллельно с:** BATCH-04 (disjoint).

### Фаза 3 — Техдолг (P2)

#### TASK-BATCH-06 — Гигиена `server/package.json`

- **Ветка:** `chore/server-deps-hygiene`
- **Цель:** ускорить Docker-сборку бэкенда; покрыть тесты линтом; выровнять версию.
- **Read:** `server/package.json`, `server/Dockerfile`, `server/eslint.config.js`
- **Write (EXCLUSIVE):** `server/package.json`, `server/package-lock.json`
- **Изменения:** `playwright` → `devDependencies`; `lint` → `eslint src/ tests/`; `version` `1.0.0` → `2.0.0` (выровнять с root).
- **DoD:** `npm ci` в server не тянет браузерный тулкит в prod-стадии; `npm run lint` (server) покрывает `tests/`; `npm test` зелёный.
- **Зависит от:** нет (но конфликтует с BATCH-07 → 07 после).

#### TASK-BATCH-07 — `npm audit fix`

- **Ветка:** `chore/audit-fix`
- **Цель:** устранить 7 high / 2 low уязвимости.
- **Read/Write (EXCLUSIVE):** `package-lock.json` (root), `server/package-lock.json`
- **Запреты:** `npm audit fix --force` запрещён (мажорные bumps ломают runtime); только безопасные фиксы.
- **DoD:** `npm audit` → 0 уязвимостей (или обоснованный residual-risk список); `npm test`+`lint` зелёные.
- **Зависит от:** BATCH-06 (оба трогают `server/package-lock.json`).

#### TASK-BATCH-08 — Статусные документы

- **Ветка:** `docs/status-docs`
- **Цель:** регламент (`AI_DOCUMENTATION_GUIDELINES.md`) и TODO ссылаются на существующие файлы.
- **Write (EXCLUSIVE):** `docs/PROGRESS.md` (новый), `docs/FRONTEND-STATUS.md` (новый)
- **DoD:** оба файла созданы с актуальными вехами (миграция на zustand, БД→PG, декомпозиция update.ts, i18n, IndexedDB, RBAC, фикс роутинга 2026-08-11); `docs/TODO.md` ссылается на них без 404.
- **Параллельно с:** BATCH-06, 07 (disjoint).

### Фаза 4 — Типизация (P3, опционально/отдельно)

#### TASK-BATCH-09 — `as any` cleanup

- **Ветка:** `fix/as-any-cleanup` (возможно разбить на подбатчи по файлам)
- **Цель:** 39 `no-explicit-any` warnings → 0 (или обоснованные `eslint-disable`).
- **Write (EXCLUSIVE):** `server/src/routes/update/ab-test.routes.ts`, `server/src/routes/update/jobs.routes.ts`, `server/src/routes/update/import.routes.ts`, `server/src/db/repositories/priceHistory.repo.ts`
- **Запреты:** не `as any`→`as unknown` (равноценный обход); только настоящие типы/интерфейсы (напр. `Request & { user: AuthUser }` вместо `(req as any).user`).
- **DoD:** `npm run lint` → 0 warnings (или каждый residual с `eslint-disable` + комментарием-обоснованием); `npm test` зелёный.
- **Параллельно с:** всеми предыдущими (disjoint — только `server/src/routes/update/`).

---

## 5. Карта конфликтов (параллельная безопасность)

Пересечение write-set'ов **одновременно выдаваемых** batch'ей должно быть ∅.

| Группа | Batch'и    | Конфликт                                        | Решение                                          |
| ------ | ---------- | ----------------------------------------------- | ------------------------------------------------ |
| A      | 01, 04     | ∅ (01=CI/хуки/скрипты; 04=тесты/AGENTS/шаблоны) | можно параллельно, но 04 после 01 (общее дерево) |
| B      | 06, 07     | **server/package-lock.json**                    | **07 строго после 06**                           |
| C      | 06, 08     | ∅                                               | параллельно                                      |
| D      | 09         | ∅ со всеми                                      | параллельно с любой фазой                        |
| E      | 02, 03, 05 | git-op / read-only                              | только Архитектор, последовательно               |

**Допустимая параллель:** после Фазы 1 → {04, 05} ∥; Фаза 3 → {06 → 07}, {08} ∥, {09} ∥ с любой.

---

## 6. Критерии приёмки (DoD спеки)

- [ ] `main` содержит `refactor/architecture-v2` через `--no-ff` merge-коммит; `git diff main refactor/architecture-v2` пуст.
- [ ] CI зелёный на `main` (первый прогон после merge).
- [ ] `origin/refactor/architecture-v2` и `origin/main` запушены.
- [ ] `git status` — дерево чистое (или остатки задокументированы в TODO).
- [ ] Деплой верифицирован: образы актуальны, documented-пути отвечают корректно.
- [ ] `npm test` / `npm run lint` (0 errors, 0 warnings после BATCH-09) / `npm run lint:deps` — зелёные на `main`.
- [ ] `npm audit` → 0 (или residual-risk список).
- [ ] `server/package.json`: `playwright` в `devDependencies`, `version` `2.0.0`, lint покрывает `tests/`.
- [ ] `docs/PROGRESS.md`, `docs/FRONTEND-STATUS.md` созданы; `INDEX.md`/`TODO.md` не содержат 404-ссылок.
- [ ] `devAI/developer_log.md` дописан по каждой фазе; `AUDIT-2026-08-11.md` §1 обновлён до 🟢.

---

## 7. Риски и эскалация

| Риск                                                      | Вероятность                   | Митигация                                                                        |
| --------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| На `main` были hotfix'ы вне рефактора → конфликт merge    | низкая (проверено `behind=0`) | перепроверить `git rev-list --count HEAD..main == 0` перед BATCH-03              |
| Первый прогон CI падает по окружению (cache, версии Node) | средняя                       | BATCH-01 включает отладку первого прогона; фикс — в рамках batch'а               |
| `npm audit fix` ломает runtime                            | средняя                       | только безопасные фиксы (без `--force`); `npm test` обязателен после             |
| `playwright`→`devDependencies` ломает e2e-раннер          | низкая                        | e2e использует корневой `playwright`, не серверный; проверить `npm run test:e2e` |
| `as any` cleanup вносит регрессии                         | средняя                       | BATCH-09 по файлам, каждый — `npm test` + ревью                                  |

**Эскалация:** неоднозначность/конфликт write-set'ов → к Архитектору ДО работы; 2 провала gate по одному пункту → к человеку.

---

## 8. Порядок исполнения и параллельность

1. **Фаза 1 (последовательно):** BATCH-01 → BATCH-02 → BATCH-03. Архитектор координирует, merge — сам.
2. **Фаза 2 (параллельно):** BATCH-04 ∥ BATCH-05.
3. **Фаза 3:** BATCH-06 → BATCH-07; BATCH-08 ∥; (BATCH-09 можно стартовать параллельно с Фазой 3).
4. **Фаза 4:** BATCH-09 (можно разнести по файлам на подбатчи).

Между фазами — ревью Архитектором по чеклисту (механическое + семантическое), merge подветок в `refactor/architecture-v2` (а после BATCH-03 — в `main`).

---

## 9. Формат отчётности

- Каждый batch → подветка `feat/fix/chore/docs/<slug>-batch-NN`, атомарные conventional-коммиты, trailer `Co-Authored-By`.
- На отчёт Исполнителя — полное ревью Архитектора (параноидальная верификация: gates запускаются лично, write-set проверяется `git diff --name-only`, mutation-check где уместно).
- После approve — merge в интеграцию; `developer_log.md` append; `INDEX.md`/`PROGRESS.md` при структурных изменениях.
- Финал: Архитектор сообщает «проект в норме, 🟢»; деплой — за человеком через `./scripts/deploy-local.sh`.

---

**Статус готовности:** Draft. После аппрута владельцем — старт с Фазы 1 (BATCH-01).
