/**
 * Каталог типовых работ для ремонта — фасад
 * Реализация распилена на модули ./catalog/ (P3-SPLIT волна B1, batch 036)
 */

export {
  WORK_TEMPLATES_CATALOG,
  getWorksByCategory,
  getCategoriesWithWorks,
  getWorkById,
  searchWorks,
  getPopularWorks,
} from './catalog/selectors';
export { TOOLS } from './catalog/tools';
export type { WorkTemplateCatalog, MaterialTemplate, ToolTemplate } from './catalog/selectors';
