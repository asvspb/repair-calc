import { test, expect } from './fixtures';
import { TEST_PROJECT_WITH_WORK } from './fixtures/testData';

// TODO: Требуют исправления работы с шаблонами
test.describe.skip('Works and Materials', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT_WITH_WORK], activeId: TEST_PROJECT_WITH_WORK.id });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to the room — scroll into view if needed
    const roomItem = page.getByTestId('room-item-test-room-1');
    await roomItem.scrollIntoViewIfNeeded();
    await roomItem.click();
  });

  test('should add work and fill fields', async ({ page }) => {
    // Add work via "Новая работа" button
    await page.getByRole('button', { name: 'Новая работа' }).click();

    // The new work is added but NOT expanded. We need to expand it first.
    // The newly added work appears as a WorkListItem — click on it to expand
    const newWorkItem = page.getByTestId('work-name-input').last();
    await expect(newWorkItem).toBeVisible();

    // Click on the work item to expand it (the name input is inside the collapsed view too)
    // Actually, the name input is visible in collapsed mode. Let's fill it directly.
    await newWorkItem.scrollIntoViewIfNeeded();
    await newWorkItem.fill('Штукатурка стен');

    // The price input is only visible when work is expanded.
    // The work name input in collapsed mode is the one in the WorkListItem header.
    // Let's expand the work by clicking the work item row
    const workRow = page.locator('[data-testid^="work-item-"]').last();
    await workRow.click();

    // Now the expanded content should be visible
    const workPriceInput = page.getByTestId('work-price-input').last();
    await expect(workPriceInput).toBeVisible({ timeout: 5000 });
    await workPriceInput.scrollIntoViewIfNeeded();
    await workPriceInput.fill('800');

    // Verify cost calculated
    await expect(page.locator('text=Стоимость работы:').first()).toBeVisible();
  });

  test('should add material to work', async ({ page }) => {
    // Click on existing work to expand
    await page.getByTestId('work-item-test-work-1').click();

    // Add material
    const addMaterialBtn = page.getByRole('button', { name: 'Добавить материал' });
    await expect(addMaterialBtn).toBeVisible();
    await addMaterialBtn.click();

    // Fill material details
    await page.getByPlaceholder('Название').first().fill('Плиточный клей');
    await page.locator('input[placeholder="ед."]').first().fill('кг');

    // Verify quantity calculated based on area
    await expect(page.locator('text=м²').first()).toBeVisible();
  });

  test('should toggle work enabled/disabled', async ({ page }) => {
    // Get initial total from summary
    await page.getByRole('button', { name: 'Общая смета' }).click();
    const initialTotal = await page.getByTestId('summary-total-cost').textContent();

    // Go back to room — scroll into view if needed
    const roomItem = page.getByTestId('room-item-test-room-1');
    await roomItem.scrollIntoViewIfNeeded();
    await roomItem.click();

    // Disable work via the checkbox/toggle button
    const toggleBtn = page.locator('[data-testid="work-item-test-work-1"] button[title="Отключить"]');
    await toggleBtn.click();

    // Verify total decreased
    await page.getByRole('button', { name: 'Общая смета' }).click();
    const newTotal = await page.getByTestId('summary-total-cost').textContent();

    const initialValue = parseInt(initialTotal?.replace(/\s/g, '') ?? '0', 10);
    const newValue = parseInt(newTotal?.replace(/\s/g, '') ?? '0', 10);
    expect(newValue).toBeLessThan(initialValue);
  });

  test('should apply template from catalog', async ({ page }) => {
    // First create a template so the button is enabled
    await page.getByRole('button', { name: 'Новая работа' }).click();
    const workNameInput = page.getByTestId('work-name-input').last();
    await expect(workNameInput).toBeVisible();
    await workNameInput.fill('Шаблон для теста');

    // Use .last() to target the newly added work's save button (strict mode violation fix)
    const saveTemplateBtn = page.getByTestId('save-template-btn').last();
    await expect(saveTemplateBtn).toBeVisible();
    await saveTemplateBtn.click();
    await expect(page.locator('text=Шаблон сохранён')).toBeVisible();

    // Navigate back to room
    const roomItem = page.getByTestId('room-item-test-room-1');
    await roomItem.scrollIntoViewIfNeeded();
    await roomItem.click();

    // Open work template catalog
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await expect(templatesBtn).toBeEnabled();
    await templatesBtn.click();

    // Select a template
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Verify work added with fields filled
    await expect(page.getByTestId('work-name-input')).toBeVisible();
  });
});
