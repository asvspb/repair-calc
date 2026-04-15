import { test, expect } from './fixtures';
import { TEST_PROJECT } from './fixtures/testData';

// TODO: Требуют исправления работы с комнатами
test.describe.skip('Room Input Bug Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('repair-calc-projects', JSON.stringify(data.projects));
      localStorage.setItem('repair-calc-active-project', data.activeId);
    }, { projects: [TEST_PROJECT], activeId: TEST_PROJECT.id });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should NOT copy room parameters when switching between rooms', async ({ page }) => {
    // Шаг 1: Создаем новую комнату
    await page.getByTestId('add-room-btn').click();

    // Кликаем на новую комнату в боковом меню
    const newRoomBtn = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await expect(newRoomBtn).toBeVisible();
    await newRoomBtn.click();

    // Шаг 2: Вводим уникальные параметры для "Новой комнаты"
    const lengthInput = page.getByTestId('geom-length');
    const widthInput = page.getByTestId('geom-width');
    const heightInput = page.getByTestId('geom-height');

    // Очищаем и вводим новые значения
    await lengthInput.fill('7');
    await widthInput.fill('5');
    await heightInput.fill('3');

    // Кликаем вне поля, чтобы вызвать blur
    await page.getByTestId('room-header-title').click();

    // Проверяем, что значения сохранились
    await expect(lengthInput).toHaveValue('7');
    await expect(widthInput).toHaveValue('5');
    await expect(heightInput).toHaveValue('3');

    // Шаг 3: Переключаемся на "Комната 1"
    await page.getByTestId('room-item-test-room-1').click();

    // Проверяем параметры первой комнаты (должны отличаться)
    const room1LengthInput = page.getByTestId('geom-length');
    const room1WidthInput = page.getByTestId('geom-width');
    const room1HeightInput = page.getByTestId('geom-height');

    // Дефолтные значения первой комнаты: 4 x 3 x 2.7
    await expect(room1LengthInput).toHaveValue('4');
    await expect(room1WidthInput).toHaveValue('3');
    await expect(room1HeightInput).toHaveValue('2.7');

    // Шаг 4: Возвращаемся к "Новой комнате"
    const newRoomBtn2 = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await newRoomBtn2.click();

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
    await page.getByTestId('add-room-btn').click();
    const newRoomBtn = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await newRoomBtn.click();

    // Вводим параметры в новую комнату
    const lengthInput = page.getByTestId('geom-length');
    await lengthInput.fill('10');
    await page.getByTestId('room-header-title').click();

    // Переключаемся на Комната 1
    await page.getByTestId('room-item-test-room-1').click();

    // Изменяем параметры Комнаты 1
    const room1Length = page.getByTestId('geom-length');
    await room1Length.fill('8');
    await page.getByTestId('room-header-title').click();

    // Возвращаемся к новой комнате
    const newRoomBtn2 = page.locator('[data-testid^="room-item-"]').filter({ hasText: 'Новая комната' });
    await newRoomBtn2.click();

    // Проверяем, что значение 10 сохранилось (не заменилось на 8)
    await expect(lengthInput).toHaveValue('10');

    // Возвращаемся к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    // Проверяем, что значение 8 сохранилось
    await expect(room1Length).toHaveValue('8');
  });

  test('should not interfere with typing when external value changes', async ({ page }) => {
    // Переходим к Комнате 1
    await page.getByTestId('room-item-test-room-1').click();

    const lengthInput = page.getByTestId('geom-length');

    // Фокусируемся на поле (начинаем ввод)
    await lengthInput.click();
    await lengthInput.fill('5');

    // НЕ делаем blur - пользователь всё еще вводит данные
    // В этот момент внешнее значение уже изменилось на 5

    // Теперь вводим другое значение
    await lengthInput.fill('6');

    // Делаем blur
    await page.getByTestId('room-header-title').click();

    // Проверяем финальное значение
    await expect(lengthInput).toHaveValue('6');
  });
});
