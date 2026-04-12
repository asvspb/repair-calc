import { test, expect } from './fixtures';

// Helper to initialize app with localStorage data
async function initAppWithData(page, data: { projects?: any[], activeId?: string }) {
  await page.addInitScript((d) => {
    if (d.projects) {
      localStorage.setItem('repair-calc-projects', JSON.stringify(d.projects));
    }
    if (d.activeId) {
      localStorage.setItem('repair-calc-active-project', d.activeId);
    }
  }, data);
}

export { initAppWithData };
