/**
 * Re-export-фасад (R1): реализация переехала в shared/utils/logger.
 * Легаси-импортёры (src/store, src/api, src/components и др.) работают по
 * старому пути — расшивка импортов на '@shared/utils/logger' — в R4
 * (devAI/spec/ROADMAP-fsd.md).
 * @deprecated Расшивать на '@shared/utils/logger' в R4.
 */
export * from '@shared/utils/logger';
export { default } from '@shared/utils/logger';
