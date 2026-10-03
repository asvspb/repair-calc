# 📈 Прогресс проекта — вехи

- **Статус:** актуально
- **Проверено:** 2026-10-03

Вехи — крупные завершённые изменения (не каждая задача). Формат: дата, что, где
подробнее. Обновляет архитектор при закрытии вехи. Текущие задачи — в
[TODO.md](./TODO.md); поэтапная лента — [../devAI/developer_log.md](../devAI/developer_log.md).

---

## 2026-10 — Документация v2; слияние рефактора

- Merge `refactor/architecture-v2` → `main` выполнен (закрыт P0-1 из TODO); актуальная
  рабочая ветка `feat/project-archive-t2`. CI активирован (`.github/workflows/ci.yml`,
  husky-хуки в VCS).
- T1 архива проектов (план `devAI/spec/plan-project-archive.md`, approved 2026-08-25):
  атомарная архивация + restore/hardDelete в репозитории, эндпоинты `archived/restore/permanent`.
- Принята система документирования: Diátaxis-карта, ADR, freshness-заголовки,
  `scripts/docs-check.sh`. — [ADR-0001](./adr/0001-documentation-system.md)
- Исправлен дрейф ARCHITECTURE.md: MySQL → PostgreSQL (по факту `pg` в `server/package.json`).
- Создана библиотека ролевых промптов (6 ролей + иерархия). — [../prompts/README.md](../prompts/README.md)

## 2026-06 — Аудит архитектуры

- Аудит и вердикт: [AUDIT-2026-06-21.md](./AUDIT-2026-06-21.md),
  [AUDIT-VERDICT-2026-06-21.md](./AUDIT-VERDICT-2026-06-21.md)

## 2026-04 — Стабилизация E2E и строгая типизация

- Стабилизация E2E-тестов: SPEC-002..004 в `devAI/spec/`.
- i18n: строгая типизация ключей, динамическое имя проекта в хедере (b723aa3).

## 2026-03 — Переход на client-server архитектуру

- PostgreSQL + Knex, JWT-аутентификация, миграции localStorage → API
  (`src/utils/migration.ts`, `src/utils/idMapper.ts`).
