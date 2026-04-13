# 🔧 E2E-тесты: Ход исправлений

**Дата начала:** 2026-04-13  
**Цель:** Добиться >80% стабильного прохождения E2E-сьюта (52 теста)  
**Текущий статус:** 4/52 исправлено ✅

---

## ✅ Выполненные задачи

### objects.spec.ts — 4/4 тестов ✅ (2026-04-13)

| Тест | Статус |
|------|--------|
| should create object via CreateObjectModal | ✅ |
| should switch between objects | ✅ |
| should delete object with confirmation | ✅ |
| should save city for object | ✅ |

#### Найденные проблемы

**1. JWT-токен перезаписывает тестовые данные**

`fixtures.ts` инжектирует JWT-токен в `localStorage` через `addInitScript`. Токен оказался валидным для реального бэкенда (порт 3994). При загрузке приложения:
- `AuthContext.checkAuth()` → `getCurrentUser()` → `/api/auth/me` → сервер вернул **реального пользователя**
- `ProjectContext` → `loadProjectsAsync()` → `/api/sync/pull` → сервер вернул **реальные проекты** (4 объекта: "Гараж", "Дача", "Дом", "Моя недвижимость")
- Реальные данные перезаписали `TEST_PROJECT` в localStorage

**Решение:** В каждом тесте с API-моками — очищать auth-токены в `beforeEach`:
```typescript
await page.addInitScript(() => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.setItem('e2e-test-mode', 'true');
});
```

**2. `<option>` элементы внутри `<select>` не считаются `visible`**

`getByRole('option', { name: '...' })` возвращает статус `hidden` даже когда `<select>` открыт.

**Решение:** Использовать `selector.locator('option', { hasText: '...' })` для проверки наличия опции.

**3. `window.confirm()` требует перехвата**

Кнопка удаления объекта вызывает `window.confirm()`. Playwright не обрабатывает `confirm` автоматически.

**Решение:** `page.once('dialog', dialog => dialog.accept())` перед кликом.

**4. Strict mode violation на `getByRole('button', { name: 'Удалить' })`**

На странице есть кнопка удаления объекта и кнопка удаления проекта — обе с текстом "Удалить".

**Решение:** Использовать `data-testid="delete-object-btn"` вместо текстового поиска.

#### Изменения в `e2e/objects.spec.ts`

- Убрана сломанная структура: `test.beforeEach` был потерян, код оказался на уровне `describe`
- Добавлена очистка auth-токенов
- Исправлены все селекторы
- `window.confirm` → `page.once('dialog')`

#### Изменения в `src/` (data-testid)

- `src/components/layout/ObjectSettings.tsx` — `data-testid="delete-object-btn"`, `data-testid="object-selector"`, `data-testid="city-select"`
- `src/App.tsx` — `data-testid="mobile-menu-btn"`
- `src/components/layout/LeftSidebar.tsx` — проп `onDeleteObject`
- `src/components/objects/CreateObjectModal.tsx` — уже был `data-testid="create-object-modal"`

---

## 🔴 Осталось исправить

| Файл | Тестов | Основная проблема |
|------|--------|-------------------|
| `export-import.spec.ts` | 6 | Auth-токены при `localStorage.clear()` |
| `work-templates.spec.ts` | 7 | Auth-токены при `localStorage.clear()` |
| `room-input.spec.ts` | 3 | 0 data-testid, текстовые селекторы |
| `rooms.spec.ts` | 5 | Текстовые селекторы |
| `geometry.spec.ts` | 4 | Текстовые селекторы |
| `works.spec.ts` | 4 | `.first()` на амбиiguous селекторах |
| `core-workflow.spec.ts` | 3 | Зависит от авторизации |
| `regressions.spec.ts` | 5 | Смешанные проблемы |
| `responsive.spec.ts` | 2 | CSS-классы в тестах |
| `costs.spec.ts` | 3 | Зависит от seeded-данных |
| `projects.spec.ts` | 3 | Зависит от авторизации |
| `auth.spec.ts` | 3 | Тестирует логин (может работать) |

---

## 📋 План дальнейшей работы

1. **Применить паттерн очистки auth-токенов** к `export-import.spec.ts` и `work-templates.spec.ts` (13 тестов)
2. **Массово добавить data-testid** в компоненты для оставшихся тестов
3. **Заменить текстовые селекторы** на `data-testid`/`getByRole`
4. **Запустить полный сьют** и проверить >80% pass rate
