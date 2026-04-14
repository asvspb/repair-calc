import { test, expect } from './fixtures';

test.describe('Authorization', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure we're not logged in
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');
  });

  test('should display login form by default', async ({ page }) => {
    // Проверяем, что форма логина отображается
    const loginForm = page.getByTestId('login-form');
    await expect(loginForm).toBeVisible();

    // Проверяем наличие полей
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Mock API to return error for invalid login
    await page.route('**/api/auth/login', async (route) => {
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
    // Mock API responses
    await page.route('**/api/auth/login', async (route) => {
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

    // Проверяем, что приложение загрузилось (появился основной интерфейс)
    // Должен появиться either sidebar, создание проекта или другой элемент
    const mainContent = page.locator('text=Нет проектов').or(
      page.locator('text=Создать проект')
    ).or(
      page.getByTestId('new-project-btn')
    );
    await expect(mainContent.first()).toBeVisible({ timeout: 15000 });
  });
});
