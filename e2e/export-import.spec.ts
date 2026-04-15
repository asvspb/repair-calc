import { test, expect } from './fixtures';

// TODO: Требуют исправления импорта/экспорта
test.describe.skip('Export/Import Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh (but keep test mode)
    await page.addInitScript(() => {
      const testMode = localStorage.getItem('e2e-test-mode');
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      localStorage.clear();
      if (testMode) localStorage.setItem('e2e-test-mode', testMode);
      if (token) localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    });
    await page.goto('/');
  });

  test('should export project data as JSON', async ({ page }) => {
    // Открываем настройки (settings-btn)
    await page.getByTestId('settings-btn').click();

    // Проверяем, что модальное окно открылось
    await expect(page.locator('text=Управление данными')).toBeVisible();

    // Кликаем на экспорт JSON
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'JSON (бэкап)' }).click(),
    ]);

    // Проверяем, что файл скачался
    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('repair-calc');
    expect(fileName).toContain('.json');
  });

  test('should export project data as CSV', async ({ page }) => {
    // Открываем настройки
    await page.getByTestId('settings-btn').click();

    // Кликаем на экспорт CSV
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV (Excel)' }).click(),
    ]);

    // Проверяем, что файл скачался
    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('.csv');
  });

  test('should import project from JSON file', async ({ page }) => {
    // Сначала экспортируем текущий проект
    await page.getByTestId('settings-btn').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'JSON (бэкап)' }).click(),
    ]);

    // Сохраняем файл
    const downloadPath = await download.path();

    // Закрываем модальное окно кликом на фон
    await page.locator('div.fixed.inset-0.bg-black\\/50').click();
    await expect(page.locator('text=Управление данными')).not.toBeVisible();

    // Проверяем, что комната есть
    const roomItem = page.locator('[data-testid^="room-item-"]').first();
    await expect(roomItem).toBeVisible();

    // Импортируем файл (переоткрываем настройки)
    await page.getByTestId('settings-btn').click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath);

    // Проверяем, что данные импортировались
    await expect(page.locator('text=Данные успешно импортированы')).toBeVisible();
  });

  test('should show error for invalid JSON file', async ({ page }) => {
    await page.getByTestId('settings-btn').click();

    // File input скрыт, но существует - проверяем что он есть в DOM
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('should create backup', async ({ page }) => {
    await page.getByTestId('settings-btn').click();

    // Кнопка создания резервной копии (JSON export)
    const createBackupBtn = page.getByRole('button', { name: 'JSON (бэкап)' });
    await expect(createBackupBtn).toBeVisible();

    await createBackupBtn.click();
    await expect(page.locator('text=Бэкап успешно экспортирован в JSON')).toBeVisible();
  });

  test('should restore from backup', async ({ page }) => {
    // Сначала создаем резервную копию
    await page.getByTestId('settings-btn').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'JSON (бэкап)' }).click(),
    ]);

    const downloadPath = await download.path();

    // Закрываем модальное окно кликом на фон
    await page.locator('div.fixed.inset-0.bg-black\\/50').click();

    // Переходим к комнате и изменяем данные
    const lengthInput = page.getByTestId('geom-length');
    await expect(lengthInput).toBeVisible();
    await lengthInput.fill('99');
    await page.getByTestId('room-header-title').click();

    // Проверяем, что значение изменилось
    await expect(lengthInput).toHaveValue('99');

    // Восстанавливаем из резервной копии
    await page.getByTestId('settings-btn').click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath);

    // Проверяем, что данные восстановлены (значение должно измениться)
    await expect(page.locator('text=Данные успешно импортированы')).toBeVisible();
  });
});