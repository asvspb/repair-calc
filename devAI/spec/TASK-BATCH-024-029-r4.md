# R4: переезд доменов в features/ — общие правила для batch'ей 024–029

База для всех: предыдущий batch R4. Порядок СТРОГО: 024 auth → 025 works → 026 summary →
027 rooms → 028 objects → 029 projects. Каждый batch на своей подветке; gates после каждого.

## Единый алгоритм batch'а

1. Перенести файлы домена (components, hooks, api-клиент домена, доменные утилит-функции)
   в `src/features/<domain>/` c подпапками `ui/`, `model/` (hooks+store-обвязка), `api/`
   по необходимости.
2. В старых путях (`src/components/<Domain>/`, `src/hooks/...`) — re-export-фасады
   `@deprecated` (как утилиты в R1); сами старые каталоги домена удалить, если после
   фасадов пусты.
3. Импортёры вне домена — перевести на новые пути (механическая замена).
4. depcruise: ужесточить правила для переехавшего домена — запрет import из
   `src/features/<domain>/` в другие features (если правило ещё warn — сделать error
   только для ГОТОВЫХ доменов; allowlist легаси-путей сократить на переехавшее).
5. Cross-domain импорты домена (например works→rooms типы): вынести общий в shared/
   ЕСЛИ тривиально (тип/константа); иначе — импорт через facade features/<other>/index.ts
   допускается ТОЛЬКО если depcruise уже разрешает; при запрете — зафиксировать в notes,
   архитектор решит.
6. Тесты домена переезжают вместе с ним; ассерты не меняются.

## Единые запреты

- Поведение/контракты не меняются; только перемещения + импорты + depcruise-конфиг.
- Новые файлы ≤400; без as any/@ts-ignore.
- Каждый логический шаг (перенос / импортёры / depcruise) — отдельный коммит.

## Единый DoD

- [ ] Домен живёт в features/<domain>/; фасады на месте; depcruise green (ужесточение включено); gates зелёные; INDEX/developer_log обновлены.

---

# TASK-BATCH-024-r4-auth

**Подветка:** refactor/r4-auth-024. **Переносится:** src/components/auth/ (LoginPage, ProtectedRoute, RegisterPage, index), src/api/auth.ts, src/contexts/AuthContext.tsx (+ его consumers — только импорты), tests auth-связанные. Особенность: AuthContext — легаси-контекст, переносится как есть (замена на zustand — НЕ эта задача); src/api/users.ts остаётся (общий).

# TASK-BATCH-025-r4-works

**Подветка:** refactor/r4-works-025. **Переносится:** src/components/works/ (11 файлов), src/hooks/useWorkTemplates.ts, src/api/prices/ (клиент AI-поиска цен — домен works), src/data/workTemplatesCatalog (если доменная — по grep зависимостей; если используется多处 — оставить, зафиксировать), src/contexts/WorkTemplateContext.tsx (как есть).

# TASK-BATCH-026-r4-summary

**Подветка:** refactor/r4-summary-026. **Переносится:** src/components/summary/, src/components/SummaryView.tsx, src/api/totals.ts, связанные tests.

# TASK-BATCH-027-r4-rooms

**Подветка:** refactor/r4-rooms-027. **Переносится:** src/components/rooms/, src/components/room/, src/components/RoomEditor.tsx, src/components/geometry/ (геометрия комнат — проверить grep: если используется только rooms-доменом, переносить; если шире — оставить, в notes), src/api/rooms.ts, src/hooks/useGeometryState.ts + useMaterialCalculation.ts (по зависимостям), src/store/createRoomSlice + createObjectSlice НЕ трогать (общие слайсы, R4-projects).

# TASK-BATCH-028-r4-objects

**Подветка:** refactor/r4-objects-028. **Переносится:** src/components/objects/, src/api/objects.ts, связанные tests. Создает зависимость от rooms-фасада при необходимости.

# TASK-BATCH-029-r4-projects (финал R4)

**Подветка:** refactor/r4-projects-029. **Переносится:** src/components/projects/ (вкл. ArchivePanel, ProjectsModal-распил), src/components/backup/ + BackupManager.tsx, src/components/layout/ (по grep — если только проектный шелл), src/api/projects.ts, src/api/storage/ НЕ переносить (инфраструктура — в shared/api/ перенос только если depcruise-разрешение тривиально; по умолчанию оставить, notes), src/store/ слайсы проектов, src/components/ui/ → src/shared/ui (общий кит — теперь все домены переехали). Финал: полный allowlist легаси-путей пересмотрен, правила depcruise для features переведены в error, ROADMAP-fsd.md — статус R4 закрыт, ARCHITECTURE.md отражает целевую структуру.
