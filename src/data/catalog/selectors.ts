// ============================================
// КАТАЛОГ РАБОТ (сборка из частей по категориям)
// ============================================

import type { WorkCategory, WorkTemplateCatalog } from '../../types/workTemplate';
import { WORKS_FLOOR } from './works-floor';
import { WORKS_WALLS } from './works-walls';
import { WORKS_CEILING } from './works-ceiling';
import { WORKS_OPENINGS } from './works-openings';
import { WORKS_OTHER } from './works-other';

// Порядок конкатенации = исходный порядок массива (стабилен для поиска/популярных)
export const WORK_TEMPLATES_CATALOG: WorkTemplateCatalog[] = [
  ...WORKS_FLOOR,
  ...WORKS_WALLS,
  ...WORKS_CEILING,
  ...WORKS_OPENINGS,
  ...WORKS_OTHER,
];

// ============================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С КАТАЛОГОМ
// ============================================

/**
 * Получить работы по категории
 */
export function getWorksByCategory(category: WorkCategory): WorkTemplateCatalog[] {
  return WORK_TEMPLATES_CATALOG.filter(work => work.category === category);
}

/**
 * Получить все категории с работами
 */
export function getCategoriesWithWorks(): Record<WorkCategory, WorkTemplateCatalog[]> {
  return {
    floor: getWorksByCategory('floor'),
    walls: getWorksByCategory('walls'),
    ceiling: getWorksByCategory('ceiling'),
    openings: getWorksByCategory('openings'),
    other: getWorksByCategory('other'),
  };
}

/**
 * Найти работу по ID
 */
export function getWorkById(id: string): WorkTemplateCatalog | undefined {
  return WORK_TEMPLATES_CATALOG.find(work => work.id === id);
}

/**
 * Поиск работ по названию
 */
export function searchWorks(query: string): WorkTemplateCatalog[] {
  const lowerQuery = query.toLowerCase();
  return WORK_TEMPLATES_CATALOG.filter(
    work =>
      work.name.toLowerCase().includes(lowerQuery) ||
      work.description?.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Получить популярные работы (топ по popularity)
 */
export function getPopularWorks(limit: number = 5): WorkTemplateCatalog[] {
  return [...WORK_TEMPLATES_CATALOG]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
}

/**
 * Экспорт типов для использования в других модулях
 */
export type { WorkTemplateCatalog, MaterialTemplate, ToolTemplate } from '../../types/workTemplate';
