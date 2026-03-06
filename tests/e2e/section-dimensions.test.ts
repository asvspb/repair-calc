import { test, expect } from '@playwright/test';

test.describe('Extended Mode - Section Dimensions Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на страницу приложения
    await page.goto('http://localhost:3993');
    
    // Ждем загрузки приложения
    await page.waitForSelector('text=/Общая смета|Создать объект/i', { timeout: 10000 });
  });

  test('should preserve dimensions when adding multiple sections', async ({ page }) => {
    console.log('[PLAYWRIGHT] Starting test: adding multiple sections');
    
    // Шаг 1: Создаем новую комнату
    console.log('[PLAYWRIGHT] Step 1: Creating new room');
    const addRoomButton = page.getByText('Добавить комнату');
    await addRoomButton.click();
    await page.waitForTimeout(500);

    // Шаг 2: Переключаем в расширенный режим
    console.log('[PLAYWRIGHT] Step 2: Switching to extended mode');
    const modeSelect = page.getByLabel('Режим геометрии');
    if (await modeSelect.isVisible()) {
      await modeSelect.selectText('Расширенный');
      await page.waitForTimeout(500);
    }

    // Шаг 3: Добавляем первую секцию
    console.log('[PLAYWRIGHT] Step 3: Adding first section');
    const addSectionButton = page.getByText('+ Добавить секцию');
    await addSectionButton.click();
    await page.waitForTimeout(500);

    // Вводим габариты первой секции: 5 x 4
    console.log('[PLAYWRIGHT] Step 4: Entering dimensions for first section (5 x 4)');
    const lengthInputs = await page.getByLabel(/Длина/i).all();
    const widthInputs = await page.getByLabel(/Ширина/i).all();
    
    if (lengthInputs.length > 0) {
      await lengthInputs[0].fill('5');
      await page.waitForTimeout(200);
    }
    if (widthInputs.length > 0) {
      await widthInputs[0].fill('4');
      await page.waitForTimeout(200);
    }

    // Проверяем, что первая секция сохранила значения
    console.log('[PLAYWRIGHT] Step 5: Verifying first section dimensions');
    await page.waitForTimeout(500);
    const firstLength = await lengthInputs[0].inputValue();
    const firstWidth = await widthInputs[0].inputValue();
    console.log(`[PLAYWRIGHT] First section: length=${firstLength}, width=${firstWidth}`);
    expect(firstLength).toBe('5');
    expect(firstWidth).toBe('4');

    // Шаг 4: Добавляем вторую секцию
    console.log('[PLAYWRIGHT] Step 6: Adding second section');
    await addSectionButton.click();
    await page.waitForTimeout(500);

    // Вводим габариты второй секции: 3 x 3
    console.log('[PLAYWRIGHT] Step 7: Entering dimensions for second section (3 x 3)');
    const allLengthInputs = await page.getByLabel(/Длина/i).all();
    const allWidthInputs = await page.getByLabel(/Ширина/i).all();
    
    if (allLengthInputs.length > 1) {
      await allLengthInputs[1].fill('3');
      await page.waitForTimeout(200);
    }
    if (allWidthInputs.length > 1) {
      await allWidthInputs[1].fill('3');
      await page.waitForTimeout(200);
    }

    // Шаг 5: Проверяем, что первая секция НЕ изменилась
    console.log('[PLAYWRIGHT] Step 8: Verifying first section still has correct dimensions');
    await page.waitForTimeout(500);
    
    const updatedLengthInputs = await page.getByLabel(/Длина/i).all();
    const updatedWidthInputs = await page.getByLabel(/Ширина/i).all();
    
    const firstSectionLength = await updatedLengthInputs[0].inputValue();
    const firstSectionWidth = await updatedWidthInputs[0].inputValue();
    const secondSectionLength = await updatedLengthInputs[1].inputValue();
    const secondSectionWidth = await updatedWidthInputs[1].inputValue();
    
    console.log(`[PLAYWRIGHT] After adding second section:`);
    console.log(`  First section: length=${firstSectionLength}, width=${firstSectionWidth}`);
    console.log(`  Second section: length=${secondSectionLength}, width=${secondSectionWidth}`);
    
    // КРИТИЧНАЯ ПРОВЕРКА: первая секция должна сохранить свои значения
    expect(firstSectionLength).toBe('5');
    expect(firstSectionWidth).toBe('4');
    
    // Вторая секция должна иметь свои значения
    expect(secondSectionLength).toBe('3');
    expect(secondSectionWidth).toBe('3');
  });

  test('should preserve trapezoid dimensions independently', async ({ page }) => {
    console.log('[PLAYWRIGHT] Starting test: trapezoid dimensions');
    
    // Создаем комнату
    await page.goto('http://localhost:3993');
    await page.waitForTimeout(1000);
    
    const addRoomButton = page.getByText('Добавить комнату');
    await addRoomButton.click();
    await page.waitForTimeout(500);

    // Добавляем секцию
    const addSectionButton = page.getByText('+ Добавить секцию');
    await addSectionButton.click();
    await page.waitForTimeout(500);

    // Меняем форму на трапецию
    console.log('[PLAYWRIGHT] Changing shape to trapezoid');
    const trapezoidButton = page.getByText('Трапеция');
    await trapezoidButton.click();
    await page.waitForTimeout(500);

    // Вводим размеры трапеции
    console.log('[PLAYWRIGHT] Entering trapezoid dimensions');
    const base1Input = page.getByLabel(/Основание 1/i).first();
    const base2Input = page.getByLabel(/Основание 2/i).first();
    const depthInput = page.getByLabel(/Глубина/i).first();
    
    await base1Input.fill('6');
    await page.waitForTimeout(200);
    await base2Input.fill('4');
    await page.waitForTimeout(200);
    await depthInput.fill('5');
    await page.waitForTimeout(200);

    // Проверяем
    await page.waitForTimeout(500);
    const savedBase1 = await base1Input.inputValue();
    const savedBase2 = await base2Input.inputValue();
    const savedDepth = await depthInput.inputValue();
    
    console.log(`[PLAYWRIGHT] Trapezoid dimensions: base1=${savedBase1}, base2=${savedBase2}, depth=${savedDepth}`);
    
    expect(savedBase1).toBe('6');
    expect(savedBase2).toBe('4');
    expect(savedDepth).toBe('5');
  });
});
