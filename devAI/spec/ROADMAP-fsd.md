# ROADMAP: Переход к IDEAL-ARCHITECTURE (FSD-3 + dirty-flag sync)

> Основа: docs/IDEAL-ARCHITECTURE.md (видение), docs/ARCHITECTURE.md (текущее).
> Принцип: strangler-миграция — новое в целевой структуре, старое переезжает
> по мере касания; в любой точке дерево зелёное (gates + depcruise).

## Слои цели (3, без канонических 7)

```
app/        → монтирование, провайдеры, глобальный сетап (бывш. корень src/)
features/   → доменные вертикали: projects, objects, rooms, works, summary, archive, auth...
shared/     → ui-кит, api-клиенты, утилиты, типы, storage — без знания о доменах
```

Правило зависимостей: `app → features → shared` (строго вниз; features не импортируют
друг друга напрямую — только через shared/events).

## СТАТУС: R1–R5 ЗАВЕРШЕНЫ 2026-10-05

Прод деплоен 5568427 (SYNC-V2 активен, FSD-структура в проде). Открытые хвосты:
легаси-фасады (@deprecated) на старых путях — чистка после стабилизации;
исключение rooms→works в depcruise (осознанное); P3-SPLIT-2 (sync.ts 410);
трансформация Auth/WorkTemplateContext → zustand (отдельная задача).

## Этапы

### R1. Инфраструктура слоёв (batch 017) — БЕЗ переезда кода

- depcruise: правила 3-слойки в «мягком» режиме (forbid для новых путей `src/features/**`,
  `src/app/**`; легаси-пути — allowlist с обратным отсчётом).
- Каркас каталогов `src/app/`, `src/features/<domain>/` (по 1 файлу-README-указателю),
  `shared/` расширен: ui-кит и утилиты, не знающие доменов, переезжают в shared первыми
  (纯 утилиты: format, logger, storageConstants, idMapper — по grep-анализу зависимостей).
- Критерий: depcruise green, ничего не сломано, переезд утилит механический.

### R2. Спека и реализация dirty-flag + LWW sync (batch 018 — СПЕКА, затем 019+ — имплементация)

- Спека (утверждается архитектором ДО кода): модель флагов на сущность (project/object/
  room), исходящая очередь поверх apiClient (rate-limit/ретраи уже есть), конфликт —
  Last-Writer-Wins по updated_at с tie-break по id, обработка 409/оффлайн, миграция
  текущего «pull всего» на инкрементальный pull.
- Имплементация режется на batch'и: (а) dirty-флаги в слайсах + persist, (б) исходящая
  очередь/флашер, (в) LWW-слияние на pull, (г) переключение фронтенда на новый sync,
  старый путь — feature-flag env SYNC_V2.

### R3. Декомпозиция серверного update.ts (по IDEAL §5) — batch'и 02x

- Расщепление по сервисам (validate/apply/sync/jobs) с сохранением контрактов API;
  интеграционные тесты как предупреждающий каркас (пишутся ДО распила).

### R4. Переезд доменов в features/ — по одному домену на batch (02x) — ЗАКРЫТ (2026-10-05)

- Порядок (по связности, от простого): auth → works/templates → summary → rooms →
  objects → projects (самый связанный — последним). Каждый batch: перенос компонентов+
  хуков+api клиента домена в features/<domain>/, обновление импортов, depcruise
  ужесточается на переехавший домен.
- Финал: легаси-пути (src/components/<Domain>, src/hooks/<Domain]) исчезают,
  allowlist пустеет, правила depcruise становятся строгими.
- **Статус: закрыт.** Все 6 batch'ей выполнены (024 auth → 025 works → 026 summary →
  027 rooms → 028 objects → 029 projects+backup+layout+ui-кит). `src/components/` —
  только @deprecated фасады; UI-кит — `shared/ui`; шелл — `src/app/layout`;
  fsd-features-no-cross-imports и fsd-app-layers — error. Остатки на пост-R4:
  удаление фасадов, вынос src/domain+src/types+src/store в shared (см. developer_log,
  batch 029).

### R5. Закрытие

- ARCHITECTURE.md/IDEAL синхронизированы, e2e полный прогон, деплой.

## Оценка и порядок выдачи

R1 → R2(спека) → [утверждение спеки владельцем] → R2(импл 4 batch'а) ∥ R3 (2-3 batch'а)
→ R4 (6 batch'ей) → R5. Всего ~13-15 batch'ей; параллелизм после R2-спеки: R2-импл и R3
не пересекаются по write-set.
