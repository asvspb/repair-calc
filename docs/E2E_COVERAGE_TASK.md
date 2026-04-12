# 📋 Техническое задание: E2E тестирование — покрытие 80%

**Версия:** 2.0  
**Дата:** 12.04.2026  
**Статус:** Утверждено

---

## 1. Аудит текущего состояния

### 1.1 Инвентарь существующих тестов

| Файл | Кол-во тестов | Что покрывает |
|------|:---:|---|
| `e2e/room-input.spec.ts` | 3 | Переключение между комнатами, независимое редактирование, потеря фокуса |
| `e2e/export-import.spec.ts` | 7 | Экспорт JSON/CSV, импорт, невалидный файл, резервные копии |
| `e2e/work-templates.spec.ts` | 7 | Сохранение/применение/поиск/фильтр/удаление шаблонов |
| **Итого** | **17** | Только localStorage-режим, только Chromium |

### 1.2 Выявленные проблемы

**Анти-паттерн «тихий пропуск» (silent skip):**  
Множество тестов используют `if (await btn.isVisible()) { ... }` — если элемент не найден, тест проходит, ничего не проверив. Затрагивает **9 из 17** тестов (`work-templates.spec.ts` — 7, `export-import.spec.ts` — 2: backup/restore).

**Нестабильные ожидания:**  
`waitForTimeout(300)` в `work-templates.spec.ts` (строки 76, 109) — прямое нарушение требований стабильности.

**Хрупкие селекторы:**  
Повсеместно используется `button:has-text("...")`, `label:has-text("...") + input` — сломаются при любом изменении текста кнопки. В компонентах почти нет `data-testid` (исключение: `work-template-item` уже используется в `work-templates.spec.ts`).

**Конфигурация Playwright:**  
Только один браузер (`chromium`), нет мобильных разрешений, нет `webServer` для автозапуска dev-сервера.

### 1.3 Непокрытые модули

| Модуль | Статус |
|--------|--------|
| Авторизация (login / register / logout) | ❌ Не покрыт |
| Управление проектами (CRUD) | ❌ Не покрыт |
| Управление объектами (CRUD) | ❌ Не покрыт |
| Режимы геометрии (simple / extended / advanced) | ❌ Не покрыт |
| Расчёт стоимости (работы + материалы → итого) | ❌ Не покрыт |
| Общая смета (SummaryView) | ❌ Не покрыт |
| Drag-and-drop (переупорядочивание комнат) | ❌ Не покрыт |
| Адаптивная вёрстка (мобильные сайдбары) | ❌ Не покрыт |
| Синхронизация данных (API ↔ localStorage) | ❌ Не покрыт (отложено, требует запущенный сервер) |

---

## 2. Цели и критерии приёмки

### 2.1 Цели

- Покрыть **80%** критичной пользовательской функциональности E2E тестами
- Устранить все анти-паттерны в существующих тестах
- Добавить `data-testid` к ключевым UI-элементам

### 2.2 Критерии приёмки

| Критерий | Требование |
|----------|------------|
| Новые тестовые сценарии | ≥ 25 |
| Исправленные существующие тесты | 17 (удалены silent skips, waitForTimeout) |
| Стабильность (10 прогонов подряд) | 100% pass |
| Flaky тесты | 0 |
| Время одного теста | < 10 сек |
| Общее время прогона | < 5 мин |
| Все модули из раздела 4 | Покрыты |

---

## 3. Подготовка инфраструктуры

### 3.1 Обновление Playwright конфига

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:3993',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Автозапуск dev-сервера
  // NB: npm run dev содержит grep-пайп, поэтому используем vite напрямую
  webServer: {
    command: 'npx vite --port=3993',
    url: 'http://localhost:3993',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
```

### 3.2 Стратегия авторизации

Приложение требует авторизацию (показывает `LoginPage` по умолчанию). Стратегия:

**Вариант А — localStorage bypass (для большинства тестов):**
```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject auth state before navigation
    await page.addInitScript(() => {
      // Ключи из src/api/auth.ts: saveTokens(), getStoredToken()
      localStorage.setItem('token', 'test-jwt-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
    });
    await use(page);
  },
});
```

**Вариант Б — реальный login (для тестов авторизации):**
```typescript
// e2e/auth.spec.ts — использовать стандартный test из @playwright/test
```

### 3.3 Фикстуры данных

Фикстуры должны отражать реальную иерархию: `Project → Object[] → Room[] → Work[]`.

```typescript
// e2e/fixtures/testData.ts
import type { ProjectData } from '../../src/types';

export const TEST_PROJECT: ProjectData = {
  id: 'test-project-1',
  name: 'Тестовый проект',
  objects: [{
    id: 'test-obj-1',
    name: 'Квартира',
    projectId: 'test-project-1',
    rooms: [{
      id: 'test-room-1',
      name: 'Кухня',
      length: 4, width: 3, height: 2.7,
      geometryMode: 'simple',
      windows: [], doors: [],
      segments: [], obstacles: [], wallSections: [], subSections: [],
      works: [],
    }],
  }],
};
```

**Инъекция в тест:**
```typescript
// Ключи из src/utils/storage.ts: STORAGE_KEYS
await page.addInitScript((data) => {
  localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
  localStorage.setItem('repair-calc-active-project', data.activeId);
}, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });
```

### 3.4 План добавления `data-testid`

Минимальный набор атрибутов, необходимый для стабильных тестов:

| Компонент | Элемент | `data-testid` |
|-----------|---------|---------------|
| `LeftSidebar` | Кнопка «Добавить комнату» | `add-room-btn` |
| `LeftSidebar` | Кнопка «Добавить объект» | `add-object-btn` |
| `RoomListItem` | Элемент комнаты | `room-item-{id}` |
| `RoomEditor` | Заголовок комнаты | `room-header-title` |
| `RoomEditor` | Кнопка «Добавить работу» | `add-work-btn` |
| `RoomEditor` | Кнопка «Удалить комнату» | `delete-room-btn` |
| `WorkListItem` | Карточка работы | `work-item-{id}` |
| `WorkListItem` | Поле «Название работы» | `work-name-input` |
| `WorkListItem` | Поле «Цена за ед.» | `work-price-input` |
| `SimpleGeometry` | Поле «Длина» | `geom-length` |
| `SimpleGeometry` | Поле «Ширина» | `geom-width` |
| `SimpleGeometry` | Поле «Высота» | `geom-height` |
| `GeometryMetrics` | Площадь пола | `metric-floor-area` |
| `GeometryMetrics` | Площадь стен | `metric-wall-area` |
| `ModeSelector` | Кнопка режима | `geom-mode-{mode}` |
| `SummaryView` | Итоговая стоимость | `summary-total-cost` |
| `ProjectsList` | Карточка проекта | `project-item-{id}` |
| `RightSidebar` | Кнопка «Новый проект» | `new-project-btn` |
| `RightSidebar` | Кнопка «Настройки» | `settings-btn` |
| `ObjectSettings` | Селектор объекта | `object-selector` |
| `CreateObjectModal` | Модальное окно | `create-object-modal` |
| `CreateProjectModal` | Модальное окно | `create-project-modal` |
| `LoginPage` | Форма логина | `login-form` |
| `LoginPage` | Поле email | `login-email` |
| `LoginPage` | Поле пароль | `login-password` |

### 3.5 Page Object Models

```typescript
// e2e/pages/RoomEditorPage.ts
import { Page, Locator } from '@playwright/test';

export class RoomEditorPage {
  readonly page: Page;
  readonly lengthInput: Locator;
  readonly widthInput: Locator;
  readonly heightInput: Locator;
  readonly floorArea: Locator;
  readonly wallArea: Locator;
  readonly addWorkBtn: Locator;
  readonly deleteRoomBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.lengthInput = page.getByTestId('geom-length');
    this.widthInput = page.getByTestId('geom-width');
    this.heightInput = page.getByTestId('geom-height');
    this.floorArea = page.getByTestId('metric-floor-area');
    this.wallArea = page.getByTestId('metric-wall-area');
    this.addWorkBtn = page.getByTestId('add-work-btn');
    this.deleteRoomBtn = page.getByTestId('delete-room-btn');
  }

  async setDimensions(length: number, width: number, height: number) {
    await this.lengthInput.fill(String(length));
    await this.widthInput.fill(String(width));
    await this.heightInput.fill(String(height));
    // Blur для сохранения
    await this.page.getByTestId('room-header-title').click();
  }

  async getFloorArea(): Promise<string> {
    return (await this.floorArea.textContent()) ?? '';
  }
}
```

```typescript
// e2e/pages/SidebarPage.ts
import { Page, Locator } from '@playwright/test';

export class SidebarPage {
  readonly page: Page;
  readonly addRoomBtn: Locator;
  readonly addObjectBtn: Locator;
  readonly newProjectBtn: Locator;
  readonly settingsBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addRoomBtn = page.getByTestId('add-room-btn');
    this.addObjectBtn = page.getByTestId('add-object-btn');
    this.newProjectBtn = page.getByTestId('new-project-btn');
    this.settingsBtn = page.getByTestId('settings-btn');
  }

  roomItem(id: string): Locator {
    return this.page.getByTestId(`room-item-${id}`);
  }

  async selectRoom(name: string) {
    await this.page.getByRole('button', { name }).click();
  }
}
```

### 3.6 Исправление анти-паттернов в существующих тестах

**До начала написания новых тестов** необходимо исправить 17 существующих:

| Проблема | Файлы | Действие |
|----------|-------|----------|
| `if (await btn.isVisible())` → silent skip | `export-import.spec.ts`, `work-templates.spec.ts` | Заменить на `await expect(btn).toBeVisible()` или удалить тест |
| `waitForTimeout(300)` | `work-templates.spec.ts:76,109` | Заменить на `await expect(results).toHaveCount(...)` или `waitForSelector` |
| Хрупкие текстовые селекторы | Все файлы | Перевести на `getByTestId` после добавления атрибутов |
| Отсутствие `beforeEach` очистки | Все файлы | Добавить очистку `localStorage` и фикстуры |

---

## 4. Тестовые сценарии по модулям

### 4.1 Сквозной рабочий процесс (3 теста) 🔴 Высокий

Полный путь пользователя от создания проекта до просмотра сметы.

```
Сценарий 1: Полный цикл создания сметы
  1. Нажать «Новый проект» → ввести название → создать
  2. Убедиться, что проект появился в RightSidebar
  3. Нажать «Добавить комнату» → ввести размеры (5×4×2.7)
  4. Проверить расчёт площади пола = 20.00 м²
  5. Нажать «Добавить работу» → заполнить название + цену
  6. Перейти на вкладку «Общая смета»
  7. Проверить, что итоговая стоимость > 0

Сценарий 2: Несколько объектов в проекте
  1. Создать проект → добавить объект «Квартира»
  2. Добавить комнату с работами
  3. Добавить второй объект «Офис»
  4. Добавить комнату с работами
  5. Перейти в «Общую смету» → проверить группировку по объектам
  6. Проверить, что итого = сумма по объектам

Сценарий 3: Редактирование и пересчёт
  1. Загрузить фикстуру с проектом, объектом, комнатой и работой
  2. Изменить цену работы → проверить пересчёт в SummaryView
  3. Изменить размеры комнаты → проверить пересчёт площадей
  4. Удалить работу → проверить, что итого уменьшилось
```

### 4.2 Управление комнатами (5 тестов) 🔴 Высокий

```
- Добавление комнаты → появляется в LeftSidebar, можно редактировать
- Переключение между комнатами → данные не смешиваются (регрессия room-input)
- Переименование комнаты → название обновляется в сайдбаре и хедере
- Удаление комнаты → подтверждение → перенаправление на «Общую смету»
- Удаление последней комнаты → корректное состояние (пустой объект)
```

### 4.3 Управление объектами (4 теста) 🟠 Высокий

```
- Создание объекта через CreateObjectModal → появляется в ObjectSettings
- Переключение между объектами → комнаты меняются в LeftSidebar
- Удаление объекта → подтверждение → переключение на другой объект
- Указание города для объекта → сохраняется при переключении
```

### 4.4 Режимы геометрии (4 теста) 🔴 Высокий

```
- Простой режим: ввод Д×Ш×В → проверка площади пола, стен, потолка, объёма
- Расширенный режим: добавление секций → пересчёт площадей
- Добавление проёмов (окна/двери) → вычитание из площади стен
- Переключение между режимами → данные не теряются
```

### 4.5 Работы и материалы (4 теста) 🔴 Высокий

```
- Добавление работы → заполнение полей → расчёт стоимости
- Добавление материала к работе → расчёт количества по площади
- Включение/отключение работы (toggle) → пересчёт итога
- Применение шаблона из каталога → заполнение полей работы
```

### 4.6 Расчёт стоимости (3 теста) 🔴 Высокий

```
- Ручной ввод количества → стоимость = цена × количество
- Авто-расчёт по площади → количество = площадь, стоимость корректна
- Итог в SummaryView = Σ(работы) + Σ(материалы) + Σ(инструменты)
```

### 4.7 Управление проектами (3 теста) 🟠 Средний

```
- Создание проекта через ProjectsModal → появляется в RightSidebar
- Копирование проекта → независимая копия, изменения не связаны
- Удаление проекта → подтверждение → переключение на другой проект
```

### 4.8 Экспорт / Импорт (доработка, 2 теста) 🟠 Средний

Существующие 7 тестов исправить (убрать silent skips). Добавить:

```
- Экспорт → изменение данных → импорт → данные восстановлены (roundtrip)
- Импорт проекта с несколькими объектами → иерархия сохранена
```

### 4.9 Шаблоны работ (доработка, 1 тест) 🟠 Средний

Существующие 7 тестов исправить. Добавить:

```
- Применение нескольких шаблонов к одной комнате → все работы добавлены
```

### 4.10 Авторизация (3 теста) 🟡 Средний

```
- Успешный логин → отображается основное приложение
- Неуспешный логин → сообщение об ошибке
- Регистрация → автоматический вход → приложение загружено
```

### 4.11 Адаптивный дизайн (2 теста) 🟢 Низкий

```
- Мобильное разрешение: LeftSidebar скрыт → нажатие Menu → открывается
- Мобильное разрешение: RightSidebar скрыт → нажатие Settings → открывается
```

### Итого

| Категория | Новых | Исправленных |
|-----------|:-----:|:------------:|
| Сквозной процесс | 3 | — |
| Комнаты | 5 | — |
| Объекты | 4 | — |
| Геометрия | 4 | — |
| Работы и материалы | 4 | — |
| Расчёт стоимости | 3 | — |
| Проекты | 3 | — |
| Экспорт/Импорт | 2 | 7 (silent skips, хрупкие селекторы) |
| Шаблоны работ | 1 | 7 (silent skips, waitForTimeout) |
| Авторизация | 3 | — |
| Адаптивность | 2 | — |
| **Итого** | **34** | **14** |

> **Примечание:** 3 теста в `room-input.spec.ts` не содержат анти-паттернов и не требуют исправления. Их селекторы будут обновлены на `getByTestId` при общей миграции.

---

## 5. Регрессионные тесты

Каждый известный баг из [TODO.md](./TODO.md) должен иметь E2E-тест:

| Баг | Статус теста |
|-----|:---:|
| Копирование параметров между комнатами | ✅ `room-input.spec.ts` |
| Потеря фокуса при вводе значений | ✅ `room-input.spec.ts` |
| Stale closure в `updateActiveProject` | ❌ Нужен тест |
| Некорректный пересчёт площади при наличии проёмов | ❌ Нужен тест |
| CSV-экспорт игнорировал extended/advanced режимы | ❌ Нужен тест |
| Дублирование объектов при отображении | ❌ Нужен тест |

---

## 6. Сроки

| Этап | Задачи | Дни |
|------|--------|:---:|
| 1. Инфраструктура | Конфиг Playwright, фикстуры, auth-стратегия, `data-testid` | 1.5 |
| 2. Исправление существующих | Убрать silent skips, waitForTimeout, хрупкие селекторы | 1 |
| 3. Высокий приоритет | §4.1–4.6 (23 теста) | 3 |
| 4. Средний приоритет | §4.7–4.9 (9 тестов) | 1.5 |
| 5. Низкий приоритет + регрессии | §4.10–4.11 + §5 (9 тестов) | 1 |
| **Итого** | | **8** |

---

## 7. Структура файлов

```
e2e/
├── fixtures.ts                  # Кастомный test с авторизацией
├── fixtures/
│   └── testData.ts              # Фикстуры ProjectData
├── pages/
│   ├── RoomEditorPage.ts        # POM: редактор комнаты
│   ├── SidebarPage.ts           # POM: сайдбары
│   └── SummaryPage.ts           # POM: общая смета
├── auth.spec.ts                 # Авторизация
├── core-workflow.spec.ts        # Сквозной процесс
├── rooms.spec.ts                # Управление комнатами
├── objects.spec.ts              # Управление объектами
├── geometry.spec.ts             # Режимы геометрии
├── works.spec.ts                # Работы и материалы
├── costs.spec.ts                # Расчёт стоимости
├── projects.spec.ts             # Управление проектами
├── export-import.spec.ts        # (существующий, исправленный)
├── work-templates.spec.ts       # (существующий, исправленный)
├── responsive.spec.ts           # Адаптивность
└── regressions.spec.ts          # Регрессионные тесты
```

---

## 8. Команды запуска

```bash
# Все тесты (Chromium)
npx playwright test --project=chromium

# Конкретный модуль
npx playwright test e2e/rooms.spec.ts

# Все браузеры
npx playwright test

# С UI-интерфейсом
npx playwright test --ui

# Проверка стабильности (10 прогонов)
npx playwright test --repeat-each=10

# Генерация отчёта
npx playwright show-report
```
