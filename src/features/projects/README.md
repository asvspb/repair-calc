# src/features/projects

Доменная вертикаль «projects» (FSD). Переехала в R4 batch 029
(`devAI/spec/TASK-BATCH-024-029-r4.md`): ui/ (ProjectsModal, ProjectsList,
CreateProjectModal, ArchivePanel, ProjectListItem, ServerSyncSection,
DataManagementModal, ImportStatusBanner), model/ (useProjectsModal,
useProjectExports, modalTypes), api/ (projects.ts).
Фичи не импортируют друг друга — только через shared или легаси-фасады
(depcruise: fsd-features-no-cross-imports, fsd-projects-no-cross-imports — error).
