/**
 * Re-export-фасад (R1): реализация переехала в shared/utils/idMapper
 * (её зависимости — storageConstants и logger — уже в shared/utils).
 * Легаси-импортёры (src/api, src/store, src/components) работают по старому
 * пути — расшивка импортов на '@shared/utils/idMapper' — в R4
 * (devAI/spec/ROADMAP-fsd.md).
 * @deprecated Расшивать на '@shared/utils/idMapper' в R4.
 */
export * from '@shared/utils/idMapper';
