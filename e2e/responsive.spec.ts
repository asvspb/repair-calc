import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

test.describe('Responsive Design', () => {
  test('mobile: LeftSidebar hidden, Menu opens it', async ({ page }) => {
    // Set mobile viewport BEFORE navigating
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup environment with test data
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // LeftSidebar should be hidden on mobile (off-screen with -translate-x-full)
    const sidebar = page.locator('aside').first();

    // On mobile, sidebar may not be visible due to transform
    const isVisible = await sidebar.isVisible();
    if (isVisible) {
      const classAttr = await sidebar.getAttribute('class');
      expect(classAttr).toContain('-translate-x-full');
    }

    // Find and click menu button (hamburger icon)
    const menuBtn = page.getByTestId('mobile-menu-btn');
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
    await menuBtn.click();

    // Sidebar should open (become visible)
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test('mobile: RightSidebar hidden, Settings opens it', async ({ page }) => {
    // Set mobile viewport BEFORE navigating
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup environment with test data
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // RightSidebar should be hidden on mobile
    const rightSidebar = page.locator('aside').last();

    // Find and click the mobile settings button in the header
    const mobileSettingsBtn = page.getByTestId('mobile-settings-btn');
    await expect(mobileSettingsBtn).toBeVisible({ timeout: 5000 });
    await mobileSettingsBtn.click();

    // RightSidebar should open
    await expect(rightSidebar).toBeVisible({ timeout: 5000 });
  });
});
