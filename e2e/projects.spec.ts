import { test, expect, setupCleanEnvironment, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Project Management', () => {
  test('should create project via ProjectsModal', async ({ page }) => {
    await setupCleanEnvironment(page);

    // Click new project button — opens ProjectsModal
    await page.getByTestId('new-project-btn').click();

    // ProjectsModal opens — click "Новый проект" button inside the modal overlay
    const projectsModal = page.locator('.fixed.inset-0.z-50');
    await expect(projectsModal).toBeVisible({ timeout: 5000 });
    const newProjectBtn = projectsModal.locator('button:has-text("Новый проект")');
    await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
    await newProjectBtn.click();

    // CreateProjectModal should appear
    const modal = page.getByTestId('create-project-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fill form — first input is project name
    const nameInput = modal.locator('input#projectName');
    await nameInput.fill('Ремонт новостройки');

    // Fill first object name
    const objectInput = modal.locator('input[placeholder="Например: Квартира"]');
    await objectInput.fill('Квартира');

    // Create project
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // Close ProjectsModal — click the backdrop overlay to close it
    // (ProjectsModal doesn't handle Escape key, but click on overlay triggers onClose)
    const backdrop = page.locator('.fixed.inset-0.z-50').first();
    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 5000 });

    // Verify project appeared — should see add-room-btn for the new project
    await expect(page.getByTestId('add-room-btn')).toBeVisible({ timeout: 10000 });
  });

  test('should copy project', async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // The project item is in the RIGHT SIDEBAR ProjectsList
    // Hover to reveal action buttons
    const projectItem = page.locator(`[data-testid="project-item-${TEST_PROJECT.id}"]`);
    await expect(projectItem).toBeVisible({ timeout: 5000 });
    await projectItem.hover();

    // Click copy button (appears on hover)
    const copyBtn = projectItem.locator('button[title="Копировать"]');
    await expect(copyBtn).toBeVisible({ timeout: 3000 });
    await copyBtn.click();

    // Confirm copy in ConfirmDialog — scoped to the dialog overlay
    const confirmDialog = page.locator('.fixed.inset-0.z-50');
    const confirmBtn = confirmDialog.locator('button:has-text("Копировать")').last();
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Verify copied project appeared — look for "(копия)" in sidebar
    await expect(page.locator('[data-testid^="project-item-"]').filter({ hasText: 'копия' })).toBeVisible({ timeout: 5000 });
  });

  test('should delete project with confirmation', async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // The project item is in the RIGHT SIDEBAR ProjectsList
    const projectItem = page.locator(`[data-testid="project-item-${TEST_PROJECT.id}"]`);
    await expect(projectItem).toBeVisible({ timeout: 5000 });
    await projectItem.hover();

    // Click delete button (appears on hover)
    const deleteBtn = projectItem.locator('button[title="Удалить"]');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Confirm deletion in the confirm dialog
    // The delete confirm dialog is rendered by RightSidebar with "Удалить" button
    const confirmDialog = page.locator('.fixed.inset-0');
    const confirmBtn = confirmDialog.locator('button:has-text("Удалить")').last();
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Verify project was deleted — should show empty state
    await expect(page.getByText('Нет проектов')).toBeVisible({ timeout: 5000 });
  });
});
