import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

// TODO: Требуют исправления работы с шаблонами
test.describe.skip('Work Templates Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Inject TEST_PROJECT so tests have a room to work with
    await page.addInitScript((projectData) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify([projectData]));
      localStorage.setItem('repair-calc-active-project', projectData.id);
    }, TEST_PROJECT);
    await page.goto('/');
  });

  test('should save work as template', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Добавляем работу через кнопку "Новая работа"
    await page.getByRole('button', { name: 'Новая работа' }).click();

    // Заполняем данные работы
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Тестовая работа для шаблона');

    // Сохраняем как шаблон
    const saveTemplateBtn = page.getByRole('button', { name: 'Сохранить как шаблон' });
    await expect(saveTemplateBtn).toBeVisible();
    await saveTemplateBtn.click();

    // Проверяем успешное сохранение
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();
  });

  test('should apply template to work', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('room-item-test-room-1').click();
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Шаблон для применения');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Проверяем, что модальное окно открылось
    await expect(page.locator('text=Шаблоны работ').first()).toBeVisible();

    // Выбираем первый доступный шаблон
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Проверяем, что работа добавлена
    await expect(page.getByTestId('work-name-input')).toBeVisible();
  });

  test('should search templates by name', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('room-item-test-room-1').click();
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Пол тестовый');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Вводим поисковый запрос
    const searchInput = page.locator('input[placeholder="Поиск шаблонов"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('пол');

    // Ждем фильтрации
    const results = page.getByTestId('work-template-item');
    await expect(results).not.toHaveCount(0);
  });

  test('should filter templates by category', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('room-item-test-room-1').click();
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Стены тестовые');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Выбираем категорию "Стены"
    const wallsCategory = page.getByRole('button', { name: 'Стены' });
    await expect(wallsCategory).toBeVisible();
    await wallsCategory.click();

    // Проверяем, что отображаются шаблоны
    const results = page.getByTestId('work-template-item');
    await expect(results).not.toHaveCount(0);
  });

  test('should delete template', async ({ page }) => {
    // Сначала создаем шаблон
    await page.getByTestId('room-item-test-room-1').click();
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Шаблон для удаления');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
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
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Создаем первый шаблон
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Существующий шаблон');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Закрываем работу (если открыта)
    await page.getByTestId('room-header-title').click();

    // Создаем вторую работу с тем же именем
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput2 = page.getByTestId('work-name-input');
    await nameInput2.fill('Существующий шаблон');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();

    // Если шаблон с таким именем уже существует, должно появиться предупреждение
    const confirmDialog = page.locator('text=Заменить?');

    // Проверяем наличие кнопок подтверждения
    await expect(confirmDialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Да' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Нет' })).toBeVisible();
  });

  test('should close template modal on cancel', async ({ page }) => {
    // Сначала создаем шаблон чтобы кнопка была активна
    await page.getByTestId('room-item-test-room-1').click();
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const nameInput = page.getByTestId('work-name-input');
    await nameInput.fill('Шаблон для закрытия');
    await page.getByRole('button', { name: 'Сохранить как шаблон' }).click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Открываем модальное окно шаблонов
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Проверяем, что модальное окно открылось
    await expect(page.locator('text=Шаблоны работ').first()).toBeVisible();

    // Закрываем по кнопке "Закрыть"
    await page.getByRole('button', { name: 'Закрыть' }).click();

    // Проверяем, что модальное окно закрылось
    await expect(page.locator('text=Выбор шаблона')).not.toBeVisible();
  });
});
