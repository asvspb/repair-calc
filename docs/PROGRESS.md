# Прогресс проекта Repair Calculator

**Последнее обновление:** 2026-03-04

---

## ✅ Завершённые фазы

### Фаза 1: Декомпозиция App.tsx — ВЫПОЛНЕНО

**Проблема:** God Component `App.tsx` содержал ~2700 строк кода.

**Решение:**
- App.tsx сокращён до ~170 строк
- Типы вынесены в `src/types/`
- Утилиты вынесены в `src/utils/` (geometry.ts, costs.ts, factories.ts, storage.ts)
- Компоненты вынесены: `SummaryView`, `RoomEditor`, `BackupManager`, `RoomList`, `WorkList`, `NumberInput`
- Хуки вынесены: `useProjects`, `useWorkTemplates`
- Начальные данные вынесены в `src/data/initialData.ts`

### Фаза 2: Исправление багов — ВЫПОЛНЕНО

- [x] Stale closure в `updateActiveProject` исправлен
- [x] CSV экспорт теперь учитывает extended/advanced режимы
- [x] Порты унифицированы
- [x] Все `any` заменены на конкретные типы
- [x] Мёртвые зависимости удалены (`@google/genai`, `better-sqlite3`, `express`, `dotenv`, `motion`)

### Фаза 3: Улучшение архитектуры — ВЫПОЛНЕНО

- [x] Интерфейс `IStorageProvider` для абстракции storage
- [x] React Error Boundaries добавлены
- [x] Глобальное состояние вынесено в Context API (`ProjectProvider`, `WorkTemplateProvider`)
- [x] `React.memo` для тяжёлых компонентов (`RoomListItem`, `WorkListItem`, `SummaryView`, `NumberInput`)

### Фаза 4: Тестирование — ВЫПОЛНЕНО

| Категория | Файлы | Тестов |
|-----------|-------|--------|
| Unit (utils) | `tests/utils/*.test.ts` | 113 |
| Unit (hooks) | `tests/hooks/*.test.ts` | 33 |
| Integration | `tests/integration/*.test.tsx` | 4 |
| E2E | `e2e/*.spec.ts` | 16 |
| **Итого** | | **166** |

#### E2E тесты:
- `room-input.spec.ts` — 3 теста (переключение комнат, ввод данных)
- `export-import.spec.ts` — 6 тестов (JSON/CSV экспорт, импорт, бэкапы)
- `work-templates.spec.ts` — 7 тестов (сохранение/применение шаблонов)

---

## 🚧 Оставшиеся задачи

### Низкий приоритет (Nitpicks)

1. **Дублирование логики обновления** — создать generic-хелпер `updateRoomField`
2. **Импорт типов из `App.tsx`** — обновить импорты в компонентах
3. **`confirm()` в модалке удаления** — заменить на кастомный UI
4. **Анимация модального окна** — добавить transition через CSS
5. **`sessionStorage` для `isGeometryCollapsed`** — рассмотреть React state

### Фаза 5: Backend + AI (будущее)

| Задача | Оценка |
|--------|--------|
| Express + MySQL backend | 5–7 дней |
| AI-интеграция Gemini + Mistral | 3–5 дней |
| PWA с offline-first синхронизацией | 2–3 дня |

---

## 📈 Метрики успеха

| Метрика | Было | Стало | Целевое | Статус |
|---------|------|-------|---------|--------|
| Размер App.tsx | ~2700 строк | ~170 строк | <300 строк | ✅ |
| Покрытие тестами | ~5% | ~25% | >60% | 🟡 |
| Типизация (any) | 3 места | 0 | 0 | ✅ |
| Тесты | 0 | 166 | — | ✅ |

---

## 📁 Структура проекта

```
src/
├── App.tsx              # Главный компонент (~170 строк)
├── components/
│   ├── BackupManager.tsx
│   ├── RoomEditor.tsx
│   ├── SummaryView.tsx
│   ├── rooms/
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   ├── works/
│   │   ├── WorkList.tsx
│   │   ├── WorkListItem.tsx
│   │   ├── WorkTemplatePickerModal.tsx
│   │   └── WorkTemplateSaveButton.tsx
│   └── ui/
│       ├── ErrorBoundary.tsx
│       └── NumberInput.tsx
├── contexts/
│   ├── ProjectContext.tsx
│   └── WorkTemplateContext.tsx
├── hooks/
│   ├── useProjects.ts
│   └── useWorkTemplates.ts
├── types/
│   ├── index.ts
│   ├── storage.ts
│   └── workTemplate.ts
├── utils/
│   ├── costs.ts
│   ├── factories.ts
│   ├── geometry.ts
│   ├── localStorageProvider.ts
│   ├── storage.ts
│   └── templateStorage.ts
└── data/
    └── initialData.ts

tests/
├── App.test.tsx
├── setup.ts
├── hooks/
│   ├── useProjects.test.ts
│   └── useWorkTemplates.test.ts
├── integration/
│   └── project-workflow.test.tsx
└── utils/
    ├── costs.test.ts
    ├── geometry.test.ts
    └── storage.test.ts

e2e/
├── room-input.spec.ts
├── export-import.spec.ts
└── work-templates.spec.ts
```

---

## 🔗 Связанные документы

- [TODO.md](./TODO.md) — актуальные задачи
- [CODE_REVIEW.md](./CODE_REVIEW.md) — результаты ревью кода
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура проекта