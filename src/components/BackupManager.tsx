import React, { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle, X, Database, Trash2 } from 'lucide-react';
import type { ProjectData } from '../App';
import { StorageManager } from '../utils/storage';

interface BackupManagerProps {
  projects: ProjectData[];
  activeProjectId: string;
  onImport: (projects: ProjectData[], activeProjectId: string) => void;
  onClearAll: () => void;
  onImportTemplates?: (templates: any[]) => void;
}

type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: { projects: ProjectData[]; activeProjectId: string; workTemplates?: any[] };
};

export function BackupManager({ projects, activeProjectId, onImport, onClearAll, onImportTemplates }: BackupManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = useCallback(() => {
    const json = StorageManager.exportToJSON(projects, activeProjectId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `repair-calc-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [projects, activeProjectId]);

  const handleExportCSV = useCallback(() => {
    const csv = StorageManager.exportToCSV(projects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `repair-calc-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [projects]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = StorageManager.importFromJSON(content);

      if (result.success) {
        const hasTemplates = result.data.workTemplates && result.data.workTemplates.length > 0;
        setImportStatus({
          type: 'confirm',
          message: `Импортировать ${result.data.projects.length} проектов${hasTemplates ? ` и ${result.data.workTemplates.length} шаблонов` : ''}? Текущие данные будут заменены.`,
          data: { 
            projects: result.data.projects, 
            activeProjectId: result.data.activeProjectId,
            workTemplates: result.data.workTemplates
          }
        });
      } else {
        const errorMessage = 'error' in result ? result.error : 'Неизвестная ошибка импорта';
        setImportStatus({
          type: 'error',
          message: errorMessage
        });
      }
    };
    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Ошибка чтения файла'
      });
    };
    reader.readAsText(file);

    // Сбрасываем input
    event.target.value = '';
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (importStatus?.data) {
      onImport(importStatus.data.projects, importStatus.data.activeProjectId);
      // Import templates if present
      if (onImportTemplates && importStatus.data.workTemplates) {
        StorageManager.importWorkTemplates(importStatus.data.workTemplates);
        onImportTemplates(importStatus.data.workTemplates);
      }
      setImportStatus({
        type: 'success',
        message: `Успешно импортировано ${importStatus.data.projects.length} проектов${importStatus.data.workTemplates ? ` и ${importStatus.data.workTemplates.length} шаблонов` : ''}`
      });
      setTimeout(() => {
        setImportStatus(null);
        setIsOpen(false);
      }, 2000);
    }
  }, [importStatus, onImport, onImportTemplates]);

  const handleClearAll = useCallback(() => {
    onClearAll();
    setShowClearConfirm(false);
    setIsOpen(false);
  }, [onClearAll]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        title="Управление данными"
      >
        <Database className="w-4 h-4" />
        <span className="hidden sm:inline">Данные</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Управление данными</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Экспорт */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Экспорт данных</h3>
            <div className="space-y-2">
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <FileJson className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Сохранить бэкап (JSON)</div>
                  <div className="text-xs text-indigo-600/70">Полная копия всех проектов</div>
                </div>
                <Download className="w-4 h-4 ml-auto" />
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Экспорт в Excel (CSV)</div>
                  <div className="text-xs text-gray-500">Для работы в таблицах</div>
                </div>
                <Download className="w-4 h-4 ml-auto" />
              </button>
            </div>
          </div>

          {/* Импорт */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Импорт данных</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
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

          {/* Статус импорта */}
          {importStatus && (
            <div className={`p-4 rounded-xl ${
              importStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              importStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-yellow-50 text-yellow-800 border border-yellow-200'
            }`}>
              <div className="flex items-start gap-3">
                {importStatus.type === 'success' && <CheckCircle className="w-5 h-5 mt-0.5" />}
                {importStatus.type === 'error' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
                {importStatus.type === 'confirm' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm">{importStatus.message}</p>
                  {importStatus.type === 'confirm' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleConfirmImport}
                        className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors cursor-pointer"
                      >
                        Импортировать
                      </button>
                      <button
                        onClick={() => setImportStatus(null)}
                        className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Очистка данных */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Опасная зона</h3>
            
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
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
                  <strong>Внимание!</strong> Это действие удалит все проекты безвозвратно. Рекомендуется сделать бэкап перед удалением.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Да, удалить все
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
