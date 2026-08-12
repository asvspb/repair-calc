import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Export/Import Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();
  });

  test('should export project data as JSON', async ({ page }) => {
    // Open settings/data management
    await page.getByTestId('settings-btn').click();

    // Click export JSON button
    const exportJsonBtn = page.getByTestId('export-json-btn');
    await expect(exportJsonBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportJsonBtn.click(),
    ]);

    // Verify file downloaded
    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('.json');
  });

  test('should export project data as CSV', async ({ page }) => {
    // Open settings
    await page.getByTestId('settings-btn').click();

    const exportCsvBtn = page.getByTestId('export-csv-btn');
    await expect(exportCsvBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportCsvBtn.click(),
    ]);

    // Verify file downloaded
    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('.csv');
  });

  test('should show import file input', async ({ page }) => {
    // Open settings
    await page.getByTestId('settings-btn').click();

    // Verify import file input exists
    const fileInput = page.getByTestId('import-file-input');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
  });

  test('should import project from JSON file', async ({ page }) => {
    // First export
    await page.getByTestId('settings-btn').click();

    const exportJsonBtn = page.getByTestId('export-json-btn');
    await expect(exportJsonBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportJsonBtn.click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Find and use import file input
    const fileInput = page.getByTestId('import-file-input');
    await expect(fileInput).toBeAttached({ timeout: 10000 });

    await fileInput.setInputFiles(downloadPath!);

    // Import shows a confirm dialog — DataManagementModal uses "Заменить" button
    const confirmBtn = page.locator('button:has-text("Заменить")');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Verify import success message
    await expect(
      page.locator('text=успешно импортирован').or(page.locator('text=Данные успешно импортированы'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid JSON file', async ({ page }) => {
    await page.getByTestId('settings-btn').click();

    const fileInput = page.getByTestId('import-file-input');
    await expect(fileInput).toBeAttached({ timeout: 10000 });

    // Create invalid JSON file and upload it
    const fs = await import('fs');
    const invalidJsonPath = '/tmp/test-invalid-import.json';
    fs.writeFileSync(invalidJsonPath, 'this is not valid json {{{');

    await fileInput.setInputFiles(invalidJsonPath);

    // Verify error message appears
    await expect(
      page.locator('text=Неверный формат').or(page.locator('text=Ошибка'))
    ).toBeVisible({ timeout: 10000 });

    // Cleanup
    fs.unlinkSync(invalidJsonPath);
  });

  test('should create backup via JSON export', async ({ page }) => {
    await page.getByTestId('settings-btn').click();

    const exportJsonBtn = page.getByTestId('export-json-btn');
    await expect(exportJsonBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportJsonBtn.click(),
    ]);
    expect(download).toBeTruthy();
  });

  test('should restore from backup', async ({ page }) => {
    // First create a backup
    await page.getByTestId('settings-btn').click();

    const exportJsonBtn = page.getByTestId('export-json-btn');
    await expect(exportJsonBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportJsonBtn.click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Close the DataManagementModal — click the X button in the modal header
    const modalCloseBtn = page.locator('.fixed.inset-0.z-50').locator('button:has(svg.lucide-x)').first();
    await modalCloseBtn.click();
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 5000 });

    // Change room dimensions
    const lengthInput = page.getByTestId('geom-length');
    await expect(lengthInput).toBeVisible({ timeout: 5000 });
    await lengthInput.fill('99');
    await page.getByTestId('room-header-title').click();
    await expect(lengthInput).toHaveValue('99');

    // Restore from backup — open settings again
    await page.getByTestId('settings-btn').click();

    const fileInput = page.getByTestId('import-file-input');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    await fileInput.setInputFiles(downloadPath!);

    // Confirm import — DataManagementModal uses "Заменить" button
    const confirmBtn = page.locator('button:has-text("Заменить")');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Verify import success message
    await expect(
      page.locator('text=успешно импортирован').or(page.locator('text=Данные успешно импортированы'))
    ).toBeVisible({ timeout: 10000 });

    // Close the modal and verify data was restored (length should return to original value)
    const modalCloseBtn2 = page.locator('.fixed.inset-0.z-50').locator('button:has(svg.lucide-x)').first();
    await modalCloseBtn2.click();
    await page.getByTestId('room-item-test-room-1').click();
    await expect(page.getByTestId('geom-length')).not.toHaveValue('99', { timeout: 5000 });
  });
});
