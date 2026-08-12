import { Page, Locator } from '@playwright/test';

export class RoomEditorPage {
  readonly page: Page;
  readonly lengthInput: Locator;
  readonly widthInput: Locator;
  readonly heightInput: Locator;
  readonly floorArea: Locator;
  readonly wallArea: Locator;
  readonly addWorkBtn: Locator;
  readonly deleteRoomBtn: Locator;
  readonly roomTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.lengthInput = page.getByTestId('geom-length');
    this.widthInput = page.getByTestId('geom-width');
    this.heightInput = page.getByTestId('geom-height');
    this.floorArea = page.getByTestId('metric-floor-area');
    this.wallArea = page.getByTestId('metric-wall-area');
    this.addWorkBtn = page.getByTestId('add-work-btn');
    this.deleteRoomBtn = page.getByTestId('delete-room-btn');
    this.roomTitle = page.getByTestId('room-header-title');
  }

  async setDimensions(length: number, width: number, height: number) {
    await this.lengthInput.fill(String(length));
    await this.widthInput.fill(String(width));
    await this.heightInput.fill(String(height));
    // Blur для сохранения
    await this.roomTitle.click();
  }

  async getFloorArea(): Promise<string> {
    return (await this.floorArea.textContent()) ?? '';
  }

  async getWallArea(): Promise<string> {
    return (await this.wallArea.textContent()) ?? '';
  }

  async addWork() {
    await this.addWorkBtn.click();
  }

  async deleteRoom() {
    await this.deleteRoomBtn.click();
    // Confirm deletion if dialog appears
    const confirmBtn = this.page.getByRole('button', { name: 'Удалить' });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
  }
}
