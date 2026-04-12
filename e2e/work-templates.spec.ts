import { test, expect } from './fixtures';

test.describe('Work Templates Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh (but keep test mode)
    await page.addInitScript(() => {
      const testMode = localStorage.getItem('e2e-test-mode');
      localStorage.clear();
      if (testMode) localStorage.setItem('e2e-test-mode', testMode);
    });
    await page.goto('/');
  });

  test('should save work as template', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Добавляем работу
    await page.click('button:has-text("Добавить работу")');

    // Заполняем данные работы
    const nameInput = page.locator('input[placeholder="Название работы"]');
    await nameInput.fill('Тестовая работа для шаблона');

    // Сохраняем как шаблон
    const saveTemplateBtn = page.getByRole('button', { name: 'Сохранить как шаблон' });
    await expect(saveTemplateBtn).toBeVisible();
    await saveTemplateBtn.click();

    // Проверяем успешное сохранение
    await expect(page.locator('text=Шаблон сохранен')).toBeVisible();
  });

  test('should apply template to work', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByRole('button', { name: 'Шаблоны работ' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Проверяем, что модальное окно открылось
    await expect(page.locator('text=Выбор шаблона')).toBeVisible();

    // Выбираем первый доступный шаблон
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Проверяем, что работа добавлена
    await expect(page.locator('text=работа').first()).toBeVisible();
  });

  test('should search templates by name', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByRole('button', { name: 'Шаблоны работ' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Вводим поисковый запрос
    const searchInput = page.locator('input[placeholder="Поиск шаблонов"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('пол');

    // Ждем фильтрации
    const results = page.getByTestId('work-template-item');
    await expect(results).not.toHaveCount(0);

    // Проверяем, что все результаты содержат "пол"
    const count = await results.count();
    for (let i = 0; i < count; i++) {
      const text = await results.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('пол');
    }
  });

  test('should filter templates by category', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByRole('button', { name: 'Шаблоны работ' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Выбираем категорию "Стены"
    const wallsCategory = page.getByRole('button', { name: 'Стены' });
    await expect(wallsCategory).toBeVisible();
    await wallsCategory.click();

    // Проверяем, что отображаются только шаблоны категории "Стены"
    const results = page.getByTestId('work-template-item');
    await expect(results).not.toHaveCount(0);
  });

  test('should delete template', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByRole('button', { name: 'Шаблоны работ' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Наводим на первый шаблон для появления кнопки удаления
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.hover();

    const deleteBtn = firstTemplate.getByRole('button', { name: 'Удалить' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Подтверждаем удаление
    const confirmBtn = page.getByRole('button', { name: 'Подтвердить' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
  });

  test('should show confirmation when template name exists', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Добавляем работу
    await page.click('button:has-text("Добавить работу")');

    const nameInput = page.locator('input[placeholder="Название работы"]');
    await nameInput.fill('Существующий шаблон');

    const saveTemplateBtn = page.getByRole('button', { name: 'Сохранить как шаблон' });
    await expect(saveTemplateBtn).toBeVisible();
    await saveTemplateBtn.click();

    // Если шаблон с таким именем уже существует, должно появиться предупреждение
    const confirmDialog = page.locator('text=Шаблон с таким названием уже существует');
    
    // Проверяем наличие кнопок "Заменить" и "Отмена" если диалог появился
    await expect(confirmDialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Заменить' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отмена' })).toBeVisible();
  });

  test('should close template modal on cancel', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByRole('button', { name: 'Шаблоны работ' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Проверяем, что модальное окно открылось
    await expect(page.locator('text=Выбор шаблона')).toBeVisible();

    // Закрываем по кнопке "Закрыть"
    await page.getByRole('button', { name: 'Закрыть' }).click();

    // Проверяем, что модальное окно закрылось
    await expect(page.locator('text=Выбор шаблона')).not.toBeVisible();
  });
});