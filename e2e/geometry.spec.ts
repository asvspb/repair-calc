import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';

test.describe('Geometry Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });

    await page.goto('/');
  });

  test('simple mode: input L×W×H and verify areas', async ({ page }) => {
    const roomEditor = new RoomEditorPage(page);

    // Ensure simple mode is active
    await expect(page.getByTestId('geom-mode-simple')).toBeVisible();

    // Input dimensions
    await roomEditor.setDimensions(5, 4, 3);

    // Verify floor area = 5 * 4 = 20
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('20.00');

    // Verify wall area = perimeter * height = (5+4)*2 * 3 = 54
    const wallArea = await roomEditor.getWallArea();
    expect(wallArea).toContain('54.00');
  });

  test('extended mode: add sections and recalculate', async ({ page }) => {
    // Switch to extended mode
    await page.getByTestId('geom-mode-extended').click();

    // Add section
    const addSectionBtn = page.getByRole('button', { name: 'Добавить секцию' });
    await expect(addSectionBtn).toBeVisible();
    await addSectionBtn.click();

    // Fill section dimensions
    await page.getByLabel('Длина секции').first().fill('3');
    await page.getByLabel('Ширина секции').first().fill('2');

    // Verify area recalculated
    await expect(page.locator('text=м²').first()).toBeVisible();
  });

  test('add openings (windows/doors) and verify wall area subtraction', async ({ page }) => {
    // Add window
    const addWindowBtn = page.getByRole('button', { name: 'Добавить окно' });
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();

    // Fill window dimensions
    await page.getByLabel('Ширина окна').first().fill('1.5');
    await page.getByLabel('Высота окна').first().fill('1.5');

    // Verify wall area decreased
    await expect(page.getByTestId('metric-wall-area')).toBeVisible();

    // Add door
    const addDoorBtn = page.getByRole('button', { name: 'Добавить дверь' });
    await expect(addDoorBtn).toBeVisible();
    await addDoorBtn.click();

    // Fill door dimensions
    await page.getByLabel('Ширина двери').first().fill('0.9');
    await page.getByLabel('Высота двери').first().fill('2.1');
  });

  test('switch between modes without data loss', async ({ page }) => {
    const roomEditor = new RoomEditorPage(page);

    // Set data in simple mode
    await roomEditor.setDimensions(6, 5, 3);
    const initialFloorArea = await roomEditor.getFloorArea();

    // Switch to extended mode
    await page.getByTestId('geom-mode-extended').click();

    // Switch back to simple mode
    await page.getByTestId('geom-mode-simple').click();

    // Data should persist
    const floorAreaAfter = await roomEditor.getFloorArea();
    expect(floorAreaAfter).toBe(initialFloorArea);
  });
});
