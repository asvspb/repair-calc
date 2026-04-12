import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
    });

    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });
  });

  test('mobile: LeftSidebar hidden, Menu opens it', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // LeftSidebar should be hidden on mobile
    const sidebar = page.locator('aside').first();
    const initialClass = await sidebar.getAttribute('class');
    expect(initialClass).toContain('-translate-x-full');

    // Find and click menu button (hamburger icon)
    const menuBtn = page.getByRole('button', { name: 'Меню' }).or(page.locator('button >> svg').first());
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Sidebar should open
    await expect(sidebar).toBeVisible();
    const afterClass = await sidebar.getAttribute('class');
    expect(afterClass).toContain('translate-x-0');
  });

  test('mobile: RightSidebar hidden, Settings opens it', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // RightSidebar should be hidden on mobile
    const rightSidebar = page.locator('aside').last();
    const initialClass = await rightSidebar.getAttribute('class');
    expect(initialClass).toContain('translate-x-full');

    // Find and click settings button
    const settingsBtn = page.getByTestId('settings-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // RightSidebar should open
    await expect(rightSidebar).toBeVisible();
  });
});
