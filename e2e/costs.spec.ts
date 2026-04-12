import { test, expect } from './fixtures';
import { TEST_PROJECT_WITH_WORK } from './fixtures/testData';
import { SummaryPage } from './pages/SummaryPage';

test.describe('Cost Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT_WITH_WORK], activeId: TEST_PROJECT_WITH_WORK.id });

    await page.goto('/');
  });

  test('should calculate cost from manual quantity input', async ({ page }) => {
    const summary = new SummaryPage(page);
    await summary.navigateToSummary();

    // Find the work row and enter a manual quantity
    const quantityInput = page.getByTestId('work-quantity-input');
    await quantityInput.fill('10');

    // Verify the cost updates accordingly (price = 1500, qty = 10, cost = 15000)
    const costElement = page.getByTestId('work-cost');
    await expect(costElement).toContainText('15 000');
  });

  test('should auto-calculate cost from floor area', async ({ page }) => {
    const summary = new SummaryPage(page);
    await summary.navigateToSummary();

    // The work has calculationType: 'floorArea', so quantity should equal floor area
    // Room dimensions: 3 x 2.5 = 7.5 m²
    const quantityInput = page.getByTestId('work-quantity-input');
    await expect(quantityInput).toHaveValue('7.5');

    // Verify cost is correct: 1500 × 7.5 = 11250
    const costElement = page.getByTestId('work-cost');
    await expect(costElement).toContainText('11 250');
  });

  test('should show correct total in SummaryView as sum of works, materials, and tools', async ({ page }) => {
    const summary = new SummaryPage(page);
    await summary.navigateToSummary();

    // Get the total cost from the summary
    const totalCost = await summary.getTotalCost();

    // With one work item at floor area 7.5 m² and unit price 1500:
    // Total = works (11250) + materials (0) + tools (0) = 11250
    expect(totalCost).toContain('11 250');
  });
});
