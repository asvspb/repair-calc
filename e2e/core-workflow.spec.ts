import { test, expect } from './fixtures';
import { TEST_PROJECT, TEST_PROJECT_MULTI_OBJECT, TEST_PROJECT_WITH_WORK } from './fixtures/testData';
import { SidebarPage } from './pages/SidebarPage';
import { RoomEditorPage } from './pages/RoomEditorPage';
import { SummaryPage } from './pages/SummaryPage';

test.describe('Core Workflow - End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage for fresh state
    await page.addInitScript(() => {
    });
  });

  test('Scenario 1: Full cycle - create project, add room, add work, view summary', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    const roomEditor = new RoomEditorPage(page);
    const summary = new SummaryPage(page);

    // 1. Имитируем авторизацию
    await page.addInitScript(() => {
    });

    await page.goto('/');

    // 2. Создаем новый проект через моки
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Переходим к созданию проекта
    await sidebar.newProjectBtn.click();
    
    const modal = page.getByTestId('create-project-modal');
    await expect(modal).toBeVisible();

    // Заполняем форму проекта
    await page.getByLabel('Название проекта *').fill('Тестовый проект');
    await page.getByPlaceholder('Например: Квартира').fill('Квартира');
    
    // Создаем проект
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // 3. Добавляем комнату
    await sidebar.addRoomBtn.click();

    // 4. Вводим размеры комнаты
    await roomEditor.setDimensions(5, 4, 2.7);

    // 5. Проверяем расчет площади пола = 20.00 м²
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('20.00');

    // 6. Добавляем работу
    await roomEditor.addWork();

    // 7. Заполняем работу
    const workNameInput = page.getByTestId('work-name-input');
    await expect(workNameInput).toBeVisible();
    await workNameInput.fill('Поклейка обоев');
    
    const workPriceInput = page.getByTestId('work-price-input');
    await workPriceInput.fill('500');

    // 8. Переходим на вкладку "Общая смета"
    await summary.navigateToSummary();

    // 9. Проверяем, что итоговая стоимость > 0
    const totalCost = await summary.getTotalCost();
    const costValue = parseInt(totalCost.replace(/\s/g, ''), 10);
    expect(costValue).toBeGreaterThan(0);
  });

  test('Scenario 2: Multiple objects in project', async ({ page }) => {
    // Имитируем авторизацию
    await page.addInitScript(() => {
    });

    // Загружаем фикстуру с несколькими объектами
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT_MULTI_OBJECT], activeId: TEST_PROJECT_MULTI_OBJECT.id });

    await page.goto('/');

    // Проверяем, что первый объект активен
    const objectSelector = page.getByTestId('object-selector');
    await expect(objectSelector).toBeVisible();
    
    // Проверяем наличие комнаты первого объекта
    await expect(page.getByTestId('room-item-test-room-1')).toBeVisible();

    // Переключаемся на второй объект
    await objectSelector.selectOption({ label: 'Офис' });

    // Проверяем наличие комнаты второго объекта
    await expect(page.getByTestId('room-item-test-room-2')).toBeVisible();

    // Переходим в "Общую смету"
    await page.getByRole('button', { name: 'Общая смета' }).click();

    // Проверяем группировку по объектам
    await expect(page.getByTestId('object-selector')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Квартира' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Офис' })).toBeVisible();
  });

  test('Scenario 3: Edit and recalculate', async ({ page }) => {
    // Имитируем авторизацию
    await page.addInitScript(() => {
    });

    // Загружаем фикстуру с работой
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT_WITH_WORK], activeId: TEST_PROJECT_WITH_WORK.id });

    await page.goto('/');

    const roomEditor = new RoomEditorPage(page);
    const summary = new SummaryPage(page);

    // 1. Переходим в комнату с работой
    await page.getByTestId('room-item-test-room-1').click();

    // 2. Проверяем начальную стоимость
    await summary.navigateToSummary();
    const initialCost = await summary.getTotalCost();
    
    // 3. Возвращаемся к комнате и изменяем цену работы
    await page.getByRole('button', { name: 'Назад' }).or(page.locator('button:has-text("Ванная")')).click();
    
    // Раскрываем работу
    const workItem = page.getByTestId('work-item-test-work-1');
    await workItem.click();

    // Изменяем цену
    const priceInput = page.getByTestId('work-price-input');
    await priceInput.clear();
    await priceInput.fill('2000');
    
    // Кликаем вне поля для сохранения
    await roomEditor.roomTitle.click();

    // 4. Проверяем пересчет в SummaryView
    await summary.navigateToSummary();
    const newCost = await summary.getTotalCost();
    
    // Стоимость должна увеличиться
    const initialValue = parseInt(initialCost.replace(/\s/g, ''), 10);
    const newValue = parseInt(newCost.replace(/\s/g, ''), 10);
    expect(newValue).toBeGreaterThan(initialValue);

    // 5. Изменяем размеры комнаты
    await page.getByRole('button', { name: 'Назад' }).or(page.locator('button:has-text("Ванная")')).click();
    await roomEditor.setDimensions(5, 4, 3);

    // 6. Проверяем пересчет площадей
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('20.00'); // 5 * 4 = 20

    // 7. Удаляем работу
    await roomEditor.addWork(); // This should show the work list
    const deleteWorkBtn = page.getByRole('button', { name: 'Удалить' }).first();
    await expect(deleteWorkBtn).toBeVisible();
    await deleteWorkBtn.click();
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    // 8. Проверяем, что итого уменьшилось
    await summary.navigateToSummary();
    const finalCost = await summary.getTotalCost();
    const finalValue = parseInt(finalCost.replace(/\s/g, ''), 10);
    expect(finalValue).toBeLessThan(newValue);
  });
});
