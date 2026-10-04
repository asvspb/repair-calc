/**
 * Re-export-фасад (R1): реализация переехала в shared/utils/storageConstants.
 * Легаси-импортёры (src/api, src/store и др.) работают по старому пути —
 * расшивка импортов на '@shared/utils/storageConstants' — в R4
 * (devAI/spec/ROADMAP-fsd.md).
 * @deprecated Расшивать на '@shared/utils/storageConstants' в R4.
 */
export * from '@shared/utils/storageConstants';
