import { test, expect, setupTestEnvironment, setupCleanEnvironment } from './fixtures';
import { clickRoomItemById } from './helpers/roomHelpers';

export { test, expect, setupTestEnvironment, setupCleanEnvironment };

/**
 * Helper to wait for room to be visible and click it.
 * Uses data-testid selector with scroll-into-view for reliability.
 */
export async function navigateToRoom(page: import('@playwright/test').Page, roomId: string) {
  await clickRoomItemById(page, roomId);
}

/**
 * Helper to expand a work item by clicking the expand button.
 */
export async function expandWork(page: import('@playwright/test').Page, workId: string) {
  const workItem = page.getByTestId(`work-item-${workId}`);
  await workItem.scrollIntoViewIfNeeded();
  await workItem.locator('button:has-text("Развернуть")').click();
}

/**
 * Helper to add a custom work and return the new work's name input.
 */
export async function addCustomWork(page: import('@playwright/test').Page) {
  await page.getByTestId('add-work-custom-btn').click();
  const nameInput = page.getByTestId('work-name-input').last();
  await expect(nameInput).toBeVisible();
  return nameInput;
}
