# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-01  
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## 🚨 Критичные (Blockers)

- [ ] **Stale closure в `updateActiveProject`** — `src/hooks/useProjects.ts` строка ~80: `projects` в замыкании может быть устаревшим. При быстрых последовательных обновлениях (длина + ширина) второй вызов перезатирает первое изменение. **Исправление:** использовать функциональное обновление `setProjects(prev => ...)` и убрать `projects` из зависимостей `useCallback`.

- [ ] **CSV-экспорт игнорирует extended/advanced режимы** — `src/utils/storage.ts`, метод `exportToCSV`: жёстко использует `room.length * room.width` для площади. Для расширенного и профессионального режимов данные в Excel будут **некорректными**. Также не учитывает `materials[]` и `tools[]` (использует legacy `materialPrice`). **Исправление:** вынести `calculateRoomMetrics`/`calculateRoomCosts` из `App.tsx` в `src/utils/calculations.ts` и переиспользовать в CSV.

- [ ] **Расхождение портов** — `package.json` (`--port=3993`) vs `playwright.config.ts` (`baseURL: http://localhost:3995`). E2E-тесты гарантированно упадут. **Исправление:** привести к одному порту (3993).

- [ ] **Утечка API-ключа в клиентский бандл** — `vite.config.ts`: `process.env.GEMINI_API_KEY` встраивается в JS-бандл через `define`. Даже если AI не реализован, ключ из `.env` утечёт. **Исправление:** убрать `define` из `vite.config.ts` до реализации серверной части.

---

## ⚠️ Замечания (Warnings)

### Архитектура

- [ ] **God Component `App.tsx` (~2700 строк)** — типы, константы, бизнес-логика, UI — всё в одном файле. Нарушает SRP, затрудняет тестирование и параллельную разработку. **План декомпозиции:**
  - [ ] Вынести типы в `src/types/` (Room, Project, Work, Material, Tool, Opening, Geometry)
  - [ ] Вынести `calculateRoomMetrics`/`calculateRoomCosts` в `src/utils/calculations.ts`
  - [ ] Вынести `NumberInput` в `src/components/ui/NumberInput.tsx`
  - [ ] Вынести `SummaryView` в `src/components/SummaryView.tsx`
  - [ ] Вынести `RoomEditor` в `src/components/RoomEditor.tsx`
  - [ ] Вынести `createNewRoom`, `createNewProject`, `migrateWorkData` в `src/utils/factories.ts`

- [ ] **Prop drilling** — состояние передаётся через 3–4 уровня пропсов (App → RoomEditor → WorkList → WorkListItem). **Исправление:** рассмотреть React Context или Zustand для стейт-менеджмента.

- [ ] **Дублирование логики обновления** — `updateSimpleField`, `updateWindow`, `updateSubSection` и т.д. имеют одинаковую структуру (обновить `room` + обновить `modeData`). **Исправление:** создать generic-хелпер `updateRoomField` с поддержкой mode-specific data.

### Шаблоны работ

- [ ] **`CATEGORY_LABELS` в модальном окне расходится с типом** — `src/components/works/WorkTemplatePickerModal.tsx` строка 15–20: содержит `ceiling: 'Потолок'`, которого нет в типе `WorkTemplateCategory`, и не содержит `perimeter: 'Периметр'`. **Исправление:** импортировать `CATEGORY_LABELS` из `src/types/workTemplate.ts` вместо локального определения.

- [ ] **Статус ТЗ устарел** — `docs/WORK_TEMPLATES_SPEC.md` указывает «Статус: Проектирование», но реализация завершена. **Исправление:** обновить статус на «Реализовано».

### Зависимости

- [ ] **Мёртвые зависимости в `package.json`** — `@google/genai`, `better-sqlite3`, `express`, `dotenv` объявлены, но не импортируются нигде в `src/`. **Исправление:** удалить до реализации серверной части (см. ARCHITECTURE.md фаза 3).

- [ ] **Неиспользуемая зависимость `motion` (framer-motion)** — установлена, но нигде не используется. Пользователь подтвердил, что не нужна. **Исправление:** `npm uninstall motion`.

### Типизация

- [ ] **Скрытые `any` в `RoomEditor`** — пропсы `templates: any[]`, `onSaveTemplate: (work: WorkData, forceReplace: boolean) => any`, `onLoadTemplate: (template: any) => WorkData`. **Исправление:** заменить `any` на `WorkTemplate` и `SaveResult`.

---

## 💡 Мелкие улучшения (Nitpicks)

- [ ] **Импорт типов `WorkData`, `RoomData` из `App.tsx`** — `WorkList.tsx`, `WorkListItem.tsx`, `RoomList.tsx`, `RoomListItem.tsx` импортируют типы из `../../App`. После декомпозиции типов — обновить импорты.

- [ ] **`index.ts` бочки не обновлены** — `src/components/works/index.ts` экспортирует только `WorkList` и `WorkListItem`, но не `WorkTemplateSaveButton` и `WorkTemplatePickerModal`.

- [ ] **`confirm()` в модалке удаления шаблона** — использует нативный `confirm()` вместо кастомного UI. Для внутреннего инструмента допустимо, но при масштабировании стоит заменить.

- [ ] **Отсутствие анимации закрытия модального окна** — `WorkTemplatePickerModal` появляется/исчезает мгновенно. Можно добавить transition через CSS.

- [ ] **`sessionStorage` для состояния `isGeometryCollapsed`** — нестандартный подход; при множественных вкладках состояние может путаться. Рассмотреть React state или отдельный хук.

---

## 🔮 Будущие задачи (из ARCHITECTURE.md)

- [ ] **Фаза 1:** Исправить все блокеры выше (1–2 дня)
- [ ] **Фаза 2:** Декомпозиция `App.tsx` (3–5 дней)
- [ ] **Фаза 3:** Express + MySQL backend (5–7 дней)
- [ ] **Фаза 4:** AI-интеграция Gemini + Mistral (3–4 дня)
- [ ] **Фаза 5:** PWA с offline-first синхронизацией (2–3 дня)
