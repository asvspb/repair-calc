import { type Page, type Locator } from '@playwright/test';

/**
 * Get room item in sidebar by its display name.
 * Uses data-testid selector with text filter for resilience.
 */
export function getRoomItemByName(page: Page, name: string): Locator {
  return page.locator('[data-testid^="room-item-"]').filter({ hasText: name });
}

/**
 * Click room item in sidebar with scroll into view to avoid "outside viewport" errors.
 */
export async function clickRoomItemByName(page: Page, name: string): Promise<void> {
  const roomItem = getRoomItemByName(page, name);
  await roomItem.scrollIntoViewIfNeeded();
  await roomItem.click();
}
