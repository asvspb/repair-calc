import React, { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle, X, Database, Trash2, RefreshCw } from 'lucide-react';
import type { ProjectData } from '../types';
import type { WorkTemplate } from '../types/workTemplate';
import { StorageManager } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { ApiStorageProvider } from '../api/storage/apiStorageProvider';

interface BackupManagerProps {
  projects: ProjectData[];
  activeProjectId: string;
  onImport: (projects: ProjectData[], activeProjectId: string) => void;
  onClearAll: () => void;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
}

type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: { projects: ProjectData[]; activeProjectId: string; workTemplates?: WorkTemplate[] };
};

export function BackupManager({ projects, activeProjectId, onImport, onClearAll, onImportTemplates }: BackupManagerProps) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to database
  const handleSaveToDb = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsSavingToDb(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      await apiProvider.saveProjectsAsync(projects);
      setImportStatus({
        type: 'success',
        message: `${projects.length} проектов(а) успешно сохранены в базу данных`,
      });
    } catch (error) {
      console.error('Error saving to database:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения в базу данных. Проверьте подключение к серверу.',
      });
    } finally {
      setIsSavingToDb(false);
    }
  }, [isAuthenticated, projects]);

  // Load from database
  const handleLoadFromDb = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsLoadingFromDb(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      const serverProjects = await apiProvider.loadProjectsAsync();
      
      if (serverProjects.length > 0) {
        onImport(serverProjects, serverProjects[0].id);
        setImportStatus({
          type: 'success',
          message: `Загружено ${serverProjects.length} проектов(а) из базы данных`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: 'На сервере нет сохранённых проектов',
        });
      }
    } catch (error) {
      console.error('Error loading from database:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки из базы данных. Проверьте подключение к серверу.',
      });
    } finally {
      setIsLoadingFromDb(false);
    }
  }, [isAuthenticated, onImport]);

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
        setImportStatus({
          type: 'confirm',
          message: `Найдено ${result.data.projects.length} проектов. Заменить текущие данные?`,
          data: result.data,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: result.error,
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleConfirmImport = useCallback(() => {
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
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4">
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
              {/* Синхронизация с базой данных - только для авторизованных */}
              {isAuthenticated && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Синхронизация с сервером</h3>
                  <div className="space-y-2">
                    <button
                      onClick={handleSaveToDb}
                      disabled={isSavingToDb}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingToDb ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">
                          {isSavingToDb ? 'Сохранение...' : 'Сохранить в базу'}
                        </div>
                        <div className="text-xs text-blue-600/70">Отправить данные на сервер</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={handleLoadFromDb}
                      disabled={isLoadingFromDb}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingFromDb ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">
                          {isLoadingFromDb ? 'Загрузка...' : 'Загрузить из базы'}
                        </div>
                        <div className="text-xs text-green-600/70">Восстановить данные с сервера</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

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
        </>
      )}
    </div>
  );
}