import { test, expect, setupTestEnvironment } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';
import { getRoomItemByName, clickRoomItemByName } from './helpers/roomHelpers';

test.describe('Room Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page, [TEST_PROJECT], TEST_PROJECT.id);

    // Navigate to room — scroll into view to avoid viewport issues
    await clickRoomItemByName(page, 'Комната 1');
  });

  test('should add room and edit it', async ({ page }) => {
    const roomEditor = new RoomEditorPage(page);

    // Edit dimensions
    await roomEditor.setDimensions(6, 5, 3);

    // Verify floor area = 30
    const floorArea = await roomEditor.getFloorArea();
    expect(floorArea).toContain('30.00');
  });

  test('should switch between rooms without data loss', async ({ page }) => {
    const roomEditor = new RoomEditorPage(page);

    // Add room
    await page.getByTestId('add-room-btn').click();

    // Select the new room via the sidebar (it appears as "Новая комната")
    await getRoomItemByName(page, 'Новая комната').click();

    // Edit new room
    await roomEditor.setDimensions(7, 5, 3);

    // Switch to room 1
    await clickRoomItemByName(page, 'Комната 1');

    // Verify room 1 data is different
    const room1Length = page.getByTestId('geom-length');
    await expect(room1Length).toHaveValue('4');

    // Switch back to new room
    await getRoomItemByName(page, 'Новая комната').click();

    // Verify new room data persisted
    const newRoomLength = page.getByTestId('geom-length');
    await expect(newRoomLength).toHaveValue('7');
  });

  test('should rename room', async ({ page }) => {
    // Navigate to room
    await clickRoomItemByName(page, 'Комната 1');

    // Rename via the room header title input
    const roomTitle = page.getByTestId('room-header-title');
    await roomTitle.clear();
    await roomTitle.fill('Гостиная');

    // Blur to save the rename
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Verify name updated in sidebar — the room item should now show "Гостиная"
    // RoomListItem now compares room.name in memo, so it should re-render
    await expect(getRoomItemByName(page, 'Гостиная')).toBeVisible({ timeout: 5000 });
  });

  test('should delete room with confirmation', async ({ page }) => {
    // Add a second room
    await page.getByTestId('add-room-btn').click();

    // Select the new room
    await getRoomItemByName(page, 'Новая комната').click();

    // Delete room
    const roomEditor = new RoomEditorPage(page);
    await roomEditor.deleteRoom();
  });

  test('should handle deleting last room correctly', async ({ page }) => {
    // Navigate to room first
    await clickRoomItemByName(page, 'Комната 1');

    // Delete the only room
    const roomEditor = new RoomEditorPage(page);
    await roomEditor.deleteRoom();

    // Should show empty state — no room items in sidebar
    const roomList = page.locator('[data-testid^="room-item-"]');
    const count = await roomList.count();
    expect(count).toBe(0);
  });
});
