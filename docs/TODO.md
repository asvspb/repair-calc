# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-04
**Обновлено:** 2026-03-04 (актуализировано)
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## ✅ Выполнено

### Критичные (Blockers) — ВСЕ ИСПРАВЛЕНЫ

- [x] **Stale closure в `updateActiveProject`** — ✅ Исправлено ранее
- [x] **CSV-экспорт игнорирует extended/advanced режимы** — ✅ Исправлено 2026-03-04
- [x] **Расхождение портов** — ✅ Исправлено ранее
- [x] **Утечка API-ключа в клиентский бандл** — ✅ Исправлено ранее

### Фаза 1: Декомпозиция App.tsx — ВЫПОЛНЕНО

- [x] **God Component `App.tsx`** — декомпозиция завершена. App.tsx теперь ~170 строк (было ~2700).
- [x] Типы вынесены в `src/types/`
- [x] Утилиты вынесены в `src/utils/` (geometry.ts, costs.ts, factories.ts, storage.ts)
- [x] Компоненты вынесены: `SummaryView`, `RoomEditor`, `BackupManager`, `RoomList`, `WorkList`, `NumberInput`
- [x] Хуки вынесены: `useProjects`, `useWorkTemplates`
- [x] Начальные данные вынесены в `src/data/initialData.ts`

### Фаза 2: Исправление багов — ВЫПОЛНЕНО

- [x] Stale closure исправлен
- [x] CSV экспорт исправлен
- [x] Порты унифицированы
- [x] Все `any` заменены на конкретные типы (проверено поиском)

### Зависимости

- [x] **Мёртвые зависимости** — `@google/genai`, `better-sqlite3`, `express`, `dotenv`, `motion` удалены ✅

### Шаблоны работ

- [x] **`CATEGORY_LABELS` в модальном окне** — исправлено, импортируется из `workTemplate.ts` ✅
- [x] **`index.ts` бочки обновлены** ✅

---

## 🚧 В работе / Следующие задачи

### Фаза 3: Улучшение архитектуры — ВЫПОЛНЕНО ✅

- [x] **3.1** Создать интерфейс `IStorageProvider` для абстракции storage ✅
- [x] **3.2** Добавить React Error Boundaries ✅
- [x] **3.3** Вынести глобальное состояние в Context API (решить prop drilling) ✅
- [x] **3.4** Добавить `React.memo` для тяжёлых компонентов ✅
  - `RoomListItem`, `WorkListItem`, `SummaryView`, `NumberInput`

### Фаза 4: Тестирование (1 неделя)

- [x] **4.1** Unit-тесты для utils (geometry.ts, costs.ts, storage.ts) ✅ 113 тестов
- [x] **4.2** Unit-тесты для хуков (useProjects, useWorkTemplates) ✅ 33 теста
- [x] **4.3** Integration тесты для полного flow ✅ 4 теста (базовое покрытие)
- [x] **4.4** Расширение E2E тестов (экспорт/импорт, шаблоны) ✅ 16 тестов
  - room-input.spec.ts: 3 теста
  - export-import.spec.ts: 6 тестов
  - work-templates.spec.ts: 7 тестов

---

## ⚠️ Замечания (Warnings) — Низкий приоритет

### Архитектура

- [x] **Prop drilling** — ✅ Исправлено: React Context (`ProjectProvider`, `WorkTemplateProvider`)

- [ ] **Дублирование логики обновления** — `updateSimpleField`, `updateWindow`, `updateSubSection` имеют одинаковую структуру. **Исправление:** создать generic-хелпер `updateRoomField`.

### Типизация

- [x] **Скрытые `any` в `RoomEditor`** — ✅ Исправлено: используются `WorkTemplate` и `SaveResult`

### Мелкие улучшения (Nitpicks)

- [ ] **Импорт типов из `App.tsx`** — обновить импорты в `WorkList.tsx`, `WorkListItem.tsx`, `RoomList.tsx`, `RoomListItem.tsx`
- [x] **`confirm()` в модалке удаления** — ✅ Заменён на `ConfirmDialog` с анимацией
- [x] **Отсутствие анимации модального окна** — ✅ Добавлены CSS анимации `fade-in`, `scale-in`
- [ ] **`sessionStorage` для `isGeometryCollapsed`** — рассмотреть React state (не критично)

---

## 🔮 Будущие задачи (из ARCHITECTURE.md)

### Фаза 5: Backend + AI

- [ ] **5.1** Express + MySQL backend (5–7 дней)
- [ ] **5.2** AI-интеграция Gemini + Mistral (3–5 дней)
- [ ] **5.3** PWA с offline-first синхронизацией (2–3 дня)

---

## 📈 Метрики успеха

| Метрика | Было | Стало | Целевое |
|---------|------|-------|---------|
| Размер App.tsx | ~2700 строк | ~170 строк | <300 строк ✅ |
| Покрытие тестами | ~5% | ~25% (150+ тестов) | >60% |
| Типизация (any) | 3 места | 0 | 0 ✅ |

### Статистика тестов:
- **Unit тесты (utils):** 113 тестов
- **Unit тесты (hooks):** 33 теста
- **Integration тесты:** 4 теста
- **E2E тесты:** 16 тестов
- **Итого:** 166 тестов ✅

---

**См. также:** [CODE_REVIEW.md](./CODE_REVIEW.md), [ARCHITECTURE.md](./ARCHITECTURE.md)