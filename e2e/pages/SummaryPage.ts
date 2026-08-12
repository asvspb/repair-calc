import { Page, Locator } from '@playwright/test';

export class SummaryPage {
  readonly page: Page;
  readonly totalCost: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalCost = page.getByTestId('summary-total-cost');
  }

  async getTotalCost(): Promise<string> {
    return (await this.totalCost.textContent()) ?? '';
  }

  async navigateToSummary() {
    // Click on "Общая смета" in the right sidebar
    await this.page.getByRole('button', { name: 'Общая смета' }).click();
  }
}
