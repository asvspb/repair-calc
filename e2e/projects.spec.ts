import { test, expect } from './fixtures';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.goto('/');
  });

  test('should create project via ProjectsModal', async ({ page }) => {
    // Click new project
    await page.getByTestId('new-project-btn').click();

    // Modal should appear
    const modal = page.getByTestId('create-project-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await page.getByLabel('Название проекта *').fill('Ремонт новостройки');
    await page.getByPlaceholder('Например: Квартира').fill('Квартира');

    // Create
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // Verify project appeared in RightSidebar
    await expect(page.locator('[data-testid^="project-item-"]').first()).toBeVisible();
  });

  test('should copy project', async ({ page }) => {
    // Create project first
    await page.getByTestId('new-project-btn').click();
    await page.getByLabel('Название проекта *').fill('Тестовый проект');
    await page.getByPlaceholder('Например: Квартира').fill('Квартира');
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // Copy project (would be in project context menu or settings)
    const projectItem = page.locator('[data-testid^="project-item-"]').first();
    await projectItem.hover();

    const copyBtn = projectItem.locator('button[title="Копировать проект"]');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Verify copy created with independent data
    await expect(page.locator('[data-testid^="project-item-"]').nth(1)).toBeVisible();
  });

  test('should delete project with confirmation', async ({ page }) => {
    // Create project
    await page.getByTestId('new-project-btn').click();
    await page.getByLabel('Название проекта *').fill('Проект для удаления');
    await page.getByPlaceholder('Например: Квартира').fill('Квартира');
    await page.getByRole('button', { name: 'Создать проект' }).click();

    // Delete project
    const projectItem = page.locator('[data-testid^="project-item-"]').first();
    await projectItem.hover();

    const deleteBtn = projectItem.locator('button[title="Удалить проект"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm deletion
    await page.getByRole('button', { name: 'Удалить' }).click();

    // Should switch to another project or show empty state
    await expect(page.locator('[data-testid^="project-item-"]')).not.toBeVisible();
  });
});
