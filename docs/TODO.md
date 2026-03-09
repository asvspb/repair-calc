# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-04
**Обновлено:** 2026-03-09
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## ✅ Выполнено

### Критичные (Blockers) — ВСЕ ИСПРАВЛЕНЫ

- [x] **Stale closure в `updateActiveProject`** — ✅ Исправлено ранее
- [x] **CSV-экспорт игнорирует extended/advanced режимы** — ✅ Исправлено 2026-03-04
- [x] **Расхождение портов** — ✅ Исправлено ранее
- [x] **Утечка API-ключа в клиентский бандл** — ✅ Исправлено ранее
- [x] **Rules of Hooks в `App.tsx`** — ✅ Исправлено 2026-03-09 (useEffect перемещён выше условного возврата)

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

### Фаза 2.1: Исправление критических багов (BUGFIX_EXTENDED_MODE_RESET) — ✅ ВЫПОЛНЕНО

- [x] **Баг сброса данных в расширенном режиме (BUGFIX_EXTENDED_MODE_RESET.md)** — ✅ Исправлено 2026-03-07
  - [x] Рефакторинг `handleGeometryModeChange` в `useGeometryState.ts` (functional update)
  - [x] Защита от сохранения "нулевых" данных в `simpleModeData`
  - [x] Рефакторинг всех хендлеров в `useGeometryState.ts` на functional updates (`updateRoomById`)
  - [x] Исправление обновления высоты в `GeometrySection.tsx` (functional update)
  - [x] Все существующие тесты проходят (175 тестов)

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

- [x] **Дублирование логики обновления** — ✅ Исправлено: созданы generic-хелперы в `src/utils/roomHelpers.ts`. Хук `useGeometryState` использует чистые функции для обновления данных.

### Типизация

- [x] **Скрытые `any` в `RoomEditor`** — ✅ Исправлено: используются `WorkTemplate` и `SaveResult`

### Мелкие улучшения (Nitpicks)

- [x] **Импорт типов из `App.tsx`** — ✅ Все компоненты используют `../../types`
- [x] **`confirm()` в модалке удаления** — ✅ Заменён на `ConfirmDialog` с анимацией
- [x] **Отсутствие анимации модального окна** — ✅ Добавлены CSS анимации `fade-in`, `scale-in`
- [x] **`sessionStorage` для `isGeometryCollapsed`** — ✅ Реализовано в `useGeometryState.ts`

---

## 🚀 Выполненные работы (2026-03-09)

### ✅ Вариант А: Технический долг

- [x] **А.1** Generic-хелперы в `src/utils/roomHelpers.ts` — уже существуют
- [x] **А.2** Решение: архитектура функциональных обновлений несовместима с чистыми функциями

### ✅ Вариант Б: Улучшение покрытия тестами

- [x] **Б.1** Добавлены тесты для `roomHelpers.test.ts` — 38 тестов
- [x] **Б.2** Всего тестов: 213 (было 175)

### ✅ Исправление багов

- [x] **Rules of Hooks** — исправлен в `App.tsx` (useEffect перемещён выше условного возврата)

---

## 🚀 Фаза 6: Каталог материалов и расчёт — В РАБОТЕ

**Спецификация:** [MATERIALS_CATALOG_FEATURE.md](./MATERIALS_CATALOG_FEATURE.md)

### Этап 1-3: Типы данных, утилиты, каталог — ✅ ВЫПОЛНЕНО

- [x] **1.1** Обновить `Material` в `src/types/workTemplate.ts`
- [x] **1.2** Добавить `MaterialTemplate`, `WorkTemplateCatalog`, `ToolTemplate`
- [x] **2.1** Создать `src/utils/materialCalculations.ts` с 5 формулами расчёта
- [x] **2.2** Unit-тесты для формул расчёта (40+ тестов)
- [x] **3.1** Создать `src/data/workTemplatesCatalog.ts` с 19 типовыми работами
  - Пол: 4 работы (ламинат, плитка, линолеум, стяжка)
  - Стены: 6 работ (обои, покраска, штукатурка, шпаклёвка, плитка, панели)
  - Потолок: 3 работы (покраска, натяжной, ГКЛ)
  - Проёмы: 3 работы (дверь, окно, откосы)
  - Дополнительно: 3 работы (демонтаж, электрика, сантехника)

### Этап 4: UI выбора из каталога — ⏳ ОЖИДАЕТ

- [ ] **4.1** Создать `WorkCatalogPicker.tsx` (модальное окно)
- [ ] **4.2** Фильтр по категориям (пол/стены/потолок/проёмы/другое)
- [ ] **4.3** Поиск по названию работы
- [ ] **4.4** Карточки работ с превью материалов и инструментов
- [ ] **4.5** Интеграция в `RoomEditor.tsx` (кнопка "📋 Из каталога")
- [ ] **4.6** Integration-тесты

### Этап 5: UI расчёта материалов — ⏳ ОЖИДАЕТ

- [ ] **5.1** Создать `MaterialCalculationCard.tsx`
- [ ] **5.2** Создать `PaintMaterialCard.tsx` (поддержка слоёв)
- [ ] **5.3** Создать `TileMaterialCard.tsx` (расчёт плитки)
- [ ] **5.4** Хук `useMaterialCalculation`
- [ ] **5.5** Unit-тесты для компонентов

### Этап 6: Расширенная общая смета — ⏳ ОЖИДАЕТ

- [ ] **6.1** Создать `src/components/summary/SummaryMaterials.tsx`
- [ ] **6.2** Создать `src/components/summary/SummaryTools.tsx`
- [ ] **6.3** Создать `src/components/summary/SummaryWorks.tsx`
- [ ] **6.4** Обновить `SummaryView.tsx`

### Этап 7: Поиск цен через Gemini — ⏳ ОЖИДАЕТ

- [ ] **7.1** Создать `src/api/prices/geminiPriceSearch.ts`
- [ ] **7.2** Кэширование цен в localStorage
- [ ] **7.3** UI кнопки "Найти цену" в MaterialCalculationCard
- [ ] **7.4** Добавить поле `city` в настройки проекта

---

## 🔮 Будущие задачи (из ARCHITECTURE.md)

### Фаза 7: Backend + AI

- [ ] **7.1** Express + MySQL backend (5–7 дней)
- [ ] **7.2** AI-интеграция Gemini + Mistral (3–5 дней)
- [ ] **7.3** PWA с offline-first синхронизацией (2–3 дня)

---

## 📈 Метрики успеха

| Метрика | Было | Стало | Целевое |
|---------|------|-------|---------|
| Размер App.tsx | ~2700 строк | ~170 строк | <300 строк ✅ |
| Покрытие тестами | ~5% | ~45% (329 тестов) | >60% 🟡 |
| Типизация (any) | 3 места | 0 | 0 ✅ |

### Статистика тестов:
- **Unit тесты (utils):** 198 тестов (включая materialCalculations: 40+)
- **Unit тесты (hooks):** 72 теста
- **Integration тесты:** 4 теста
- **E2E тесты:** 16 тестов
- **Итого:** 329 тестов ✅

---

**См. также:** [CODE_REVIEW.md](./CODE_REVIEW.md), [ARCHITECTURE.md](./ARCHITECTURE.md)