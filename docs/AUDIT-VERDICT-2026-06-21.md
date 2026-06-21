# 🔍 Архитектурный разбор & Вердикт (Conditional Approve)

**Дата:** 2026-06-21
**Статус:** APPROVE с условиями (Conditional). Рефакторинг — валидный инкремент (устранён god-context, добавлены слайсы и `src/domain/`), но не соответствует `IDEAL-ARCHITECTURE.md`: выполнена лишь часть Фазы 4, Фазы 1/2/3/5 либо пропущены, либо формальны. Главная архитектурная ложь — `createProjectSlice.ts` (609 строк) по-прежнему монолит с 4 ответственностями, а `dep-cruiser` формально зелёный, но не защищает слои.

## Что фактически сделано

- God-context `ProjectContext.tsx` (1006 строк → удалён) → zustand slices
- Слайсы `createProjectSlice` / `createRoomSlice` / `createObjectSlice` / `createSyncSlice`
- Вынос чистой логики в `src/domain/{geometry,pricing,factories}` + тесты
- Декомпозиция `server/routes/update.ts` (2184) → `routes/update/*.ts` (7 файлов)

## Что НЕ сделано vs IDEAL-ARCHITECTURE.md

| Фаза доки                  | Ожидание | Факт (по ФС)                                                                                                                          |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Monorepo                | да       | ❌ монолитный `src/`+`server/`, один корневой `package.json`                                                                          |
| §2 FSD 3 слоя              | да       | ❌ старая группировка `components/hooks/api/utils`                                                                                    |
| §3 packages/domain         | да       | ⚠️ есть `src/domain/`, но не вынесен в пакет; дубликат `factories.ts` ↔ `projectFactory.ts` (клон через `JSON.parse(JSON.stringify)`) |
| §5 enforcing слоёв         | да       | ❌ `.dependency-cruiser.cjs` содержит только 2 правила. Правил FSD-направлений нет.                                                   |
| §6 RBAC admin-guard        | да       | ❌ `jobs.routes.ts`/`webhooks.routes.ts` без `auth`/`admin-guard`                                                                     |
| §7 изолированные сторы     | да       | ❌ `createProjectSlice.ts` (609) смешивает 4 ответственности (домен + auth + sync + persistence)                                      |
| §9 shallow-селекторы       | да       | ❌ 0 использований shallow во всём `src/`                                                                                             |
| §4 SyncManager             | да       | ❌ осталось `scheduleSave` + `JSON.stringify` дифф (явный антипаттерн)                                                                |
| §8 типизированные AppError | да       | ❌ нет `packages/shared-types/errors.ts`                                                                                              |
| Фаза 1 «Гигиена»           | да       | ❌ `window.confirm` живёт в `App.tsx:150`; `e2e-test-mode` в production-пути `App.tsx:226`                                            |

## Blast Radius главных рисков

1. `createProjectSlice.ts` — касается 100% UI. Высокий риск регресса автосохранения.
2. `ab-test.routes.ts` (700 строк) — новый серверный монолит.
3. Дубликат фабрик (`factories.ts` + `projectFactory.ts`) — два источника правды для `cloneProject`.
4. Отсутствие FSD-правил в `dep-cruiser` — структура деградирует дальше.

---

## 📋 Детальное ТЗ (Остаточные задачи)

До апрува без условий необходимо выполнить задачи A, C, D (блокеры консистентности/безопасности), затем B, E, F.

### Задача A — Устранить дубликат фабрик проекта (Блокер консистентности)

- **Файлы:** `src/domain/factories/factories.ts`, `src/domain/factories/projectFactory.ts`
- **Действие:** оставить ОДИН файл `projectFactory.ts`. `factories.ts` удалить.
- **Псевдокод cloneProject:** использовать `structuredClone(src)`. Убедиться, что `Date`/`undefined` не теряются.

### Задача B — Вынести ID-генерацию и createProject из store

- **Источник:** `createProjectSlice.ts:309-367`
- **Цель:** Перенести в `src/domain/project/project.factory.ts`. Store только делегирует.
- **Логирование:** `logUserAction('createProject', {source:'factory'})`.

### Задача C — Разрезать createProjectSlice.ts (Ядро §7)

- **Декомпозиция:**
  - `createProjectSlice.ts` — только домен: projects, activeProject, CRUD.
  - `createSyncSlice.ts` — таймеры, pendingSave, saveQueue, sync fields.
  - `createAuthSlice.ts` — isAuthenticated.
- **Edge:** Гонка таймеров. Алгоритм замены JSON-диффа на `deepEqual` (fast-equals/dequal).

### Задача D — RBAC на admin-эндпоинты (Дефект S2)

- **Файлы:** `jobs.routes.ts`, `webhooks.routes.ts`, `import.routes.ts`, `prices.routes.ts`
- **Действие:** создать `admin-guard.middleware.ts`. Применить `router.use(authMiddleware, adminGuard)` на мутирующих роутах.

### Задача E — Расширить .dependency-cruiser.cjs FSD-правилами

- Добавить: `no-store-to-components`, `no-domain-to-react`.
- Расширить scope `lint:deps` на `server/src`.

### Задача F — Гигиена Phase 1

- `App.tsx:150`, `ObjectsList.tsx:24`: `window.confirm` → `ConfirmDialog`.
- `App.tsx:226`: вынести `e2e-test-mode` detection в `import.meta.env.MODE !== 'production'`.
- Очистить lint warnings.
