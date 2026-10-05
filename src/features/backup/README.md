# src/features/backup

Доменная вертикаль «backup» (FSD). Переехала в R4 batch 029
(`devAI/spec/TASK-BATCH-024-029-r4.md`): ui/ (BackupManager, ExportPanel,
ImportPanel, SyncPanel, LoadProjectDialog), model/ (helpers.ts, types.ts).
Импортирует rooms только через легаси-фасад src/components/rooms
(depcruise: fsd-backup-no-cross-imports — error).
