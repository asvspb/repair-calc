/**
 * @deprecated Домен summary переехал в src/features/summary (R4 batch 026).
 * Импортируйте из `features/summary/api/totals`. Фасад будет удалён по завершении R4.
 */
export {
  TotalsData,
  TotalsResponse,
  TotalsApiError,
  saveTotals,
  getTotals,
} from '../features/summary/api/totals';
