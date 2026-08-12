import { Page, Locator } from '@playwright/test';

export class SidebarPage {
  readonly page: Page;
  readonly addRoomBtn: Locator;
  readonly addObjectBtn: Locator;
  readonly newProjectBtn: Locator;
  readonly settingsBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addRoomBtn = page.getByTestId('add-room-btn');
    this.addObjectBtn = page.getByTestId('add-object-btn');
    this.newProjectBtn = page.getByTestId('new-project-btn');
    this.settingsBtn = page.getByTestId('settings-btn');
  }

  roomItem(id: string): Locator {
    return this.page.getByTestId(`room-item-${id}`);
  }

  async selectRoom(name: string) {
    await this.page.getByRole('button', { name }).click();
  }

  async addRoom() {
    await this.addRoomBtn.click();
  }

  async addObject() {
    await this.addObjectBtn.click();
  }

  async newProject() {
    await this.newProjectBtn.click();
  }
}
