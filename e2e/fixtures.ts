import { test as base, expect } from '@playwright/test';
import type { ProjectData } from '../src/types';

/**
 * E2E-фикстуры для Playwright тестов.
 *
 * Стратегия:
 * 1. Удаляем JWT-токены → приложение не ходит на сервер
 * 2. Сидируем localStorage тестовыми данными
 * 3. Мокируем все /api/** запросы → возвращаем пустые данные
 *
 * Это гарантирует, что тесты работают изолированно от реального бэкенда.
 */

export const test = base.extend({
  page: async ({ page }, use) => {
    // Удаляем токены чтобы приложение работало через localStorage
    await page.addInitScript(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.setItem('e2e-test-mode', 'true');
    });

    await use(page);
  },
});

export { expect };

async function mockApiRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (url.pathname.startsWith('/api/auth/me') || url.pathname.startsWith('/api/sync/pull') || url.pathname.startsWith('/api/projects')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });
}

async function clearAuthTokens(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.setItem('e2e-test-mode', 'true');
  });
}

const APP_READY_SELECTOR = '[data-testid="add-room-btn"], [data-testid="new-project-btn"], [data-testid^="room-item-"]';

/**
 * Унифицированная настройка окружения для тестов с проектными данными.
 */
export async function setupTestEnvironment(
  page: import('@playwright/test').Page,
  projects: ProjectData[],
  activeProjectId?: string,
) {
  await clearAuthTokens(page);

  await page.addInitScript((data: { projects: ProjectData[]; activeId?: string }) => {
    localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
    if (data.activeId) {
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }
  }, { projects, activeId: activeProjectId });

  await mockApiRoutes(page);
  await page.goto('/');
  await page.waitForSelector(APP_READY_SELECTOR, { timeout: 15000, state: 'visible' });
}

/**
 * Настройка для тестов без проектных данных (чистый старт).
 */
export async function setupCleanEnvironment(
  page: import('@playwright/test').Page,
) {
  await clearAuthTokens(page);
  await mockApiRoutes(page);
  await page.goto('/');
  await page.locator(APP_READY_SELECTOR).first().waitFor({ state: 'visible', timeout: 15000 });
}
