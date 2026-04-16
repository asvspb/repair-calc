import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';

test.describe('Geometry Modes', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

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

    // Verify wall area = perimeter * height - openings
    // perimeter = 2*(5+4)=18, gross wall = 18*3=54
    const wallArea = await roomEditor.getWallArea();
    expect(wallArea).toContain('54.00');
  });

  test('extended mode: add sections and recalculate', async ({ page }) => {
    // Switch to extended mode
    await page.getByTestId('geom-mode-extended').click();

    // Add section
    const addSectionBtn = page.getByTestId('add-section-btn');
    await expect(addSectionBtn).toBeVisible();
    await addSectionBtn.click();

    // Wait for SubSectionItem to render
    const sectionBlock = page.locator('[data-testid^="subsection-item-"]').last();
    await expect(sectionBlock).toBeVisible({ timeout: 5000 });

    // NumberInput renders an <input type="number"> — find them within the section
    const numberInputs = sectionBlock.locator('input[type="number"]');
    // For rectangle shape, there are 2 inputs: length and width
    await expect(numberInputs.first()).toBeVisible({ timeout: 5000 });

    // Fill length (first input) and width (second input)
    await numberInputs.first().fill('3');
    await numberInputs.nth(1).fill('2');

    // Click outside to trigger save
    await page.getByTestId('room-header-title').click();

    // Verify area recalculated — metric-floor-area should show m²
    await expect(page.getByTestId('metric-floor-area')).toBeVisible();
    const floorArea = await page.getByTestId('metric-floor-area').textContent();
    expect(floorArea).toContain('м²');
  });

  test('add openings (windows/doors) and verify wall area subtraction', async ({ page }) => {
    // Get initial wall area — the textContent includes the label "Площадь стен" and "м²"
    // We need to extract just the number from the metric element
    const getWallAreaValue = async () => {
      const el = page.getByTestId('metric-wall-area');
      const text = await el.textContent();
      // Extract number from text like "Площадь стен54.00 м²" or "54.00 м²"
      const match = text?.match(/(\d+\.?\d*)\s*м²/);
      return match ? parseFloat(match[1]) : NaN;
    };

    const initialValue = await getWallAreaValue();
    expect(initialValue).toBeGreaterThan(0);

    // Add window — OpeningList has data-testid="add-window-btn"
    const addWindowBtn = page.getByTestId('add-window-btn');
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();

    // Wait for window inputs to render in OpeningList
    const openingBlock = page.locator('[data-testid^="opening-item-"]').last();
    const numberInputs = openingBlock.locator('input[type="number"]');
    await expect(numberInputs.first()).toBeVisible({ timeout: 3000 });
    await numberInputs.first().fill('1.5');  // width
    await numberInputs.last().fill('1.5');   // height

    // Blur to save
    await page.getByTestId('room-header-title').click();

    // Verify wall area decreased
    await expect(async () => {
      const v = await getWallAreaValue();
      expect(v).toBeLessThan(initialValue);
    }).toPass({ timeout: 3000 });

    // Add door
    const addDoorBtn = page.getByTestId('add-door-btn');
    await expect(addDoorBtn).toBeVisible();
    await addDoorBtn.click();

    // Fill door dimensions
    const doorBlock = page.locator('[data-testid^="opening-item-"]').last();
    const doorInputs = doorBlock.locator('input[type="number"]');
    await doorInputs.first().fill('0.9');  // width
    await doorInputs.last().fill('2.1');   // height

    // Blur to save
    await page.getByTestId('room-header-title').click();
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
