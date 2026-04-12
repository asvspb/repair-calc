import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.goto('/');
  });

  test('should not copy room parameters when switching rooms (known bug fix)', async ({ page }) => {
    // Add new room
    await page.getByTestId('add-room-btn').click();
    await page.getByRole('button', { name: 'Новая комната' }).click();

    // Enter unique dimensions
    const lengthInput = page.getByTestId('geom-length');
    const widthInput = page.getByTestId('geom-width');
    const heightInput = page.getByTestId('geom-height');

    await lengthInput.fill('7');
    await widthInput.fill('5');
    await heightInput.fill('3');

    // Blur to save
    await page.getByTestId('room-header-title').click();

    // Verify values saved
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');

    // Switch to room 1
    await page.getByRole('button', { name: 'Комната 1' }).click();

    // Room 1 should have different values
    const room1Length = page.getByTestId('geom-length');
    await expect(room1Length).toHaveValue('4');

    // Switch back to new room
    await page.getByRole('button', { name: 'Новая комната' }).click();

    // Values should still be 7, 5, 3 (not copied from room 1)
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');
  });

  test('should not lose focus when typing values', async ({ page }) => {
    await page.getByRole('button', { name: 'Комната 1' }).click();

    const lengthInput = page.getByTestId('geom-length');

    // Start typing
    await lengthInput.click();
    await lengthInput.fill('5');

    // Don't blur - continue typing
    await lengthInput.pressSequentially('6');

    // Now blur
    await page.getByTestId('room-header-title').click();

    // Final value should be 56 (not reset)
    await expect(lengthInput).toHaveValue('56');
  });

  test('should correctly recalculate area with openings', async ({ page }) => {
    await page.getByRole('button', { name: 'Комната 1' }).click();

    // Get initial wall area
    const initialWallArea = page.getByTestId('metric-wall-area');
    const initialText = await initialWallArea.textContent();

    // Add window
    const addWindowBtn = page.getByRole('button', { name: 'Добавить окно' });
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();

    // Fill window size
    await page.getByLabel('Ширина окна').first().fill('2');
    await page.getByLabel('Высота окна').first().fill('1.5');

    // Wall area should decrease
    const newWallArea = page.getByTestId('metric-wall-area');
    const newText = await newWallArea.textContent();
    
    const initialValue = parseFloat(initialText ?? '0');
    const newValue = parseFloat(newText ?? '0');
    expect(newValue).toBeLessThan(initialValue);
  });

  test('should handle CSV export with extended/advanced modes', async ({ page }) => {
    await page.getByRole('button', { name: 'Комната 1' }).click();

    // Switch to extended mode
    await page.getByTestId('geom-mode-extended').click();

    // Export as CSV
    await page.click('button:has-text("Экспорт/Импорт")');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Экспорт CSV")'),
    ]);

    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('.csv');
  });

  test('should not duplicate objects in display', async ({ page }) => {
    // Create multiple objects
    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Объект 1');
    await page.getByRole('button', { name: 'Создать' }).click();

    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Объект 2');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Check no duplicates in object selector
    const objectSelector = page.getByTestId('object-selector');
    await objectSelector.click();

    const options = page.locator('option');
    const count = await options.count();
    
    // Count occurrences of each object name
    const objectNames = await options.allTextContents();
    const uniqueNames = new Set(objectNames);
    
    // No duplicates
    expect(uniqueNames.size).toBe(count);
  });
});
