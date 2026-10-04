import { Upload, Download, FileJson, FileSpreadsheet, Plus, FolderOpen, X } from 'lucide-react';
import type { WorkTemplate } from '../../types/workTemplate';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateProjectModal } from './CreateProjectModal';
import { ArchivePanel } from './ArchivePanel';
import { ProjectListItem } from './ProjectListItem';
import { ServerSyncSection } from './ServerSyncSection';
import { ImportStatusBanner } from './ImportStatusBanner';
import { useProjectsModal } from './useProjectsModal';
import { dlog } from '../../utils/debugLogger';

const LOG_PREFIX = '[ProjectsModal]';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
}

/**
 * Модалка «Мои проекты». Логика вынесена в useProjectsModal, карточка проекта
 * в ProjectListItem, синхронизация в ServerSyncSection, баннер статуса в
 * ImportStatusBanner (TASK-BATCH-013-split-ui). ArchivePanel не тронут.
 */
export function ProjectsModal({ isOpen, onClose, onImportTemplates }: ProjectsModalProps) {
  const ctrl = useProjectsModal({ isOpen, onImportTemplates });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Мои проекты</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                dlog(LOG_PREFIX, '"Новый проект" clicked, opening CreateProjectModal');
                ctrl.setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Новый проект</span>
            </button>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => ctrl.fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                title="Импорт JSON"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Импорт</span>
              </button>

              <div className="relative group">
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  title="Экспорт"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Экспорт</span>
                </button>

                <div className="absolute right-0 top-full pt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                  <button
                    onClick={ctrl.handleExportJSON}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>JSON (бэкап)</span>
                  </button>
                  <button
                    onClick={ctrl.handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>CSV (Excel)</span>
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={ctrl.fileInputRef}
              type="file"
              accept=".json"
              onChange={ctrl.handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Project list */}
          <div className="space-y-3">
            {ctrl.projects.map(project => (
              <ProjectListItem
                key={project.id}
                project={project}
                isActive={project.id === ctrl.activeProjectId}
                isEditing={ctrl.editingProjectId === project.id}
                editingName={ctrl.editingName}
                onEditingNameChange={ctrl.setEditingName}
                onStartEditing={p => {
                  ctrl.setEditingProjectId(p.id);
                  ctrl.setEditingName(p.name);
                }}
                onRename={ctrl.handleRenameProject}
                onCancelEditing={() => ctrl.setEditingProjectId(null)}
                onActivate={ctrl.setActiveProjectId}
                onCopy={ctrl.setCopyConfirmId}
                onDelete={ctrl.setDeleteConfirmId}
              />
            ))}

            {ctrl.projects.length === 0 && (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Нет проектов. Создайте первый проект.</p>
              </div>
            )}
          </div>

          {/* Archive section (T4): гостю рендерится null внутри компонента */}
          <ArchivePanel />

          {/* Server sync section */}
          {ctrl.isAuthenticated && (
            <ServerSyncSection
              isSavingToServer={ctrl.isSavingToServer}
              isLoadingFromServer={ctrl.isLoadingFromServer}
              onSaveAll={ctrl.handleSaveAllToServer}
              onLoadAll={ctrl.handleLoadAllFromServer}
            />
          )}

          {/* Import status */}
          {ctrl.importStatus && (
            <ImportStatusBanner
              importStatus={ctrl.importStatus}
              onConfirm={ctrl.handleConfirmImport}
              onDismiss={() => ctrl.setImportStatus(null)}
            />
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {ctrl.deleteConfirmId && (
        <ConfirmDialog
          isOpen={!!ctrl.deleteConfirmId}
          onCancel={() => ctrl.setDeleteConfirmId(null)}
          onConfirm={() => ctrl.handleDeleteProject(ctrl.deleteConfirmId!)}
          title="Удалить проект?"
          message={`Проект «${ctrl.projects.find(p => p.id === ctrl.deleteConfirmId)?.name}» будет удалён безвозвратно. Рекомендуется сделать бэкап перед удалением.`}
          confirmLabel="Удалить"
          variant="danger"
        />
      )}

      {/* Copy confirmation dialog */}
      {ctrl.copyConfirmId && (
        <ConfirmDialog
          isOpen={!!ctrl.copyConfirmId}
          onCancel={() => ctrl.setCopyConfirmId(null)}
          onConfirm={() => ctrl.handleCopyProject(ctrl.copyConfirmId!)}
          title="Копировать проект?"
          message={`Создать копию проекта «${ctrl.projects.find(p => p.id === ctrl.copyConfirmId)?.name}»?`}
          confirmLabel="Копировать"
        />
      )}

      {/* Create project modal */}
      <CreateProjectModal
        isOpen={ctrl.showCreateModal}
        onClose={() => {
          dlog(LOG_PREFIX, 'CreateProjectModal closed');
          ctrl.setShowCreateModal(false);
        }}
        onCreate={ctrl.handleCreateProject}
        onImportFromBackup={ctrl.handleImportFromBackup}
        isCreating={ctrl.isCreating}
      />
    </div>
  );
}
