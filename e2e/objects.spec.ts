import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Object Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.goto('/');
  });

  test('should create object via CreateObjectModal', async ({ page }) => {
    // Click add object
    await page.getByTestId('add-object-btn').click();

    // Modal should appear
    const modal = page.getByTestId('create-object-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await page.getByLabel('Название объекта *').fill('Ванная комната');
    await page.getByLabel('Город').fill('Москва');

    // Submit
    await page.getByRole('button', { name: 'Создать' }).click();

    // Verify object appeared in selector
    await expect(page.getByTestId('object-selector')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Ванная комната' })).toBeVisible();
  });

  test('should switch between objects', async ({ page }) => {
    // Create first object (default exists)
    await page.getByRole('button', { name: 'Комната 1' }).click();

    // Create second object
    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Офис');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Switch to second object
    await page.getByTestId('object-selector').selectOption({ label: 'Офис' });

    // Rooms should change
    await expect(page.getByTestId('room-item-test-room-1')).not.toBeVisible();
  });

  test('should delete object with confirmation', async ({ page }) => {
    // Create second object first
    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Офис');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Delete object (would be in object settings)
    const objectSettings = page.locator('text=Объект');
    await expect(objectSettings).toBeVisible();
    
    // Find and click delete button for object
    const deleteBtn = page.getByRole('button', { name: 'Удалить объект' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    
    // Confirm deletion
    await page.getByRole('button', { name: 'Удалить' }).click();

    // Should switch to another object
    await expect(page.getByTestId('object-selector')).toBeVisible();
  });

  test('should save city for object', async ({ page }) => {
    // Create object with city
    await page.getByTestId('add-object-btn').click();
    await page.getByTestId('create-object-modal').getByLabel('Название объекта *').fill('Квартира в СПб');
    await page.getByTestId('create-object-modal').getByLabel('Город').fill('Санкт-Петербург');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Switch to another object
    await page.getByRole('button', { name: 'Комната 1' }).click();

    // Switch back
    await page.getByTestId('object-selector').selectOption({ label: 'Квартира в СПб' });

    // City should be preserved
    await expect(page.locator('text=Санкт-Петербург')).toBeVisible();
  });
});
