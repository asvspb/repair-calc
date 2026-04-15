import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';
import { RoomEditorPage } from './pages/RoomEditorPage';
import { getRoomItemByName } from './helpers/roomHelpers';

test.describe('Room Management', () => {
  test.beforeEach(async ({ page }) => {
    // Load fixture with project
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });

    await page.goto('/');
  });

  test('should add room and edit it', async ({ page }) => {
    const roomEditor = new RoomEditorPage(page);

    // Navigate to existing room first
    await page.getByTestId('room-item-test-room-1').click();

    // Edit dimensions
    await roomEditor.setDimensions(6, 5, 3);

    // Verify
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
    await page.getByTestId('room-item-test-room-1').click();

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
    await page.getByTestId('room-item-test-room-1').click();

    // Rename
    const roomTitle = page.getByTestId('room-header-title');
    await roomTitle.clear();
    await roomTitle.fill('Гостиная');
    await roomTitle.blur();

    // Verify name updated in sidebar
    await expect(getRoomItemByName(page, 'Гостиная')).toBeVisible();
  });

  test('should delete room with confirmation', async ({ page }) => {
    // Add a second room
    await page.getByTestId('add-room-btn').click();

    // Select the new room
    await getRoomItemByName(page, 'Новая комната').click();

    // Delete room
    const roomEditor = new RoomEditorPage(page);
    await roomEditor.deleteRoom();

    // Should redirect to summary or first room
    await expect(page.getByRole('button', { name: 'Общая смета' })).toBeVisible();
  });

  test('should handle deleting last room correctly', async ({ page }) => {
    // Navigate to room first
    await page.getByTestId('room-item-test-room-1').click();

    // Delete the only room
    const roomEditor = new RoomEditorPage(page);
    await roomEditor.deleteRoom();

    // Should show empty state or redirect
    const roomList = page.locator('[data-testid^="room-item-"]');
    const count = await roomList.count();
    expect(count).toBe(0);
  });
});
