import { test, expect } from '@playwright/test';

test.describe('Room Input Bug Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should NOT copy room parameters when switching between rooms', async ({ page }) => {
    // Шаг 1: Создаем новую комнату
    await page.click('button:has-text("Добавить комнату")');
    
    // Ждем появления новой комнаты в боковом меню
    await expect(page.locator('button:has-text("Новая комната")')).toBeVisible();
    
    // Кликаем на новую комнату
    await page.click('button:has-text("Новая комната")');
    
    // Шаг 2: Вводим уникальные параметры для "Новой комнаты"
    const lengthInput = page.locator('label:has-text("Длина (м)") + input[type="number"]');
    const widthInput = page.locator('label:has-text("Ширина (м)") + input[type="number"]');
    const heightInput = page.locator('label:has-text("Высота (м)") + input[type="number"]');
    
    // Очищаем и вводим новые значения
    await lengthInput.click();
    await lengthInput.fill('7');
    await widthInput.click();
    await widthInput.fill('5');
    await heightInput.click();
    await heightInput.fill('3');
    
    // Кликаем вне поля, чтобы вызвать blur
    await page.locator('h3:has-text("Габариты помещения")').click();
    
    // Проверяем, что значения сохранились
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');
    
    // Шаг 3: Переключаемся на "Комната 1"
    await page.click('button:has-text("Комната 1")');
    
    // Проверяем параметры первой комнаты (должны отличаться)
    const room1LengthInput = page.locator('label:has-text("Длина (м)") + input[type="number"]');
    const room1WidthInput = page.locator('label:has-text("Ширина (м)") + input[type="number"]');
    const room1HeightInput = page.locator('label:has-text("Высота (м)") + input[type="number"]');
    
    // Дефолтные значения первой комнаты: 3.6 x 2.9 x 2.6
    await expect(room1LengthInput).toHaveValue('3.6');
    await expect(room1WidthInput).toHaveValue('2.9');
    await expect(room1HeightInput).toHaveValue('2.6');
    
    // Шаг 4: Возвращаемся к "Новой комнате"
    await page.click('button:has-text("Новая комната")');
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА: параметры должны сохраниться!
    // До исправления бага значения "прыгали" на значения другой комнаты
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');
    
    // Дополнительная проверка: площадь пола должна соответствовать введенным параметрам
    // 7 * 5 = 35 м²
    const floorAreaText = page.getByText('35.00 м²');
    await expect(floorAreaText).toBeVisible();
  });

  test('should allow editing multiple rooms independently', async ({ page }) => {
    // Создаем новую комнату
    await page.click('button:has-text("Добавить комнату")');
    await page.click('button:has-text("Новая комната")');
    
    // Вводим параметры в новую комнату
    const lengthInput = page.locator('label:has-text("Длина (м)") + input[type="number"]');
    await lengthInput.click();
    await lengthInput.fill('10');
    await page.locator('h3:has-text("Габариты помещения")').click();
    
    // Переключаемся на Комната 1
    await page.click('button:has-text("Комната 1")');
    
    // Изменяем параметры Комнаты 1
    const room1Length = page.locator('label:has-text("Длина (м)") + input[type="number"]');
    await room1Length.click();
    await room1Length.fill('8');
    await page.locator('h3:has-text("Габариты помещения")').click();
    
    // Возвращаемся к новой комнате
    await page.click('button:has-text("Новая комната")');
    
    // Проверяем, что значение 10 сохранилось (не заменилось на 8)
    await expect(lengthInput).toHaveValue('10');
    
    // Возвращаемся к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Проверяем, что значение 8 сохранилось
    await expect(room1Length).toHaveValue('8');
  });

  test('should not interfere with typing when external value changes', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    const lengthInput = page.locator('label:has-text("Длина (м)") + input[type="number"]');
    
    // Фокусируемся на поле (начинаем ввод)
    await lengthInput.click();
    await lengthInput.fill('5');
    
    // НЕ делаем blur - пользователь всё еще вводит данные
    // В этот момент внешнее значение уже изменилось на 5
    
    // Теперь вводим другое значение
    await lengthInput.fill('6');
    
    // Делаем blur
    await page.locator('h3:has-text("Габариты помещения")').click();
    
    // Проверяем финальное значение
    await expect(lengthInput).toHaveValue('6');
  });
});