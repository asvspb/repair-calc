import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT_WITH_WORK } from './fixtures/testData';

test.describe('Works and Materials', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT_WITH_WORK], TEST_PROJECT_WITH_WORK.id);

    // Navigate to the room — scroll into view if needed
    const roomItem = page.getByTestId('room-item-test-room-1');
    await roomItem.scrollIntoViewIfNeeded();
    await roomItem.click();
  });

  test('should add work and fill fields', async ({ page }) => {
    // Add work via "Новая работа" button
    await page.getByTestId('add-work-custom-btn').click();

    // The new work is added. Find the new work's name input (last one)
    const newWorkNameInput = page.getByTestId('work-name-input').last();
    await expect(newWorkNameInput).toBeVisible();
    await newWorkNameInput.scrollIntoViewIfNeeded();
    await newWorkNameInput.fill('Штукатурка стен');

    // Expand the work to see price input — click "Развернуть" button inside the work item
    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();

    // Now the expanded content should be visible
    const workPriceInput = page.getByTestId('work-price-input').last();
    await expect(workPriceInput).toBeVisible({ timeout: 5000 });
    await workPriceInput.scrollIntoViewIfNeeded();
    await workPriceInput.fill('800');

    // Verify cost calculated — click outside to trigger save
    await page.getByTestId('room-header-title').click();

    // Check that work-cost element exists for the new work
    const workCost = page.getByTestId('work-cost').last();
    await expect(workCost).toBeVisible();
  });

  test('should add material to work', async ({ page }) => {
    // Click on existing work to expand
    const workItem = page.locator('[data-testid="work-item-test-work-1"]');
    await workItem.locator('button:has-text("Развернуть")').click();

    // Add material
    const addMaterialBtn = page.getByTestId('add-material-btn');
    await expect(addMaterialBtn).toBeVisible();
    await addMaterialBtn.click();

    // Fill material details
    const materialNameInput = page.getByTestId('material-name-input').last();
    await materialNameInput.fill('Плиточный клей');

    const materialUnitInput = page.getByTestId('material-unit-input').last();
    await materialUnitInput.fill('кг');

    // Verify material row is visible
    await expect(materialNameInput).toHaveValue('Плиточный клей');
  });

  test('should toggle work enabled/disabled', async ({ page }) => {
    // Get initial total from room metrics
    const roomCostEl = page.getByTestId('room-cost-value');
    const initialCostText = await roomCostEl.textContent();
    const initialCost = parseInt((initialCostText ?? '0').replace(/\s/g, ''), 10);

    // Disable work via the toggle button
    const toggleBtn = page.getByTestId('work-toggle-btn');
    await toggleBtn.click();

    // Verify total decreased (disabled work should not be counted)
    await expect(roomCostEl).not.toContainText(initialCostText ?? '', { timeout: 3000 });
    const newCostText = await roomCostEl.textContent();
    const newCost = parseInt((newCostText ?? '0').replace(/\s/g, ''), 10);
    expect(newCost).toBeLessThan(initialCost);
  });

  test('should apply template from catalog', async ({ page }) => {
    // First create a template so the button is enabled
    await page.getByTestId('add-work-custom-btn').click();
    const workNameInput = page.getByTestId('work-name-input').last();
    await expect(workNameInput).toBeVisible();
    await workNameInput.fill('Шаблон для теста');

    // Expand the work to see save template button
    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    await lastWorkItem.locator('button:has-text("Развернуть")').click();

    // Use .last() to target the newly added work's save button
    const saveTemplateBtn = page.getByTestId('save-template-btn').last();
    await expect(saveTemplateBtn).toBeVisible();
    await saveTemplateBtn.click();

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
    await expect(page.getByTestId('work-name-input').last()).toBeVisible();
  });
});
