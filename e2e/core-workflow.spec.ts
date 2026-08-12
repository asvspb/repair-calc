import { test, expect, setupTestEnvironment, setupCleanEnvironment } from './fixtures';
import { TEST_PROJECT_MULTI_OBJECT, TEST_PROJECT_WITH_WORK } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';

test.describe('Core Workflow - End-to-End Tests', () => {
  test('Scenario 1: Full cycle - create project, add room, add work, view summary', async ({ page }) => {
    await setupCleanEnvironment(page);

    // Click new project button — opens ProjectsModal
    await page.getByTestId('new-project-btn').click();

    // Click "Новый проект" inside ProjectsModal overlay
    const projectsModal = page.locator('.fixed.inset-0.z-50');
    await expect(projectsModal).toBeVisible({ timeout: 5000 });
    const newProjectBtn = projectsModal.locator('button:has-text("Новый проект")');
    await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
    await newProjectBtn.click();

    // CreateProjectModal should appear
    const modal = page.getByTestId('create-project-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fill project name
    const nameInput = modal.locator('input#projectName');
    await nameInput.fill('Тестовый проект');

    // Fill first object name
    const objectInput = modal.locator('input[placeholder="Например: Квартира"]');
    await objectInput.fill('Квартира');

    // Create project
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // Close ProjectsModal — click the backdrop overlay to close it
    // (ProjectsModal onClose is triggered by clicking the backdrop)
    const backdrop = page.locator('.fixed.inset-0.z-50').first();
    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 5000 });

    // Wait for project to be created — should see add-room-btn
    await expect(page.getByTestId('add-room-btn')).toBeVisible({ timeout: 10000 });

    // Add a room
    await page.getByTestId('add-room-btn').click();

    // Navigate to the new room
    const roomItem = page.locator('[data-testid^="room-item-"]').first();
    await expect(roomItem).toBeVisible({ timeout: 5000 });
    await roomItem.click();

    // Input dimensions
    const roomEditor = new RoomEditorPage(page);
    await expect(page.getByTestId('geom-length')).toBeVisible({ timeout: 5000 });
    await roomEditor.setDimensions(5, 4, 2.7);

    // Verify floor area = 5 * 4 = 20
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('20.00');

    // Add a custom work
    await page.getByTestId('add-work-custom-btn').click();

    // Fill work name
    const workNameInput = page.getByTestId('work-name-input').last();
    await expect(workNameInput).toBeVisible({ timeout: 5000 });
    await workNameInput.fill('Поклейка обоев');

    // Expand work and fill price
    const lastWorkItem = page.locator('[data-testid^="work-item-"]').last();
    const expandBtn = lastWorkItem.locator('button:has-text("Развернуть")');
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();

    const workPriceInput = page.getByTestId('work-price-input').last();
    await expect(workPriceInput).toBeVisible({ timeout: 5000 });
    await workPriceInput.fill('500');

    // Navigate to Summary via right sidebar button
    const summaryBtn = page.locator('button:has-text("Общая смета")');
    await expect(summaryBtn).toBeVisible({ timeout: 5000 });
    await summaryBtn.click();

    // Verify summary is shown
    const totalCost = page.getByTestId('summary-total-cost');
    await expect(totalCost).toBeVisible({ timeout: 5000 });
    const costText = await totalCost.textContent();
    const costValue = parseInt((costText ?? '0').replace(/\s/g, ''), 10);
    expect(costValue).toBeGreaterThan(0);
  });

  test('Scenario 2: Multiple objects in project', async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT_MULTI_OBJECT], TEST_PROJECT_MULTI_OBJECT.id);

    // Verify object selector is visible
    const objectSelector = page.getByTestId('object-selector');
    await expect(objectSelector).toBeVisible({ timeout: 5000 });

    // Verify room from first object
    await expect(page.getByTestId('room-item-test-room-1')).toBeVisible();

    // Switch to second object
    await objectSelector.selectOption({ label: 'Офис' });

    // Verify room from second object
    await expect(page.getByTestId('room-item-test-room-2')).toBeVisible();

    // Check object selector has 2 options
    const options = objectSelector.locator('option');
    await expect(options).toHaveCount(2);
  });

  test('Scenario 3: Edit and recalculate', async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT_WITH_WORK], TEST_PROJECT_WITH_WORK.id);

    const roomEditor = new RoomEditorPage(page);

    // Navigate to room
    await page.getByTestId('room-item-test-room-1').click();

    // Expand work and verify price
    const workItem = page.locator('[data-testid="work-item-test-work-1"]');
    await workItem.locator('button:has-text("Развернуть")').click();

    // Get initial cost
    const costElement = page.getByTestId('work-cost').last();
    await expect(costElement).toBeVisible({ timeout: 5000 });
    const initialCostText = await costElement.textContent();

    // Change dimensions
    await roomEditor.setDimensions(5, 4, 3);

    // Verify floor area updated
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('20.00'); // 5 * 4 = 20

    // Verify cost recalculated based on new floor area
    const newCostText = await costElement.textContent();
    expect(newCostText).toBeTruthy();
    // Cost should differ from initial since floor area changed (3*2.5=7.5 → 5*4=20)
    expect(newCostText).not.toEqual(initialCostText);
  });
});
