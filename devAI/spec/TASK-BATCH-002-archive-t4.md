# TASK-BATCH-002-archive-t4 (UI «Архив» в настройках проекта)

**Назначено:** designer (логика экшенов — из batch-001) **Подветка:** feat/archive-t4-batch-002
**Зависит от:** TASK-BATCH-001 **Статус:** ⬜

## Цель (проверяемая)

В настройках проекта доступна секция «Архив»: список архивных проектов (имя, дата
архации, счётчики объектов/комнат), кнопки «Восстановить» и «Удалить навсегда»
(ConfirmDialog, для удаления — ввод имени проекта). Гостевой режим — секция скрыта.
Компонентные тесты зелёные.

## Read

- `src/store/createProjectSlice.ts` — экшены из TASK-BATCH-001 (`fetchArchivedProjects`, `restoreProject`, `permanentDeleteProject`)
- `src/components/projects/` — существующий ProjectSettings и паттерны компонентов домена
- `src/components/ui/` — существующий ConfirmDialog/кнопки/инпуты (переиспользовать, не дублировать)
- `src/contexts/AuthContext.tsx` — только чтение флага авторизации (isAuthenticated)
- Типы проекта: `src/types/` (поля archived_at/deleted_at — сверить с `server/src/db/repositories/project.repo.ts`)

## Write (ЭКСКЛЮЗИВНО)

- `src/components/projects/ArchivePanel.tsx` — новый компонент (≤400 строк, функции ≤60).
- Точка монтирования: существующий компонент настроек проекта (минимальная правка — вставка секции).
- `tests/components/` — тесты ArchivePanel.
- `INDEX.md`, `devAI/developer_log.md`.

## Алгоритм (псевдокод)

```
ArchivePanel:
  useEffect(mount): if (isAuthenticated) store.fetchArchivedProjects()
  render:
    if (!isAuthenticated) return null        // гостевой режим — скрыто
    list = store.archivedProjects
    if (empty) → пустое состояние с текстом
    row: name | archivedAt.format('dd.MM.yyyy') | objects/rooms counts
         [Восстановить] [Удалить навсегда]
  restore:
    await store.restoreProject(id); обновить список; toast
  permanent:
    ConfirmDialog → input имени; кнопка активна только при точном совпадении имени
    await store.permanentDeleteProject(id); обновить список; toast
  ошибки (409/400/сеть) → inline-сообщение в панели, не alert()
```

## Edge-кейсы

- Загрузка списка: skeleton/spinner, обработка ошибки загрузки (retry-кнопка).
- Повторный клик по «Восстановить»/«Удалить» во время запроса — блокировать (disabled по pending-флагу).
- Имя проекта с пробелами/регистром: сравнение после `trim()`, регистронезависимо? — НЕТ, регистрозависимо (пояснить в тесте).
- Стейт после restore: проект исчезает из списка архива (появится в общем списке после refresh/pull).
- Unmount во время запроса — без setState после unmount (cleanup/AbortController не обязателен для store-экшенов, но не рендерить по resolution на размонтированном компоненте).

## Логирование

Клиент — `src/utils/logger.ts` (info/warn, без PII).

## Запреты

- Новых API-вызовов из компонента — только store-экшены batch-001.
- Компоненты ≤400 строк;Tailwind-классы по существующим паттернам; хардкод-строки в JSX — через i18n/константы по образцу домена.
- `as any`/`@ts-ignore` — запрещены.

## DoD

- [ ] pnpm test (вкл. компонентные) / pnpm run lint / pnpm run lint:deps зелёные
- [ ] Гостевой режим: секция скрыта (тест)
- [ ] ConfirmDialog с вводом имени (тест на несовпадение имени)
- [ ] INDEX.md + developer_log.md обновлены

## Эскалация

Неоднозначность → к архитектору. 2 провала одного gate → к человеку.
