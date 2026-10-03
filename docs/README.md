# 📚 Документация Repair Calculator — карта

> **Единая точка входа.** Новый агент/человек начинает отсюда и здесь же обновляет
> карту при добавлении/удалении/перемещении документа. Регламент —
> [AI_DOCUMENTATION_GUIDELINES.md](./AI_DOCUMENTATION_GUIDELINES.md).
> Проверка карты скриптом: `bash scripts/docs-check.sh` (битые ссылки = ошибка).

**Последняя проверка карты:** 2026-10-03

Карта построена по [Diátaxis](https://diataxis.fr/): справочник / объяснение /
how-to / статусы-история. У каждого документа один тип и одно место; дублирование
между типами запрещено — ссылайся, не пересказывай.

## 🧭 Вход в проект (в порядке чтения)

| # | Документ | Что даёт |
|---|---|---|
| 1 | [../AGENTS.md](../AGENTS.md) | Контекст, команды, конвенции (SSOT для агентов) |
| 2 | [../INDEX.md](../INDEX.md) | Справочник: структура файлов, API, типы, БД |
| 3 | [./ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура системы |

## 📖 Справочник (reference — точная информация)

| Документ | Содержимое |
|---|---|
| [../INDEX.md](../INDEX.md) | Структура проекта, ключевые файлы, API endpoints, БД, типы |
| [./openapi.yaml](./openapi.yaml) | Контракт REST API |
| [./LOGGING-CHEATSHEET.md](./LOGGING-CHEATSHEET.md) | Шпаргалка по логированию |
| [./TODO.md](./TODO.md) | Бэклог задач |
| [./TODO_TEMPLATES.md](./TODO_TEMPLATES.md) | Шаблоны постановки задач |

## 💡 Объяснение (explanation — «почему так устроено»)

| Документ | Содержимое |
|---|---|
| [./ARCHITECTURE.md](./ARCHITECTURE.md) | Слои, потоки данных, системные решения |
| [./adr/](./adr/) | Architecture Decision Records — история и мотивация решений |
| [./IDEAL-ARCHITECTURE.md](./IDEAL-ARCHITECTURE.md) | Целевое состояние архитектуры |
| [./TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 — многопользовательская архитектура |
| [./LOGGING.md](./LOGGING.md) | Философия логирования |

## 🛠 How-to (решение конкретных задач)

| Документ | Содержимое |
|---|---|
| [./DEBUG_INSTRUCTIONS.md](./DEBUG_INSTRUCTIONS.md) | Отладка |
| [../prompts/README.md](../prompts/README.md) | Какой агент для какой задачи (иерархия ролей) |
| [./AI_DOCUMENTATION_GUIDELINES.md](./AI_DOCUMENTATION_GUIDELINES.md) | Как вести документацию |

## 📊 Статусы и история (датированные срезы)

| Документ | Содержимое |
|---|---|
| [./PROGRESS.md](./PROGRESS.md) | Вехи проекта: что и когда сделано |
| [../devAI/developer_log.md](../devAI/developer_log.md) | Append-only лента работы агентов |
| [./CODE_REVIEW.md](./CODE_REVIEW.md) | Срезы ревью кода |
| [./AUDIT-2026-06-21.md](./AUDIT-2026-06-21.md), [./AUDIT-VERDICT-2026-06-21.md](./AUDIT-VERDICT-2026-06-21.md) | Аудит 2026-06-21 |
| [./AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) | Аудит состояния (ветка architecture-v2) 2026-08-11 |
| [./archive/](./archive/) | Архив датированных/устаревших документов (напр., старый docs/INDEX.md) |

## ⚙️ Процессные документы (живут НЕ в docs/)

| Где | Что | Правило |
|---|---|---|
| `../devAI/spec/` | SPEC-NNN, TASK-BATCH-NNN, планы | Только там, со статусами; в `docs/` не создавать |
| `../devAI/PLANNING.md` | Планирование текущей сессии | Закрыта → запись в developer_log, файл не плодить |
| `../prompts/` | Ролевые промпты агентов | Регламенты ролей |

## 🗄 Архив

Датированные отчёты и срезы старше 6 месяцев — в `docs/archive/` (создаётся по
мере надобности) с записью здесь. Устаревший документ: сначала перенос в архив,
потом удаление записи из живых секций. В карте не держать ссылки на удалённые файлы.

---

## 🔎 Известные дрейфы

> Реестр ведёт Doc Keeper (`prompts/doc-keeper.md`). Формат строки:
> `| дата | что расходится | где ↔ где | статус |`.
> Статусы: устранён (commit) / открыт → TODO-NN / нужен архитектор.

| Дата | Что расходится | Где ↔ где | Статус |
|------|----------------|-----------|--------|
| 2026-10-03 | Эндпоинты архива проектов (`/archived`, `/:id/restore`, `/:id/permanent`) не отражены в контракте API | docs/openapi.yaml ↔ server/src/routes/projects.ts (коммиты 3f39967, 774ccab) | открыт → TODO-P2-5 |
| 2026-10-03 | То же для INDEX.md — таблица API не содержала архивные и `ai-settings`/`with-rooms`/`with-objects` эндпоинты | INDEX.md ↔ server/src/routes/projects.ts | устранён (docs/doc-keeper-2026-10-03) |
| 2026-10-03 | `docs/LOGGING.md` и `docs/LOGGING-CHEATSHEET.md` — «Проверено: —», содержимое не сверено с кодом (winston-логгер: server/src/middleware/logger.ts) | docs/LOGGING*.md ↔ server/src/middleware/logger.ts | открыт → TODO-P2-2 |
| 2026-10-03 | `ARCHITECTURE.md` сверен частично (только блок БД); `IDEAL-ARCHITECTURE.md`, `TECHNICAL-SPECIFICATION.md`, `CODE_REVIEW.md` — «Проверено: —» | docs/*.md ↔ код | открыт → TODO-P2-2 |
| 2026-10-03 | Управление состоянием: AGENTS.md §7 заявляет только «Context API + hooks», в коде гибрид — `src/contexts/` (Auth, WorkTemplate) И zustand-слайсы `src/store/` (`zustand@^5` в package.json); INDEX.md при этом упоминает «IndexedDB», которого в `src/` нет (есть `src/utils/localStorageProvider.ts`) | AGENTS.md §7 / INDEX.md ↔ src/contexts/ + src/store/ | нужен архитектор (какой канон) |
| 2026-10-03 | Пакетный менеджер: `pnpm-lock.yaml` (root + server) в репо, `package-lock.json` удалён, `node_modules` отсутствует; AGENTS.md §4 и DoD ролей в `prompts/` описывают gates как `npm …` | AGENTS.md §4 / prompts/*.md ↔ pnpm-lock.yaml | нужен архитектор (миграция завершена?) |

---

### Правила карты

1. Добавил/удалил/переместил документ → обнови карту **в том же PR** (это пункт DoD).
2. Не можешь определить тип (квадрант) документа → документ лишний, задумайся.
3. Каждый docs/*.md имеет заголовок со статусом (см. guidelines) — проверяет `scripts/docs-check.sh`.
