import { test, expect } from '@playwright/test';

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
    // Вводим неверные данные
    await page.getByTestId('login-email').fill('invalid@example.com');
    await page.getByTestId('login-password').fill('wrongpassword');
    
    // Отправляем форму
    await page.getByRole('button', { name: 'Войти' }).click();
    
    // Проверяем, что появилась ошибка
    const errorMessage = page.locator('text=Неверный email или пароль').or(
      page.locator('text=Ошибка авторизации')
    );
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    // Мокаем API ответ для авторизации
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'test-jwt-token',
          refreshToken: 'test-refresh-token',
        }),
      });
    });

    // Вводим данные
    await page.getByTestId('login-email').fill('test@example.com');
    await page.getByTestId('login-password').fill('password123');
    
    // Отправляем форму
    await page.getByRole('button', { name: 'Войти' }).click();
    
    // Проверяем, что приложение загрузилось (появился основной интерфейс)
    // Должен появиться сайдбар или другой элемент основного приложения
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
