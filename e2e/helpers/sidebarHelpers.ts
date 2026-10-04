import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Итоговое состояние drawer'а по классу: React ставит итоговый класс сразу,
 * а transform доезжает 200ms — по boundingBox() в переходе можно прочитать
 * промежуточную геометрию и ошибиться.
 *
 * На десктопе (>=768px) оба сайдбара статичны (md:translate-x-0).
 */
async function isDrawerOpen(page: Page, sidebar: Locator): Promise<boolean> {
  const cls = (await sidebar.getAttribute('class')) ?? '';
  const tokens = cls.split(/\s+/);
  if (tokens.includes('translate-x-0')) {
    return true;
  }
  if (tokens.includes('md:translate-x-0')) {
    return (page.viewportSize()?.width ?? 1280) >= 768;
  }
  return false;
}

/** Гарантировать, что правый сайдбар открыт (на мобиле — drawer). */
export async function ensureRightSidebarOpen(page: Page): Promise<Locator> {
  const rightSidebar = page.locator('aside').last();
  await ensureDrawerOpen(page, rightSidebar, page.getByTestId('mobile-settings-btn'));
  return rightSidebar;
}

async function ensureDrawerOpen(page: Page, sidebar: Locator, openTrigger: Locator): Promise<void> {
  if (await isDrawerOpen(page, sidebar)) {
    return;
  }
  await openTrigger.click();
  await expect.poll(() => isDrawerOpen(page, sidebar)).toBeTruthy();
}

/** Открыть мобильный drawer левого сайдбара, если он спрятан за экраном. */
export async function openMobileSidebarIfNeeded(page: Page): Promise<void> {
  const menuBtn = page.getByTestId('mobile-menu-btn');
  if (!(await menuBtn.isVisible())) {
    return; // десктоп: сайдбар постоянно виден
  }
  await ensureDrawerOpen(page, page.locator('aside').first(), menuBtn);
}

/**
 * Клик по элементу левого сайдбара по data-testid с учётом мобильного drawer'а.
 * Клик по комнате/объекту закрывает меню автоматически (App.onTabChange).
 */
export async function clickSidebarByTestId(page: Page, testId: string): Promise<void> {
  await openMobileSidebarIfNeeded(page);
  const el = page.getByTestId(testId);
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

/**
 * Клик по кнопке правого сайдбара по имени (на десктопе виден всегда,
 * на мобиле открываем через mobile-settings-btn). Drawer остаётся открытым.
 */
export async function clickInRightSidebar(page: Page, name: string): Promise<void> {
  const rightSidebar = await ensureRightSidebarOpen(page);
  const btn = rightSidebar.getByRole('button', { name });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

/**
 * Клик по элементу правого сайдбара по data-testid (на десктопе виден всегда,
 * на мобиле открываем drawer через mobile-settings-btn).
 */
export async function clickRightSidebarByTestId(page: Page, testId: string): Promise<void> {
  const rightSidebar = await ensureRightSidebarOpen(page);
  const el = rightSidebar.getByTestId(testId);
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

/**
 * Закрыть правый drawer, если он открыт (на мобиле перекрывает контент).
 */
export async function closeRightSidebarIfOpen(page: Page): Promise<void> {
  const rightSidebar = page.locator('aside').last();
  if (!(await isDrawerOpen(page, rightSidebar))) {
    return;
  }
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const closeBtn = rightSidebar.locator('button[class~="md:hidden"]').first();
    await closeBtn.click();
    await expect.poll(() => isDrawerOpen(page, rightSidebar)).toBeFalsy();
  }
}

/**
 * Открыть модалку управления данными (Настройки).
 * У настольной кнопки настроек нет data-testid — только роль/имя «Настройки».
 */
export async function openDataManagement(page: Page): Promise<void> {
  await clickInRightSidebar(page, 'Настройки');
}
