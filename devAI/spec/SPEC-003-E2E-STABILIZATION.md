# 📋 Техническое задание: Стабилизация E2E тестов (Приоритет 0)
## SPEC-003-E2E-STABILIZATION — Восстановление и стабилизация E2E-покрытия

**Версия:** 1.1  
**Дата создания:** 2026-04-17  
**Статус:** Реализовано  
**Приоритет:** 0 (КРИТИЧЕСКИЙ)  

---

## 1. Цель задачи

Восстановить работоспособность E2E тестов до уровня >80% pass rate для Chromium. На текущий момент 135 из 156 тестов пропущены через `test.describe.skip`, а 11 из 21 активных тестов падают.

**Текущий статус:** 10 passed, 11 failed, 135 skipped (из ~156)

---

## 2. Проблематика

### 2.1 Зафиксированные проблемы

| # | Проблема | Влияние | Решение |
|---|----------|---------|---------|
| P-01 | Фикстуры с хардкод JWT-токенами (истекают) | Тесты с API-вызовами падают | Переписать на API-моки через `page.route()` |
| P-02 | `e2e-test-mode` не предотвращает загрузку данных с сервера | localStorage-данные затираются реальными данными | Удалить токены в beforeEach как в objects.spec.ts |
| P-03 | Нет `data-testid` на кнопках окон/дверей | Тесты openings не могут найти элементы | Добавить `data-testid` в OpeningList.tsx |
| P-04 | Нет `data-testid` на мобильных кнопках меню | Responsive-тесты падают | Добавить `data-testid` в App.tsx |
| P-05 | Тесты используют `getByRole('button', { name: '...' })` с несуществующим текстом | Необходима сверка с актуальными лейблами | Обновить тесты под реальный UI |
| P-06 | Экспорт/импорт тесты ищут несуществующие селекторы | 6 тестов пропущены | Обновить под BackupManager data-testid |
| P-07 | Тесты costs/works используют несуществующие testid (`work-quantity-input` в summary) | 7 тестов пропущены | Переписать навигацию |

### 2.2 Архитектурные проблемы

1. **Два подхода к аутентификации в тестах:**
   - objects.spec.ts — **удаляет** токены, работает только через localStorage ✅
   - Остальные — **инжектят** токены через addInitScript, но те истекают ❌

2. **Два подхода к данным:**
   - localStorage-seed (addInitScript) — данные в localStorage, но при наличии токена приложение делает `/api/sync/pull` и затирает
   - API-mock (page.route) — мокирование ответов сервера

**Решение:** Единый подход — localStorage-seed + удаление токенов + моки API на все `/api/**` запросы (return 200 + пустые данные).

---

## 3. Стратегия исправления

### 3.1 Унифицированный beforeEach

```typescript
test.beforeEach(async ({ page }) => {
  // 1. Удаляем токены чтобы приложение не ходило на сервер
  await page.addInitScript(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.setItem('e2e-test-mode', 'true');
  });

  // 2. Сидируем localStorage тестовыми данными
  await page.addInitScript((data) => {
    localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
    localStorage.setItem('repair-calc-active-project', data.activeId);
  }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });

  // 3. Мокируем все API-запросы (приложение может пытаться делать sync/pull)
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/me') || url.includes('/api/sync/pull')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    } else {
      await route.fulfill({ status: 200, body: '{}' });
    }
  });

  await page.goto('/');
});
```

### 3.2 Добавление недостающих data-testid

| Компонент | testid | Текущий статус |
|-----------|--------|----------------|
| `OpeningList.tsx` | `add-window-btn`, `add-door-btn` | ❌ Отсутствует (используется динамический) |
| `App.tsx` | `mobile-menu-btn` | ✅ Уже есть |
| `ExtendedGeometry.tsx` | `add-section-btn` | ✅ Уже есть |
| `WorkListItem.tsx` | `work-price-input` | ❌ Нет (есть в RoomEditor) |
| `WorkListItem.tsx` | `work-toggle-btn` | ❌ Отсутствует |
| `RoomEditor.tsx` | `add-work-custom-btn` | ❌ Нет (кнопка "Новая работа") |

### 3.3 Приоритет исправления тестов

#### Фаза 1: Легкие исправления (селекторы + data-testid)
1. **geometry.spec.ts** (4 теста) — обновить селекторы для OpeningList
2. **rooms.spec.ts** (5 тестов) — убрать зависимость от API, обновить beforeEach
3. **room-input.spec.ts** (3 теста) — аналогично rooms

#### Фаза 2: Средние исправления (UI-навигация)
4. **works.spec.ts** (4 теста) — обновить навигацию по работам
5. **costs.spec.ts** (3 теста) — исправить расчёт стоимости
6. **work-templates.spec.ts** (7 тестов) — обновить навигацию по шаблонам

#### Фаза 3: Сложные исправления (API-моки + полные флоу)
7. **core-workflow.spec.ts** (3 теста) — полный флоу с моками
8. **export-import.spec.ts** (6 тестов) — BackupManager UI
9. **projects.spec.ts** (3 теста) — создание проектов через UI

#### Фаза 4: Специфичные
10. **regressions.spec.ts** (5 тестов) — баг-фиксы + openings
11. **responsive.spec.ts** (2 теста) — мобильный viewport

---

## 4. Детальный план исправления по файлам

### 4.1 Добавить data-testid в компоненты

**Файл: `src/components/geometry/OpeningList.tsx`**
- Добавить `data-testid="add-window-btn"` на кнопку добавления окна
- Добавить `data-testid="add-door-btn"` на кнопку добавления двери

**Файл: `src/components/works/WorkListItem.tsx`**
- Добавить `data-testid="work-toggle-btn"` на кнопку вкл/выкл работы
- Добавить `data-testid="work-price-input"` на инпут цены (если не вынесен в RoomEditor)

### 4.2 Обновить фикстуры

**Файл: `e2e/fixtures.ts`**
- Удалить хардкод JWT-токенов
- Добавить хелпер `setupTestEnvironment(page, data)` для унифицированного beforeEach

### 4.3 Обновить тесты

Каждый `.spec.ts` файл:
1. Заменить `test.describe.skip` → `test.describe`
2. Унифицировать `beforeEach` (удаление токенов + localStorage seed + API моки)
3. Обновить селекторы под реальные `data-testid`
4. Убрать `waitForTimeout` — заменить на `waitFor` / `toBeVisible`
5. Использовать Page Objects из `e2e/pages/`

---

## 5. Критерии приемки

1. `npx playwright test --project=chromium` — **>80% тестов проходят** (>= 125 из 156)
2. Все `test.describe.skip` сняты
3. Нет `waitForTimeout` в тестах
4. Все селекторы используют `data-testid` или `getByRole` (нет CSS-селекторов)
5. Каждый тест использует унифицированный `beforeEach`
6. Тесты стабильны при 3 последовательных запусках

---

## 6. Метрики

| Метрика | До | Цель |
|---------|-----|------|
| Пройденных тестов | 10/156 (6%) | 125/156 (80%) |
| Пропущенных тестов | 135 | 0 |
| Стабильность (3 runs) | Н/Д | 100% |
| Файлов с skip | 11 | 0 |

---

**Автор:** Buffy (Codebuff AI Agent)  
**Связанные документы:**  
* [SPEC-002-E2E-REPAIR.md](./SPEC-002-E2E-REPAIR.md) — Предыдущая версия ТЗ  
* [SPEC-001-SYSTEM.md](./SPEC-001-SYSTEM.md) — Системная спецификация  
* [TODO.md](../../docs/TODO.md) — Бэклог задач
