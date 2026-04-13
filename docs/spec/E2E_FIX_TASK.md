# 🔧 Задача: Стабилизация E2E-тестов (Priority 0)

**Дата:** 2026-04-13  
**Стек:** React + TypeScript + Vite + Playwright  
**Статус:** 50 из 52 тестов падают  
**Цель:** Добиться >80% успешного прохождения тест-сьюта

---

## 1. Описание проблемы

Приложение «Мой ремонт» (Repair Calculator) — калькулятор стоимости ремонта с 52 E2E-тестами в Playwright. 50 тестов падают по следующим причинам:

### 1.1 Текст-based селекторы вместо data-testid

Многие тесты используют `button:has-text("...")`, `text=...`, `label:has-text("...") + input` вместо `getByTestId(...)`. При любом изменении текста в UI тесты ломаются.

**Критические файлы (приоритет 1):**

| Файл | Тестов | Селекторов | Проблема |
|------|--------|-------------|----------|
| `e2e/room-input.spec.ts` | 3 | ~20 | **0 data-testid** — все селекторы текстовые |
| `e2e/export-import.spec.ts` | 6 | ~25 | **0 data-testid** — все селекторы текстовые |
| `e2e/work-templates.spec.ts` | 7 | ~30 | Только 1 data-testid, остальные текстовые |

**Файлы среднего приоритета:**

| Файл | Тестов | Проблема |
|------|--------|----------|
| `e2e/regressions.spec.ts` | 5 | Текстовые селекторы для кнопок экспорта, окон/дверей |
| `e2e/responsive.spec.ts` | 2 | `button:has-text("Меню")`, хрупкий CSS-селектор `button >> svg` |
| `e2e/geometry.spec.ts` | 4 | Текстовые селекторы для кнопок геометрии |
| `e2e/works.spec.ts` | 4 | `.first()` на амбиiguous селекторах |
| `e2e/objects.spec.ts` | 4 | Текстовые селекторы `text=Объект`, `text=Санкт-Петербург` |
| `e2e/rooms.spec.ts` | 5 | Текстовые селекторы для навигации по комнатам |
| `e2e/core-workflow.spec.ts` | 3 | Текстовые селекторы `button:has-text("Назад")`, `button:has-text("Ванная")` |

### 1.2 Auth-токены стираются при очистке localStorage

В `playwright.config.ts` **НЕТ `globalSetup`**. Авторизация работает через инъекцию JWT-токенов в `localStorage` через `page.addInitScript()`.

Но несколько файлов **очищают localStorage** в `beforeEach`, удаляя токены:
- `e2e/export-import.spec.ts` — `localStorage.clear()` + сохраняет только `e2e-test-mode`
- `e2e/work-templates.spec.ts` — `localStorage.clear()` + сохраняет только `e2e-test-mode`
- `e2e/auth.spec.ts` — намеренно очищает (тестирует логин)

**Результат:** После очистки localStorage приложение может перенаправить на экран логина, и UI для тестов не отображается.

### 1.3 Тесты без seeded-данных

`e2e/room-input.spec.ts` и `e2e/export-import.spec.ts` вызывают `page.goto('/')` без внедрения тестовых данных. Они полагаются на дефолтное состояние приложения (наличие «Комната 1»). Если приложение стартует пустым — тесты падают.

### 1.4 Прочие проблемы

- **Empty `addInitScript`** вызовы в 9 файлах — мёртвый код
- **`.first()` на неоднозначных селекторах**: `text=м²`, `text=работа`, `input[placeholder="Название"]`
- **CSS-классы в тестах**: `responsive.spec.ts` проверяет `-translate-x-full` / `translate-x-0`

---

## 2. Ожидаемые data-testid атрибуты

Тесты ожидают следующие `data-testid` в компонентах. **Нужно проверить их наличие в React-коде и добавить недостающие.**

### Уже реализованные (используются в рабочих тестах):

| testid | Компонент | Статус |
|--------|-----------|--------|
| `login-form`, `login-email`, `login-password` | Auth components | ✅ Есть |
| `new-project-btn` | ProjectList | ✅ Есть |
| `create-project-modal` | CreateProjectModal | ✅ Есть |
| `project-item-*` | ProjectList | ✅ Есть |
| `add-object-btn` | ObjectSelector | ✅ Есть |
| `create-object-modal` | CreateObjectModal | ✅ Есть |
| `object-selector` | ObjectSelector | ✅ Есть |
| `add-room-btn` | RoomEditor | ✅ Есть |
| `room-item-*` | RoomList | ✅ Есть |
| `room-header-title` | RoomEditor | ✅ Есть |
| `geom-length`, `geom-width`, `geom-height` | RoomDimensions | ✅ Есть |
| `metric-floor-area`, `metric-wall-area` | Metrics | ✅ Есть |
| `add-work-btn` | WorkList | ✅ Есть |
| `work-name-input`, `work-price-input` | WorkForm | ✅ Есть |
| `work-item-*` | WorkList | ✅ Есть |
| `summary-total-cost` | Summary | ✅ Есть |
| `delete-room-btn` | RoomEditor | ✅ Есть |
| `settings-btn` | Header | ✅ Есть |

### Нужно добавить в компоненты (приоритет для UI):

| testid | Где добавить | Для каких файлов |
|--------|-------------|-----------------|
| `export-import-modal` | BackupManager | export-import.spec.ts |
| `export-json-btn` | BackupManager/ExportPanel | export-import.spec.ts |
| `export-csv-btn` | BackupManager/ExportPanel | export-import.spec.ts, regressions.spec.ts |
| `import-file-input` | BackupManager/ImportPanel | export-import.spec.ts |
| `create-backup-btn` | BackupManager | export-import.spec.ts |
| `restore-backup-btn` | BackupManager | export-import.spec.ts |
| `add-window-btn` | RoomEditor geometry | geometry.spec.ts, regressions.spec.ts |
| `add-door-btn` | RoomEditor geometry | geometry.spec.ts, regressions.spec.ts |
| `add-section-btn` | RoomEditor geometry | geometry.spec.ts |
| `templates-btn` | WorkList | works.spec.ts, work-templates.spec.ts |
| `save-template-btn` | WorkTemplateModal | work-templates.spec.ts |
| `geom-mode-simple` | GeometryToggle | geometry.spec.ts |
| `geom-mode-extended` | GeometryToggle | geometry.spec.ts, regressions.spec.ts |
| `work-quantity-input` | WorkItem | works.spec.ts, costs.spec.ts |
| `work-cost` | WorkItem | works.spec.ts, costs.spec.ts |
| `work-template-item` | WorkTemplateList | works.spec.ts, work-templates.spec.ts |
| `mobile-menu-btn` | MobileHeader | responsive.spec.ts |
| `material-name-input` | MaterialForm | works.spec.ts |
| `material-unit-input` | MaterialForm | works.spec.ts |
| `add-material-btn` | WorkItem | works.spec.ts |
| `add-object-modal-title` | CreateObjectModal | objects.spec.ts |
| `delete-object-btn` | ObjectSettings | objects.spec.ts |
| `city-select` | ObjectForm | objects.spec.ts |

---

## 3. Конкретные задачи для выполнения

### Задача A: Добавить data-testid в React-компоненты

**Файлы компонентов, которые нужно модифицировать:**

```
src/components/BackupManager.tsx          — кнопки экспорта/импорта/бэкапа
src/components/RoomEditor.tsx             — кнопки окон/дверей/секций, геометрия
src/components/works/WorkItem.tsx         — quantity, cost
src/components/works/WorkTemplate*.tsx    — template items
src/components/geometry/*.tsx             — mode toggles
src/components/materials/*.tsx            — material form inputs
src/components/Sidebar.tsx или Header.tsx  — mobile menu button
src/components/objects/ObjectSettings.tsx  — delete object button
```

**Что сделать:**
- Добавить `data-testid="..."` атрибуты к кнопкам, инпутам, контейнерам
- Следовать naming convention: `{action}-{entity}-{type}` (например `export-json-btn`)
- Для динамических элементов использовать префикс: `room-item-${room.name}`

### Задача B: Мигрировать селекторы в тестах с текстовых на data-testid

**Файлы тестов для обновления (в порядке приоритета):**

1. **`e2e/room-input.spec.ts`** — ~20 замен
2. **`e2e/export-import.spec.ts`** — ~25 замен
3. **`e2e/work-templates.spec.ts`** — ~30 замен
4. **`e2e/regressions.spec.ts`** — ~10 замен
5. **`e2e/responsive.spec.ts`** — 2 замены + убрать CSS-классы
6. **`e2e/geometry.spec.ts`** — ~10 замен
7. **`e2e/works.spec.ts`** — ~8 замен
8. Остальные файлы по мере необходимости

**Пример миграции:**
```typescript
// БЫЛО (хрупкий):
await page.locator('button:has-text("Экспорт JSON")').click();

// СТАЛО (стабильный):
await page.getByTestId('export-json-btn').click();
```

### Задача C: Исправить авторизацию в тестах

**Вариант 1 (рекомендуемый): globalSetup с storageState**

1. Создать `e2e/globalSetup.ts`:
   - Запустить dev-сервер
   - Залогиниться через API или UI
   - Сохранить `storageState` в `e2e/.auth/user.json`

2. Обновить `playwright.config.ts`:
   ```typescript
   export default defineConfig({
     globalSetup: require.resolve('./globalSetup'),
     use: {
       storageState: 'e2e/.auth/user.json',
     },
   });
   ```

3. Убрать `localStorage.clear()` из тестов, которые не тестируют auth напрямую.

**Вариант 2 (быстрый): Исправить fixture**

В `e2e/fixtures.ts` уже есть логика инъекции токенов. Нужно:
- В файлах, которые очищают localStorage, **восстановить токены после очистки**
- Или НЕ очищать токены при `localStorage.clear()`

### Задача D: Добавить seeded-данные в тесты с пустым состоянием

`e2e/room-input.spec.ts` и `e2e/export-import.spec.ts` стартуют без данных.

**Варианты:**
1. Добавить инъекцию тестового проекта через `addInitScript` (как в `rooms.spec.ts`)
2. Или явно тестировать empty-state flow с соответствующими assertions

### Задача E: Убрать мёртвый код

Удалить пустые `await page.addInitScript(() => {});` из файлов:
- `e2e/rooms.spec.ts`
- `e2e/works.spec.ts`
- `e2e/costs.spec.ts`
- `e2e/projects.spec.ts`
- `e2e/objects.spec.ts`
- `e2e/core-workflow.spec.ts`
- `e2e/responsive.spec.ts`
- `e2e/regressions.spec.ts`
- `e2e/geometry.spec.ts`

---

## 4. Справочная информация

### Структура проекта
```
repair-calc/
├── e2e/                          # Playwright тесты
│   ├── fixtures.ts               # Общие фикстуры (auth, page objects)
│   ├── auth.spec.ts              # 3 теста
│   ├── projects.spec.ts          # 3 теста
│   ├── objects.spec.ts           # 4 теста
│   ├── rooms.spec.ts             # 5 тестов
│   ├── works.spec.ts             # 4 теста
│   ├── costs.spec.ts             # 3 теста
│   ├── core-workflow.spec.ts     # 3 теста
│   ├── work-templates.spec.ts    # 7 тестов
│   ├── geometry.spec.ts          # 4 теста
│   ├── room-input.spec.ts        # 3 теста
│   ├── export-import.spec.ts     # 6 тестов
│   ├── regressions.spec.ts       # 5 тестов
│   └── responsive.spec.ts        # 2 теста
├── src/                          # React frontend
│   ├── components/               # UI компоненты
│   ├── contexts/                 # React контексты
│   ├── hooks/                    # Custom hooks
│   └── api/                      # API клиенты
├── playwright.config.ts          # Конфигурация Playwright
└── package.json
```

### Команды для запуска
```bash
npm run test:e2e              # Запустить все E2E тесты
npm run test:e2e -- --ui      # Запустить в UI режиме
npm run test:e2e -- --project=chromium  # Только Chromium
npm run dev                   # Запустить dev сервер
```

### Пример тестовых данных (из rooms.spec.ts)
```typescript
const TEST_PROJECT = {
  projects: [{
    id: 'test-project',
    name: 'Test Project',
    rooms: [{
      id: 'test-room-1',
      name: 'Гостиная',
      length: 5, width: 4, height: 2.7,
      works: [], materials: []
    }]
  }],
  activeId: 'test-project'
};
```

---

## 5. Критерии приёмки

- [ ] Все 52 теста проходят (или осознанно skip-нуты с комментарием)
- [ ] Все текстовые селекторы заменены на `data-testid`
- [ ] Auth работает стабильно (нет redirect на login page)
- [ ] Нет пустых `addInitScript` вызовов
- [ ] Тесты запускаются через `npm run test:e2e -- --project=chromium` без ошибок
- [ ] Добавлены `data-testid` атрибуты во все необходимые React-компоненты

---

## 6. Скриншоты ошибок

Тесты генерируют скриншоты при падении в:
```
test-results/*/test-failed-1.png
test-results/*/error-context.md
```

Основные ошибки на скриншотах:
1. `getByTestId('login-form')` — element not found (app shows different screen)
2. `getByTestId('object-selector')` — element not found (no project loaded)
3. `getByTestId('work-quantity-input')` — element not found (work item not rendered)
