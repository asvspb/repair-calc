import { type Page } from '@playwright/test';

/**
 * Get room item in sidebar by its display name.
 * Uses data-testid selector with text filter for resilience.
 */
export function getRoomItemByName(page: Page, name: string) {
  return page.locator('[data-testid^="room-item-"]').filter({ hasText: name });
}
