import { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle, Database, Trash2, X } from 'lucide-react';
import type { ProjectData } from '@shared/types';
import { StorageManager } from '../../../utils/storage';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';
import { SyncPanel } from './SyncPanel';
import type { BackupManagerProps, ImportStatus, PendingImportData } from '../model/types';

export type { BackupManagerProps };

/**
 * Тонкий контейнер (TASK-BATCH-013-split-ui):
 * панели экспорта/импорта/синхронизации вынесены в src/features/backup/ui/.
 */
export function BackupManager({
  projects,
  activeProjectId,
  onImport,
  onClearAll,
  onImportTemplates,
}: BackupManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const handleConfirmImportWithProject = useCallback(
    (data: PendingImportData, name: string) => {
      // Генерируем новый ID для проекта
      const newProjectId = `import-${Date.now()}`;

      // Создаём новый проект с введённым названием.
      // Все объекты из импортированных данных переносим в этот проект
      const allObjects = data.projects.flatMap(p => p.objects || []);

      const newProject: ProjectData = {
        id: newProjectId,
        name,
        objects: allObjects.map(obj => ({
          ...obj,
          projectId: newProjectId,
        })),
      };

      // Добавляем новый проект к существующим
      const updatedProjects = [...projects, newProject];

      onImport(updatedProjects, newProjectId);

      if (data.workTemplates && onImportTemplates) {
        onImportTemplates(data.workTemplates);
      }

      setImportStatus({
        type: 'success',
        message: `Проект "${name}" успешно создан с ${allObjects.length} объектами`,
      });
    },
    [projects, onImport, onImportTemplates],
  );

  // Подтверждение confirm-статуса (ветка совместимости: данные приходят
  // только из легаси-потоков, панели больше этот статус не выставляют)
  const handleConfirmStatus = useCallback(() => {
    if (importStatus?.data) {
      onImport(importStatus.data.projects, importStatus.data.activeProjectId);
      if (importStatus.data.workTemplates && onImportTemplates) {
        onImportTemplates(importStatus.data.workTemplates);
      }
      setImportStatus({
        type: 'success',
        message: 'Данные успешно импортированы',
      });
    }
  }, [importStatus, onImport, onImportTemplates]);

  const handleClearAll = useCallback(() => {
    StorageManager.clearAll();
    onClearAll();
    setShowClearConfirm(false);
    setImportStatus({
      type: 'success',
      message: 'Все данные очищены',
    });
  }, [onClearAll]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        title="Резервное копирование"
      >
        <Database className="w-5 h-5" />
        <span className="hidden sm:inline">Данные</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            data-testid="export-import-modal"
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Управление данными</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Работа с проектами на сервере - только для авторизованных */}
              <SyncPanel
                projects={projects}
                activeProjectId={activeProjectId}
                onImport={onImport}
                setImportStatus={setImportStatus}
                onOpenDialog={closeMenu}
              />

              {/* Экспорт */}
              <ExportPanel projects={projects} activeProjectId={activeProjectId} />

              {/* Импорт */}
              <ImportPanel
                setImportStatus={setImportStatus}
                onOpenDialog={closeMenu}
                onConfirmImport={handleConfirmImportWithProject}
              />

              {/* Статус импорта */}
              {importStatus && (
                <ImportStatusBanner
                  importStatus={importStatus}
                  onConfirm={handleConfirmStatus}
                  onDismiss={() => setImportStatus(null)}
                />
              )}

              {/* Очистка данных */}
              <DangerZone
                showClearConfirm={showClearConfirm}
                onToggle={setShowClearConfirm}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ImportStatusBannerProps {
  importStatus: ImportStatus;
  onConfirm: () => void;
  onDismiss: () => void;
}

function ImportStatusBanner({ importStatus, onConfirm, onDismiss }: ImportStatusBannerProps) {
  return (
    <div
      className={`p-4 rounded-xl ${
        importStatus.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : importStatus.type === 'error'
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {importStatus.type === 'success' && <CheckCircle className="w-5 h-5 mt-0.5" />}
        {importStatus.type === 'error' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
        {importStatus.type === 'confirm' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
        <div className="flex-1">
          <p className="text-sm">{importStatus.message}</p>
          {importStatus.type === 'confirm' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors cursor-pointer"
              >
                Импортировать
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DangerZoneProps {
  showClearConfirm: boolean;
  onToggle: (value: boolean) => void;
  onClearAll: () => void;
}

function DangerZone({ showClearConfirm, onToggle, onClearAll }: DangerZoneProps) {
  return (
    <div className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Опасная зона</h3>

      {!showClearConfirm ? (
        <button
          onClick={() => onToggle(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
        >
          <Trash2 className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">Очистить все данные</div>
            <div className="text-xs text-red-600/70">Удалить все проекты безвозвратно</div>
          </div>
        </button>
      ) : (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800 mb-3">
            <strong>Внимание!</strong> Это действие удалит все проекты безвозвратно. Рекомендуется
            сделать бэкап перед удалением.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
            >
              Да, удалить все
            </button>
            <button
              onClick={() => onToggle(false)}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
