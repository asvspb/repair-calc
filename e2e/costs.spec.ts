import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT_WITH_WORK } from './fixtures/testData';

test.describe('Cost Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT_WITH_WORK], TEST_PROJECT_WITH_WORK.id);

    // Navigate to the room
    const roomItem = page.getByTestId('room-item-test-room-1');
    await roomItem.scrollIntoViewIfNeeded();
    await roomItem.click();
  });

  test('should auto-calculate cost from floor area', async ({ page }) => {
    // The work has calculationType: 'floorArea', room dimensions: 3 x 2.5 = 7.5 m²
    // Expand the work to see the calculated quantity and cost
    const workItem = page.locator('[data-testid="work-item-test-work-1"]');
    await workItem.locator('button:has-text("Развернуть")').click();

    // Expanded content is rendered in a sibling div. Wait for it to appear.
    const expandedArea = page.getByTestId('work-expanded-test-work-1');

    // Verify auto-quantity shows floor area (7.5 m²)
    // The auto-qty div has classes: px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg
    const autoQtyDisplay = expandedArea.locator('.bg-gray-100.border.border-gray-200.rounded-lg');
    await expect(autoQtyDisplay).toBeVisible({ timeout: 5000 });
    await expect(autoQtyDisplay).toContainText('7.50');

    // Verify cost element is visible: 1500 × 7.5 = 11250
    const costElement = page.getByTestId('work-cost').last();
    await expect(costElement).toBeVisible();
    await expect(costElement).toContainText('11 250');
  });

  test('should calculate cost from manual quantity input', async ({ page }) => {
    // Expand the work first
    const workItem = page.locator('[data-testid="work-item-test-work-1"]');
    await workItem.locator('button:has-text("Развернуть")').click();

    // Expanded content is in a sibling div
    const expandedArea = page.getByTestId('work-expanded-test-work-1');

    // Change calculation type to customCount (Вручную) via the select dropdown
    const calcTypeSelect = expandedArea.locator('select').first();
    await expect(calcTypeSelect).toBeVisible({ timeout: 5000 });
    await calcTypeSelect.selectOption('customCount');

    // Enter manual quantity
    const quantityInput = page.getByTestId('work-quantity-input');
    await expect(quantityInput).toBeVisible({ timeout: 3000 });
    await quantityInput.fill('10');

    // Click outside to save
    await page.getByTestId('room-header-title').click();

    // Verify the cost updates accordingly (price = 1500, qty = 10, cost = 15000)
    const costElement = page.getByTestId('work-cost').last();
    await expect(costElement).toContainText('15 000');
  });

  test('should show correct total in room metrics', async ({ page }) => {
    // With one work item at floor area 7.5 m² and unit price 1500:
    // Total = works (11250) + materials (0) + tools (0) = 11250
    // Check the room cost metric in the header
    const roomCost = page.getByTestId('room-cost-value');
    await expect(roomCost).toBeVisible();
    const costText = await roomCost.textContent();
    const costValue = parseInt((costText ?? '0').replace(/\s/g, ''), 10);
    expect(costValue).toBe(11250);
  });
});
