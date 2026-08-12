import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Object Management', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: Clear auth tokens so the app uses localStorage only
    // The fixtures inject a valid (but server-expired) JWT token.
    // When the app validates it against the real backend, it loads REAL user data
    // which overwrites our test data.
    await page.addInitScript(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.setItem('e2e-test-mode', 'true');
    });

    // Seed localStorage with test project data
    await page.addInitScript((projectData) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify([projectData]));
      localStorage.setItem('repair-calc-active-project', projectData.id);
    }, TEST_PROJECT);

    await page.goto('/');

    // Wait for the app to load — check for the room button
    await expect(page.getByTestId('room-item-test-room-1')).toBeVisible({ timeout: 10000 });
  });

  test('should create object via CreateObjectModal', async ({ page }) => {
    // Click add object button
    await page.getByRole('button', { name: 'Добавить объект ремонта' }).click();

    // Modal should appear
    const modal = page.getByTestId('create-object-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await modal.getByLabel('Название объекта *').fill('Ванная комната');
    await modal.getByLabel('Город').fill('Москва');

    // Submit
    await page.getByRole('button', { name: 'Создать' }).click();

    // After creating second object, selector should appear
    await expect(page.getByTestId('object-selector')).toBeVisible();
    // Check the option exists in the select (options inside <select> aren't "visible")
    const selector = page.getByTestId('object-selector');
    await expect(selector.locator('option', { hasText: 'Ванная комната' })).toHaveCount(1);
  });

  test('should switch between objects', async ({ page }) => {
    // First create a second object
    await page.getByRole('button', { name: 'Добавить объект ремонта' }).click();
    const modal = page.getByTestId('create-object-modal');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Название объекта *').fill('Офис');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Wait for object selector to appear
    await expect(page.getByTestId('object-selector')).toBeVisible();

    // Switch to second object
    await page.getByTestId('object-selector').selectOption({ label: 'Офис' });

    // Original room should not be visible anymore
    await expect(page.getByTestId('room-item-test-room-1')).not.toBeVisible();
  });

  test('should delete object with confirmation', async ({ page }) => {
    // First create a second object
    await page.getByRole('button', { name: 'Добавить объект ремонта' }).click();
    const modal = page.getByTestId('create-object-modal');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Название объекта *').fill('Офис');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Wait for object selector
    await expect(page.getByTestId('object-selector')).toBeVisible();

    // Handle the window.confirm dialog
    page.once('dialog', dialog => dialog.accept());

    // Click delete object button
    const deleteBtn = page.getByTestId('delete-object-btn');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Selector should disappear (back to 1 object)
    await expect(page.getByTestId('object-selector')).not.toBeVisible();
  });

  test('should save city for object', async ({ page }) => {
    // Create second object with city
    await page.getByRole('button', { name: 'Добавить объект ремонта' }).click();
    const modal = page.getByTestId('create-object-modal');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Название объекта *').fill('Квартира в СПб');
    await modal.getByLabel('Город').fill('Санкт-Петербург');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Wait for object selector
    await expect(page.getByTestId('object-selector')).toBeVisible();

    // Switch to second object
    await page.getByTestId('object-selector').selectOption({ label: 'Квартира в СПб' });

    // City should be preserved
    const cityInput = page.getByTestId('city-select');
    await expect(cityInput).toHaveValue('Санкт-Петербург');
  });
});
