import React, { useCallback, useRef, useState } from 'react';
import { Database, Upload, X } from 'lucide-react';
import { StorageManager, countImportedObjects } from '../../../utils/storage';
import { getDefaultImportName } from '../model/helpers';
import type { ImportStatus, PendingImportData, SetImportStatus } from '../model/types';

interface ImportPanelProps {
  setImportStatus: SetImportStatus;
  /** Закрыть выпадающее меню при открытии диалога импорта */
  onOpenDialog: () => void;
  /** Подтверждение импорта с созданием нового проекта */
  onConfirmImport: (data: PendingImportData, name: string) => void;
}

export function ImportPanel({ setImportStatus, onOpenDialog, onConfirmImport }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProjectName, setImportProjectName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<PendingImportData | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => {
        const content = e.target?.result as string;
        const result = StorageManager.importFromJSON(content);

        if ('error' in result) {
          const status: ImportStatus = { type: 'error', message: result.error };
          setImportStatus(status);
          return;
        }

        // TypeScript should now recognize result as the success branch
        const data = result.data;

        // Подсчитываем общее количество объектов
        const objectCount = countImportedObjects(data.projects);

        // Сохраняем данные и открываем диалог
        setPendingImportData({
          projects: data.projects,
          activeProjectId: data.activeProjectId,
          workTemplates: data.workTemplates,
          objectCount,
        });
        setImportProjectName(getDefaultImportName());
        setShowImportDialog(true);
        onOpenDialog();
      };
      reader.readAsText(file);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [setImportStatus, onOpenDialog],
  );

  const closeImportDialog = useCallback(() => {
    setShowImportDialog(false);
    setPendingImportData(null);
  }, []);

  return (
    <>
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Импорт данных</h3>
        <input
          data-testid="import-file-input"
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          data-testid="restore-backup-btn"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Upload className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">Загрузить бэкап (JSON)</div>
            <div className="text-xs text-gray-500">Восстановить из файла</div>
          </div>
        </button>
      </div>

      {/* Диалог импорта с названием проекта */}
      {showImportDialog && (
        <ImportDialog
          importProjectName={importProjectName}
          setImportProjectName={setImportProjectName}
          pendingImportData={pendingImportData}
          onClose={closeImportDialog}
          onConfirm={onConfirmImport}
        />
      )}
    </>
  );
}

interface ImportDialogProps {
  importProjectName: string;
  setImportProjectName: (name: string) => void;
  pendingImportData: PendingImportData | null;
  onClose: () => void;
  onConfirm: ((data: PendingImportData, name: string) => void) | undefined;
}

function ImportDialog(props: ImportDialogProps) {
  const { importProjectName, setImportProjectName, pendingImportData, onClose, onConfirm } = props;

  const handleConfirmImportWithProject = useCallback(() => {
    if (!pendingImportData || !importProjectName.trim()) return;
    onConfirm?.(pendingImportData, importProjectName.trim());
  }, [pendingImportData, importProjectName, onConfirm]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Импорт данных
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название нового проекта
            </label>
            <input
              type="text"
              value={importProjectName}
              onChange={e => setImportProjectName(e.target.value)}
              placeholder="Введите название проекта"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmImportWithProject();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>

          {pendingImportData && (
            <div className="mb-4 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>
                  Будет создан проект с <strong>{pendingImportData.objectCount}</strong> объектами
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirmImportWithProject}
              disabled={!importProjectName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Импортировать
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
