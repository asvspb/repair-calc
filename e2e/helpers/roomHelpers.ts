import { type Page, type Locator } from '@playwright/test';
import { clickSidebarByTestId, openMobileSidebarIfNeeded } from './sidebarHelpers';

/**
 * Get room item in sidebar by its display name.
 * Uses data-testid selector with text filter for resilience.
 */
export function getRoomItemByName(page: Page, name: string): Locator {
  return page.locator('[data-testid^="room-item-"]').filter({ hasText: name });
}

/**
 * Click room item in sidebar with scroll into view to avoid "outside viewport" errors.
 * On mobile viewports the sidebar is a drawer — opens it first if hidden off-screen.
 */
export async function clickRoomItemByName(page: Page, name: string): Promise<void> {
  await openMobileSidebarIfNeeded(page);
  const roomItem = getRoomItemByName(page, name);
  await roomItem.scrollIntoViewIfNeeded();
  await roomItem.click();
}

/**
 * Click room item by its id (room-item-<id>) with mobile drawer support.
 */
export async function clickRoomItemById(page: Page, roomId: string): Promise<void> {
  await clickSidebarByTestId(page, `room-item-${roomId}`);
}
