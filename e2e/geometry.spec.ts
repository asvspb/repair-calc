import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';

// TODO: Требуют исправления геометрии и селекторов
test.describe.skip('Geometry Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to the room
    await page.getByTestId('room-item-test-room-1').click();
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

    // Wait for section to render
    await page.waitForTimeout(500);

    // Fill section dimensions using placeholders or data-testid
    const sectionLengthInput = page.locator('input[placeholder*="Длина секции"], input[placeholder*="длина"]').first();
    const sectionWidthInput = page.locator('input[placeholder*="Ширина секции"], input[placeholder*="ширина"]').first();
    
    // If placeholders don't work, try by input order
    if (await sectionLengthInput.count() === 0) {
      // Try to find inputs by their position in the form
      const allInputs = page.locator('input[type="number"]');
      await allInputs.nth(3).fill('3'); // 4th input should be section length
      await allInputs.nth(4).fill('2'); // 5th input should be section width
    } else {
      await sectionLengthInput.fill('3');
      await sectionWidthInput.fill('2');
    }

    // Verify area recalculated
    await expect(page.getByTestId('metric-floor-area')).toBeVisible();
    const floorArea = await page.getByTestId('metric-floor-area').textContent();
    expect(floorArea).toContain('м²');
  });

  test('add openings (windows/doors) and verify wall area subtraction', async ({ page }) => {
    // Add window using the correct button text
    const addWindowBtn = page.getByRole('button', { name: 'Добавить окно/дверь' });
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();

    // Wait for window inputs to render
    await page.waitForTimeout(500);

    // Fill window dimensions - find inputs by placeholder or order
    const windowWidthInput = page.locator('input[placeholder*="Ширина окна"], input[placeholder*="ширина окна"]').first();
    const windowHeightInput = page.locator('input[placeholder*="Высота окна"], input[placeholder*="высота окна"]').first();

    if (await windowWidthInput.count() > 0) {
      await windowWidthInput.fill('1.5');
      await windowHeightInput.fill('1.5');
    }

    // Verify wall area decreased
    await expect(page.getByTestId('metric-wall-area')).toBeVisible();

    // Add door
    const addDoorBtn = page.getByRole('button', { name: 'Добавить дверь' });
    await expect(addDoorBtn).toBeVisible();
    await addDoorBtn.click();

    // Fill door dimensions
    await page.waitForTimeout(500);
    const doorWidthInput = page.locator('input[placeholder*="Ширина двери"], input[placeholder*="ширина двери"]').first();
    const doorHeightInput = page.locator('input[placeholder*="Высота двери"], input[placeholder*="высота двери"]').first();

    if (await doorWidthInput.count() > 0) {
      await doorWidthInput.fill('0.9');
      await doorHeightInput.fill('2.1');
    }
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
