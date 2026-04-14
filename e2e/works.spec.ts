import { test, expect } from './fixtures';
import { TEST_PROJECT_WITH_WORK } from './fixtures/testData';

test.describe('Works and Materials', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT_WITH_WORK], activeId: TEST_PROJECT_WITH_WORK.id });

    await page.goto('/');

    // Navigate to the room
    await page.getByTestId('room-item-test-room-1').click();
  });

  test('should add work and fill fields', async ({ page }) => {
    // Add work via "Новая работа" button
    await page.getByRole('button', { name: 'Новая работа' }).click();

    // Fill work name - use first() to avoid strict mode violation
    const workNameInput = page.getByTestId('work-name-input').first();
    await expect(workNameInput).toBeVisible();
    await workNameInput.fill('Штукатурка стен');

    // Fill price
    const workPriceInput = page.getByTestId('work-price-input').first();
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

    // Go back to room
    await page.getByTestId('room-item-test-room-1').click();

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
    // Open work template catalog
    const templatesBtn = page.getByTestId('templates-btn');
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Select a template
    const firstTemplate = page.getByTestId('work-template-item').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Verify work added with fields filled
    await expect(page.getByTestId('work-name-input')).toBeVisible();
  });
});
