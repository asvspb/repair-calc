import { test, expect } from './fixtures';

test.describe('Authorization', () => {
  test.beforeEach(async ({ page }) => {
    // Auth tests MUST NOT have e2e-test-mode set — otherwise the app
    // skips the login page. We only clear tokens and navigate.
    await page.addInitScript(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('e2e-test-mode');
    });
  });

  test('should display login form by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Проверяем, что форма логина отображается
    const loginForm = page.getByTestId('login-form');
    await expect(loginForm).toBeVisible({ timeout: 10000 });

    // Проверяем наличие полей
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for login form
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 10000 });

    // Mock API to return error for invalid login
    await page.route('**/api/auth/login', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Неверный email или пароль',
        }),
      });
    });

    // Вводим неверные данные
    await page.getByTestId('login-email').fill('invalid@example.com');
    await page.getByTestId('login-password').fill('wrongpassword');

    // Отправляем форму
    await page.getByRole('button', { name: 'Войти' }).click();

    // Проверяем, что появилась ошибка
    const errorMessage = page.locator('text=Неверный email или пароль').or(
      page.locator('text=Ошибка').first()
    );
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for login form
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 10000 });

    // Mock API responses — must not intercept Vite modules
    await page.route('**/api/auth/login', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-jwt-token',
            refreshToken: 'test-refresh-token',
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
          },
        }),
      });
    });

    // Mock getCurrentUser
    await page.route('**/api/auth/me', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
          },
        }),
      });
    });

    // Mock projects API
    await page.route('**/api/projects**', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    // Вводим данные
    await page.getByTestId('login-email').fill('test@example.com');
    await page.getByTestId('login-password').fill('password123');

    // Отправляем форму
    await page.getByRole('button', { name: 'Войти' }).click();

    // Проверяем, что приложение загрузилось
    const mainContent = page.locator('text=Нет проектов').or(
      page.locator('text=Создать проект')
    ).or(
      page.getByTestId('new-project-btn')
    );
    await expect(mainContent.first()).toBeVisible({ timeout: 15000 });
  });
});
