import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);
  });

  test('should not copy room parameters when switching rooms (known bug fix)', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Add new room
    await page.getByTestId('add-room-btn').click();
    const newRoomBtn = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await newRoomBtn.click();

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
    await page.getByTestId('room-item-test-room-1').click();

    // Room 1 should have different values
    await expect(page.getByTestId('geom-length')).toHaveValue('4');

    // Switch back to new room
    const newRoomBtn2 = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await newRoomBtn2.click();

    // Values should still be 7, 5, 3 (not copied from room 1)
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');
  });

  test('should not lose focus when typing values', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    const lengthInput = page.getByTestId('geom-length');

    // Start typing
    await lengthInput.click();
    await lengthInput.fill('5');

    // Continue typing
    await lengthInput.fill('56');

    // Now blur
    await page.getByTestId('room-header-title').click();

    // Final value should be 56 (not reset)
    await expect(lengthInput).toHaveValue('56');
  });

  test('should correctly recalculate area with openings', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Helper to extract numeric wall area from metric element
    const getWallAreaValue = async () => {
      const el = page.getByTestId('metric-wall-area');
      const text = await el.textContent();
      const match = text?.match(/(\d+\.?\d*)\s*м²/);
      return match ? parseFloat(match[1]) : NaN;
    };

    // Get initial wall area
    const initialValue = await getWallAreaValue();
    expect(initialValue).toBeGreaterThan(0);

    // Add window via OpeningList
    const addWindowBtn = page.getByTestId('add-window-btn');
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();

    // Fill window size
    const openingBlock = page.locator('[data-testid^="opening-item-"]').last();
    const numberInputs = openingBlock.locator('input[type="number"]');
    await expect(numberInputs.first()).toBeVisible({ timeout: 3000 });
    await numberInputs.first().fill('2');      // width
    await numberInputs.last().fill('1.5');     // height

    // Blur to save
    await page.getByTestId('room-header-title').click();

    // Wall area should decrease — wait for value to change
    await expect(async () => {
      const v = await getWallAreaValue();
      expect(v).toBeLessThan(initialValue);
    }).toPass({ timeout: 3000 });
  });

  test('should handle CSV export with extended/advanced modes', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Switch to extended mode
    await page.getByTestId('geom-mode-extended').click();

    // Export as CSV via settings
    await page.getByTestId('settings-btn').click();

    const exportCsvBtn = page.getByTestId('export-csv-btn');
    await expect(exportCsvBtn).toBeVisible({ timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportCsvBtn.click(),
    ]);

    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('.csv');
  });

  test('should not duplicate objects in display', async ({ page }) => {
    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Create multiple objects
    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Объект 1');
    await page.getByRole('button', { name: 'Создать' }).click();

    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Объект 2');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Check no duplicates in object selector
    const objectSelector = page.getByTestId('object-selector');
    await expect(objectSelector).toBeVisible({ timeout: 5000 });

    const options = objectSelector.locator('option');
    const count = await options.count();

    // Count occurrences of each object name
    const objectNames = await options.allTextContents();
    const uniqueNames = new Set(objectNames);

    // No duplicates
    expect(uniqueNames.size).toBe(count);
  });
});
