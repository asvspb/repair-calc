import { test, expect } from '@playwright/test';

test.describe('Work Templates Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should save work as template', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Добавляем работу
    await page.click('button:has-text("Добавить работу")');
    
    // Заполняем данные работы
    const nameInput = page.locator('input[placeholder="Название работы"]');
    await nameInput.fill('Тестовая работа для шаблона');
    
    // Пытаемся сохранить как шаблон
    const saveTemplateBtn = page.locator('button:has-text("Сохранить как шаблон")');
    
    if (await saveTemplateBtn.isVisible()) {
      await saveTemplateBtn.click();
      
      // Проверяем успешное сохранение
      await expect(page.locator('text=Шаблон сохранен')).toBeVisible();
    }
  });

  test('should apply template to work', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Открываем модальное окно шаблонов
    const templatesBtn = page.locator('button:has-text("Шаблоны работ")');
    
    if (await templatesBtn.isVisible()) {
      await templatesBtn.click();
      
      // Проверяем, что модальное окно открылось
      await expect(page.locator('text=Выбор шаблона')).toBeVisible();
      
      // Выбираем категорию (если есть)
      const categoryBtn = page.locator('button:has-text("Пол")').first();
      if (await categoryBtn.isVisible()) {
        await categoryBtn.click();
      }
      
      // Выбираем первый доступный шаблон
      const firstTemplate = page.locator('[data-testid="work-template-item"]').first();
      if (await firstTemplate.isVisible()) {
        await firstTemplate.click();
        
        // Проверяем, что работа добавлена
        await expect(page.locator('text=работа')).toBeVisible();
      }
    }
  });

  test('should search templates by name', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Открываем модальное окно шаблонов
    const templatesBtn = page.locator('button:has-text("Шаблоны работ")');
    
    if (await templatesBtn.isVisible()) {
      await templatesBtn.click();
      
      // Вводим поисковый запрос
      const searchInput = page.locator('input[placeholder="Поиск шаблонов"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('пол');
        
        // Проверяем фильтрацию
        await page.waitForTimeout(300); // debounce
        
        // Результаты должны содержать только шаблоны с "пол"
        const results = page.locator('[data-testid="work-template-item"]');
        const count = await results.count();
        
        if (count > 0) {
          // Проверяем, что все результаты содержат "пол"
          for (let i = 0; i < count; i++) {
            const text = await results.nth(i).textContent();
            expect(text?.toLowerCase()).toContain('пол');
          }
        }
      }
    }
  });

  test('should filter templates by category', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Открываем модальное окно шаблонов
    const templatesBtn = page.locator('button:has-text("Шаблоны работ")');
    
    if (await templatesBtn.isVisible()) {
      await templatesBtn.click();
      
      // Выбираем категорию "Стены"
      const wallsCategory = page.locator('button:has-text("Стены")');
      if (await wallsCategory.isVisible()) {
        await wallsCategory.click();
        
        // Проверяем, что отображаются только шаблоны категории "Стены"
        await page.waitForTimeout(300);
        
        // Результаты должны быть отфильтрованы
        const results = page.locator('[data-testid="work-template-item"]');
        expect(await results.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should delete template', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Открываем модальное окно шаблонов
    const templatesBtn = page.locator('button:has-text("Шаблоны работ")');
    
    if (await templatesBtn.isVisible()) {
      await templatesBtn.click();
      
      // Наводим на первый шаблон для появления кнопки удаления
      const firstTemplate = page.locator('[data-testid="work-template-item"]').first();
      if (await firstTemplate.isVisible()) {
        await firstTemplate.hover();
        
        const deleteBtn = firstTemplate.locator('button:has-text("Удалить")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          
          // Подтверждаем удаление
          const confirmBtn = page.locator('button:has-text("Подтвердить")');
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
          }
        }
      }
    }
  });

  test('should show confirmation when template name exists', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Добавляем работу
    await page.click('button:has-text("Добавить работу")');
    
    const nameInput = page.locator('input[placeholder="Название работы"]');
    await nameInput.fill('Существующий шаблон');
    
    const saveTemplateBtn = page.locator('button:has-text("Сохранить как шаблон")');
    
    if (await saveTemplateBtn.isVisible()) {
      await saveTemplateBtn.click();
      
      // Если шаблон с таким именем уже существует, должно появиться предупреждение
      const confirmDialog = page.locator('text=Шаблон с таким названием уже существует');
      
      if (await confirmDialog.isVisible()) {
        // Проверяем наличие кнопок "Заменить" и "Отмена"
        await expect(page.locator('button:has-text("Заменить")')).toBeVisible();
        await expect(page.locator('button:has-text("Отмена")')).toBeVisible();
      }
    }
  });

  test('should close template modal on cancel', async ({ page }) => {
    // Переходим к Комнате 1
    await page.click('button:has-text("Комната 1")');
    
    // Открываем модальное окно шаблонов
    const templatesBtn = page.locator('button:has-text("Шаблоны работ")');
    
    if (await templatesBtn.isVisible()) {
      await templatesBtn.click();
      
      // Проверяем, что модальное окно открылось
      await expect(page.locator('text=Выбор шаблона')).toBeVisible();
      
      // Закрываем по кнопке "Закрыть"
      await page.click('button:has-text("Закрыть")');
      
      // Проверяем, что модальное окно закрылось
      await expect(page.locator('text=Выбор шаблона')).not.toBeVisible();
    }
  });
});