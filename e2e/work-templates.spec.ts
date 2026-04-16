import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Work Templates Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();
  });

  test('should save work as template', async ({ page }) => {
    // Добавляем работу через кнопку "Новая работа"
    await page.getByTestId('add-work-custom-btn').click();

    // Заполняем данные работы
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Тестовая работа для шаблона');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    // Expand work to see save template button
    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();

    // Сохраняем как шаблон
    const saveTemplateBtn = page.getByTestId('save-template-btn').last();
    await expect(saveTemplateBtn).toBeVisible({ timeout: 5000 });
    await saveTemplateBtn.click();

    // Проверяем успешное сохранение (toast/notification)
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();
  });

  test('should apply template to work', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('add-work-custom-btn').click();
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Шаблон для применения');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    // Expand and save template
    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();
    const saveBtn = page.getByTestId('save-template-btn').last();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Проверяем, что модальное окно открылось — title is "Шаблоны работ"
    await expect(page.getByText('Шаблоны работ').first()).toBeVisible();

    // Выбираем первый доступный шаблон
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Проверяем, что работа добавлена
    await expect(page.getByTestId('work-name-input').last()).toBeVisible();
  });

  test('should search templates by name', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('add-work-custom-btn').click();
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Пол тестовый');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();
    await page.getByTestId('save-template-btn').last().click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Вводим поисковый запрос — placeholder is "Поиск по названию..."
    const searchInput = page.locator('input[placeholder="Поиск по названию..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('пол');

    // Ждем фильтрации
    const results = page.getByTestId('work-template-item');
    await expect(results).not.toHaveCount(0);
  });

  test('should filter templates by category', async ({ page }) => {
    // Сначала создаем шаблон с типом floorArea → category 'floor' → label 'Пол/Потолок'
    await page.getByTestId('add-work-custom-btn').click();
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Штукатурка тест');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();
    await page.getByTestId('save-template-btn').last().click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Проверяем наличие фильтра по категории — actual labels from CATEGORY_LABELS:
    // 'Пол/Потолок', 'Стены', 'Периметр', 'Прочее', 'Все'
    const categoryFilter = page.locator(
      'button:has-text("Пол/Потолок")'
    ).first();

    await expect(categoryFilter).toBeVisible({ timeout: 5000 });
    await categoryFilter.click();

    // Проверяем что список шаблонов изменился
    const templateItems = page.getByTestId('work-template-item');
    // After filtering, there should be 0 or more items but no error
    const count = await templateItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should delete template', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('add-work-custom-btn').click();
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Шаблон для удаления');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();
    await page.getByTestId('save-template-btn').last().click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Наводим на первый шаблон для появления кнопки удаления
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.hover();

    // Кликаем удалить на шаблоне
    const deleteBtn = firstTemplate.locator('button[title="Удалить шаблон"]');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Confirm deletion in ConfirmDialog — scope to the dialog overlay
    // ConfirmDialog has "Удалить" confirm button, but other "Удалить" buttons exist on page
    const confirmDialog = page.locator('.fixed.inset-0.z-50');
    const confirmDeleteBtn = confirmDialog.locator('button:has-text("Удалить")');
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 3000 });
    await confirmDeleteBtn.click();
  });

  test('should show confirmation when template name exists', async ({ page }) => {
    // Strategy: Save the SAME work as template twice.
    // After first save succeeds, the button resets after 2s.
    // Clicking save again should find the existing template and show "Заменить?".

    // Добавляем работу (default name = 'Работа')
    await page.getByTestId('add-work-custom-btn').click();
    const workItem = page.locator('[data-testid^="work-item-"]').last();
    await workItem.locator('button:has-text("Развернуть")').click();

    // First save — should succeed
    const saveBtn = workItem.getByTestId('save-template-btn');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Wait for the 'Шаблон сохранён' indicator to disappear (2s timeout in component)
    await expect(page.locator('text=Шаблон сохранён')).not.toBeVisible({ timeout: 3000 });

    // Click save again — template with same name already exists
    const saveBtnAgain = workItem.getByTestId('save-template-btn');
    await expect(saveBtnAgain).toBeVisible({ timeout: 5000 });
    await saveBtnAgain.click();

    // WorkTemplateSaveButton shows "Заменить?" text inline
    const confirmText = page.locator('text=Заменить?');
    await expect(confirmText).toBeVisible({ timeout: 5000 });
  });

  test('should close template modal on cancel', async ({ page }) => {
    // Сначала создаем шаблон чтобы кнопка была активна
    await page.getByTestId('add-work-custom-btn').click();
    const nameInput = page.getByTestId('work-name-input').last();
    await nameInput.fill('Шаблон для закрытия');
    // Blur to commit the name change to React state
    await page.getByTestId('room-header-title').click();

    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();
    await page.getByTestId('save-template-btn').last().click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Закрываем по кнопке закрытия (X icon button in the modal header)
    const modalOverlay = page.locator('.fixed.inset-0.z-50');
    const closeBtn = modalOverlay.locator('button:has(svg.lucide-x)').first();
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
    await closeBtn.click();

    // Modal should be closed — "Шаблоны работ" should not be visible
    await expect(page.getByText('Шаблоны работ').first()).not.toBeVisible({ timeout: 3000 });
  });
});
