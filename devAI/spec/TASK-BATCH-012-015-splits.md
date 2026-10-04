# TASK-BATCH-012-split-storage

**Назначено:** coder **Подветка:** refactor/split-storage-012 **База:** fix/hygiene-011 **Статус:** ⬜

## Цель (P3-1)

`src/api/storage/apiStorageProvider.ts` (995 строк) распилен на модули ≤400 строк: `apiClient.ts` (httpClient-обвязка/аутентификация/ретраи), `projectApi.ts`, `objectApi.ts`, `roomApi.ts`; публичный API провайдера (экспортируемый интерфейс) НЕ меняется — импортёры не правятся. `require()` → ESM-импорт. Gates зелёные, поведение подтверждено существующими тестами (если тестов на провайдер нет — добавить минимальный smoke по текущему публичному API до распила, чтобы после распила они прошли).

## Write (ЭКСКЛЮЗИВНО)

src/api/storage/**, tests/** (новые smoke-тесты), INDEX.md, devAI/developer_log.md, docs/TODO.md (P3-1 строка).

## Запреты

НЕ менять контракты/URL/форматы запросов; допустимы только внутренние перестановки + re-export фасада из index.ts.

## DoD

- [ ] Каждый новый файл ≤400; экспортный фасад нетронут; smoke-тесты зелёные до/после; gates зелёные.

# TASK-BATCH-013-split-ui

**Назначено:** coder **Подветка:** refactor/split-ui-013 **База:** refactor/split-storage-012 **Статус:** ⬜

## Цель (P3-1)

(1) `src/components/BackupManager.tsx` (898) → ExportPanel + ImportPanel + SyncPanel (+ тонкий контейнер). (2) `src/components/projects/ProjectsModal.tsx` (727) → вынести логику в хук/подкомпоненты (ArchivePanel уже отдельно — не трогать). Публичное поведение UI не меняется; существующие тесты зелёные; для каждого нового компонента — базовый компонентный тест (по образцу ArchivePanel.test.tsx).

## Write (ЭКСКЛЮЗИВНО)

src/components/BackupManager.tsx и его распил, src/components/projects/ProjectsModal.tsx и распил, tests/components/\*\*, INDEX.md, devAI/developer_log.md, docs/TODO.md.

## DoD

- [ ] Все новые файлы ≤400 строк; тесты зелёные; gates зелёные.

# TASK-BATCH-014-split-store-repo

**Назначено:** coder **Подветка:** refactor/split-store-repo-014 **База:** refactor/split-ui-013 **Статус:** ⬜

## Цель (P3-1 + P3-SPLIT)

(1) `src/store/createProjectSlice.ts` (649, маркер SPLIT-ME в первой строке) — вынести архив-экшены в `src/store/createArchiveSlice.ts` (композиция слайсов как в существующем store), маркер снять. (2) `server/src/db/repositories/project.repo.ts` (854) — вынести архивные методы (findArchivedByUserId/restore/hardDelete/findArchivedOlderThan) в `projectArchive.repo.ts` с re-export из project.repo.ts для совместимости импортёров; Knex остаётся внутри repositories.

## Write (ЭКСКЛЮЗИВНО)

src/store/**, server/src/db/repositories/**, tests/\*\* (перенос существующих тестов без ослабления), INDEX.md, devAI/developer_log.md, docs/TODO.md (закрыть P3-SPLIT).

## DoD

- [ ] Маркер SPLIT-ME снят; все файлы ≤400; поведение покрыто прежними тестами без их ослабления; gates зелёные.

# TASK-BATCH-015-e2e-unskip

**Назначено:** coder **Подветка:** test/e2e-unskip-015 **База:** refactor/split-store-repo-014 **Статус:** ⬜

## Цель (P3-4)

Рас-`.skip` E2E-наборы; каждый либо зелёный, либо честно классифицирован (битый тест / требует окружения / реальный регресс).

## Алгоритм

1. Проверить возможность запуска: playwright-браузеры установлены (`pnpm exec playwright --version`; при отсутствии — `pnpm exec playwright install chromium` только если это не сотни МБ проблем; если окружение не позволяет запустить e2e — СТОП, отчёт «не проверялось и почему», ничего не раскомментировать вслепую).
2. Снимать .skip по одному файлу; зелёный — оставить включённым; падение: тривиальный фикс (селектор/ожидание) — правь; подозрение на реальный регресс — вернуть .skip + строка в отчёт с деталями падения.
3. Гонять точечно `pnpm run test:e2e -- <file>`, не весь набор каждый раз; финал — весь набор.

## Write (ЭКСКЛЮЗИВНО)

e2e/\*\*, devAI/developer_log.md, docs/TODO.md (P3-4: что включено/что осталось и почему).

## Запреты

НЕ ослаблять ассерты для «зелёности»; НЕ править код приложения в этом batch'е (реальный регресс — в отчёт, отдельная задача).

## DoD

- [ ] Честный итог: сколько включено, сколько осталось skip с причинами; полное дерево зелёное (pnpm test/lint/lint:deps).
