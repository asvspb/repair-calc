/**
 * Re-export-фасад (R1): реализация переехала в shared/utils/format.
 * Легаси-импортёры (src/components и др.) работают по старому пути —
 * расшивка импортов на '@shared/utils/format' — в R4 (devAI/spec/ROADMAP-fsd.md).
 * @deprecated Расшивать на '@shared/utils/format' в R4.
 */
export * from '@shared/utils/format';
