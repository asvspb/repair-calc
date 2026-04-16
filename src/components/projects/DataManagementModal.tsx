import React, { useState, useCallback, useEffect } from 'react';
import {
  X, Download, Upload, FileJson, FileSpreadsheet,
  Server, RefreshCw, Save, User, LogOut, Database
} from 'lucide-react';
import type { WorkTemplate } from '../../types/workTemplate';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { StorageManager } from '../../utils/storage';
import { ApiStorageProvider } from '../../api/storage/apiStorageProvider';
import { migrateProjectToObjects } from '../../utils/projectObjects';
import { logError } from '../../utils/logger';

type DataManagementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
};

type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: {
    projects: ProjectData[];
    activeProjectId: string;
    workTemplates?: WorkTemplate[];
  };
};

type TabType = 'data' | 'user';

/**
 * Utility function to download a file from a blob
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * User tab content component
 */
function UserTabContent({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Пользователь не авторизован</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User info */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
          <User className="w-7 h-7 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-gray-900 truncate">
            {user.name || 'Пользователь'}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {user.email}
          </div>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Выйти из аккаунта</span>
      </button>
    </div>
  );
}

/**
 * Data management tab content component
 */
function DataTabContent() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    updateProjects,
  } = useProjectContext();

  const { isAuthenticated } = useAuth();

  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState(false);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const json = StorageManager.exportToJSON(projects, activeProjectId);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(blob, `repair-calc-backup-${new Date().toISOString().split('T')[0]}.json`);

    setImportStatus({
      type: 'success',
      message: 'Бэкап успешно экспортирован в JSON',
    });
  }, [projects, activeProjectId]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csv = StorageManager.exportToCSV(projects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `repair-calc-export-${new Date().toISOString().split('T')[0]}.csv`);

    setImportStatus({
      type: 'success',
      message: 'Данные успешно экспортированы в CSV',
    });
  }, [projects]);

  // Import JSON
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

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(() => {
    if (importStatus?.data) {
      const migratedProjects = importStatus.data.projects.map((p) => migrateProjectToObjects(p));
      updateProjects(migratedProjects);
      setActiveProjectId(importStatus.data.activeProjectId);

      setImportStatus({
        type: 'success',
        message: 'Данные успешно импортированы',
      });
    }
  }, [importStatus, updateProjects, setActiveProjectId]);

  // Save all to server
  const handleSaveAllToServer = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsSavingToServer(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      await apiProvider.saveProjectsAsync(projects);

      setImportStatus({
        type: 'success',
        message: `Все проекты (${projects.length}) успешно сохранены на сервере`,
      });
    } catch (error) {
      logError('DataManagement', 'Error saving to server', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения на сервер. Проверьте подключение.',
      });
    } finally {
      setIsSavingToServer(false);
    }
  }, [isAuthenticated, projects]);

  // Load all from server
  const handleLoadAllFromServer = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingFromServer(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      const serverProjects = await apiProvider.loadProjectsAsync();

      if (serverProjects.length > 0) {
        const migratedProjects = serverProjects.map((p) => migrateProjectToObjects(p));
        updateProjects(migratedProjects);

        setImportStatus({
          type: 'success',
          message: `Загружено ${serverProjects.length} проектов(а) с сервера`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: 'На сервере нет сохранённых проектов',
        });
      }
    } catch (error) {
      logError('DataManagement', 'Error loading from server', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки с сервера. Проверьте подключение.',
      });
    } finally {
      setIsLoadingFromServer(false);
    }
  }, [isAuthenticated, updateProjects]);

  return (
    <>
      {/* Export section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Экспорт
        </h3>
        <div className="space-y-2">
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-indigo-600" />
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">JSON (бэкап)</div>
              <div className="text-xs text-gray-500">Полный бэкап всех проектов</div>
            </div>
          </button>
          <button
            onClick={handleExportCSV}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">CSV (Excel)</div>
              <div className="text-xs text-gray-500">Экспорт для работы в таблицах</div>
            </div>
          </button>
        </div>
      </div>

      {/* Import section */}
      <div className="mb-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Импорт
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <FileJson className="w-4 h-4 text-indigo-600" />
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">Выбрать JSON файл</div>
            <div className="text-xs text-gray-500">Восстановить из бэкапа</div>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Server sync section */}
      {isAuthenticated && (
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Server className="w-4 h-4" />
            Синхронизация с сервером
          </h3>
          <div className="space-y-2">
            <button
              onClick={handleSaveAllToServer}
              disabled={isSavingToServer}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingToServer ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSavingToServer ? 'Сохранение...' : 'Сохранить все на сервер'}
            </button>
            <button
              onClick={handleLoadAllFromServer}
              disabled={isLoadingFromServer}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingFromServer ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              {isLoadingFromServer ? 'Загрузка...' : 'Загрузить все с сервера'}
            </button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {importStatus && (
        <div className={`mt-4 p-4 rounded-lg ${
          importStatus.type === 'success'
            ? 'bg-green-50 text-green-800'
            : importStatus.type === 'error'
            ? 'bg-red-50 text-red-800'
            : 'bg-blue-50 text-blue-800'
        }`}>
          <p className="text-sm">{importStatus.message}</p>
          {importStatus.type === 'confirm' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
              >
                Заменить
              </button>
              <button
                onClick={() => setImportStatus(null)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function DataManagementModal({
  isOpen,
  onClose,
  onImportTemplates: _onImportTemplates,
}: DataManagementModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('data');

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('data');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col h-[750px] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Настройки</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'data'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Database className="w-4 h-4" />
            Управление данными
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'user'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <User className="w-4 h-4" />
            Пользователь
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'data' ? (
            <DataTabContent />
          ) : (
            <UserTabContent onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}