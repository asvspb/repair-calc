import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle, X, Database, Trash2, RefreshCw, Save, FolderOpen, Edit2 } from 'lucide-react';
import type { ProjectData } from '../types';
import type { WorkTemplate } from '../types/workTemplate';
import { StorageManager } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { ApiStorageProvider } from '../api/storage/apiStorageProvider';
import { getProjects, getProject, createProject, updateProject } from '../api/projects';
import { getAllRooms } from '../utils/projectObjects';

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

// Тип для ожидающих импорта данных
type PendingImportData = {
  projects: ProjectData[];
  activeProjectId: string;
  workTemplates?: WorkTemplate[];
  objectCount: number;
};

// Типы для диалогов сохранения/загрузки
type ServerProject = {
  id: string;
  name: string;
  city: string | null;
  updated_at: string;
};

export function BackupManager({ projects, activeProjectId, onImport, onClearAll, onImportTemplates }: BackupManagerProps) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Состояния для диалога "Сохранить как"
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [isSavingAs, setIsSavingAs] = useState(false);

  // Состояния для диалога "Загрузить проект"
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [serverProjects, setServerProjects] = useState<ServerProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Состояния для диалога импорта с названием проекта
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProjectName, setImportProjectName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<PendingImportData | null>(null);

  // Инициализация имени для сохранения
  useEffect(() => {
    if (showSaveAsDialog && projects.length > 0) {
      const activeProject = projects.find(p => p.id === activeProjectId);
      setSaveAsName(activeProject?.name || 'Новый проект');
    }
  }, [showSaveAsDialog, projects, activeProjectId]);

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

  // Генерация дефолтного названия для импорта
  const getDefaultImportName = useCallback(() => {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `Импорт от ${day}.${month}.${year}`;
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = StorageManager.importFromJSON(content);

      if ('error' in result) {
        setImportStatus({
          type: 'error',
          message: result.error,
        });
        return;
      }

      // TypeScript should now recognize result as the success branch
      const data = result.data;
      
      // Подсчитываем общее количество объектов
      const objectCount = data.projects.reduce((sum, p) => sum + (p.objects?.length || 0), 0);
      
      // Сохраняем данные и открываем диалог
      setPendingImportData({
        projects: data.projects,
        activeProjectId: data.activeProjectId,
        workTemplates: data.workTemplates,
        objectCount,
      });
      setImportProjectName(getDefaultImportName());
      setShowImportDialog(true);
      setIsOpen(false);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [getDefaultImportName]);

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

  // Открыть диалог "Сохранить как"
  const handleOpenSaveAs = useCallback(() => {
    const activeProject = projects.find(p => p.id === activeProjectId);
    setSaveAsName(activeProject?.name || '');
    setShowSaveAsDialog(true);
    setIsOpen(false);
  }, [projects, activeProjectId]);

  // Сохранить активный проект с новым именем
  const handleSaveAs = useCallback(async () => {
    if (!saveAsName.trim()) {
      setImportStatus({ type: 'error', message: 'Введите название проекта' });
      return;
    }

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) {
      setImportStatus({ type: 'error', message: 'Нет активного проекта для сохранения' });
      return;
    }

    setIsSavingAs(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      
      // Создаём новый проект на сервере с новым именем
      const newProject = await apiProvider.createProjectAsync({
        name: saveAsName.trim(),
        city: activeProject.city,
      });

      // Сохраняем комнаты в новый проект
      const allRooms = getAllRooms(activeProject);
      for (const room of allRooms) {
        try {
          const { createRoom } = await import('../api/rooms');
          await createRoom(newProject.id, room);
        } catch (roomError) {
          console.error('Error creating room:', roomError);
        }
      }

      // Добавляем новый проект в список локально
      const updatedProjects = [...projects, { ...activeProject, id: newProject.id, name: saveAsName.trim() }];
      onImport(updatedProjects, newProject.id);

      setImportStatus({
        type: 'success',
        message: `Проект "${saveAsName.trim()}" успешно сохранён`,
      });
      setShowSaveAsDialog(false);
    } catch (error) {
      console.error('Error saving project as:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения проекта. Проверьте подключение к серверу.',
      });
    } finally {
      setIsSavingAs(false);
    }
  }, [saveAsName, projects, activeProjectId, onImport]);

  // Открыть диалог "Загрузить проект"
  const handleOpenLoadDialog = useCallback(async () => {
    setShowLoadDialog(true);
    setIsOpen(false);
    setIsLoadingProjects(true);
    setSelectedProjectId(null);

    try {
      const response = await getProjects();
      setServerProjects(response.data.map(p => ({
        id: p.id,
        name: p.name,
        city: p.city,
        updated_at: p.updated_at,
      })));
    } catch (error) {
      console.error('Error loading projects list:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки списка проектов',
      });
      setShowLoadDialog(false);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Загрузить выбранный проект
  const handleLoadSelectedProject = useCallback(async () => {
    if (!selectedProjectId) return;

    setIsLoadingProject(true);
    try {
      const response = await getProject(selectedProjectId);
      const { apiToClientProject } = await import('../api/projects');
      const loadedProject = apiToClientProject(response.data);

      // Проверяем, есть ли уже такой проект локально
      const existingIndex = projects.findIndex(p => p.id === loadedProject.id);
      let updatedProjects: ProjectData[];

      if (existingIndex >= 0) {
        // Обновляем существующий проект
        updatedProjects = projects.map(p => p.id === loadedProject.id ? loadedProject : p);
      } else {
        // Добавляем новый проект
        updatedProjects = [...projects, loadedProject];
      }

      onImport(updatedProjects, loadedProject.id);
      setImportStatus({
        type: 'success',
        message: `Проект "${loadedProject.name}" успешно загружен`,
      });
      setShowLoadDialog(false);
    } catch (error) {
      console.error('Error loading project:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки проекта',
      });
    } finally {
      setIsLoadingProject(false);
    }
  }, [selectedProjectId, projects, onImport]);

  // Подтвердить импорт с созданием нового проекта
  const handleConfirmImportWithProject = useCallback(() => {
    if (!pendingImportData || !importProjectName.trim()) return;

    // Генерируем новый ID для проекта
    const newProjectId = `import-${Date.now()}`;
    
    // Создаём новый проект с введённым названием
    // Все объекты из импортированных данных переносим в этот проект
    const allObjects = pendingImportData.projects.flatMap(p => p.objects || []);
    
    const newProject: ProjectData = {
      id: newProjectId,
      name: importProjectName.trim(),
      objects: allObjects.map(obj => ({
        ...obj,
        projectId: newProjectId,
      })),
    };

    // Добавляем новый проект к существующим
    const updatedProjects = [...projects, newProject];
    
    onImport(updatedProjects, newProjectId);
    
    if (pendingImportData.workTemplates && onImportTemplates) {
      onImportTemplates(pendingImportData.workTemplates);
    }

    setImportStatus({
      type: 'success',
      message: `Проект "${importProjectName.trim()}" успешно создан с ${allObjects.length} объектами`,
    });
    
    setShowImportDialog(false);
    setPendingImportData(null);
    setImportProjectName('');
  }, [pendingImportData, importProjectName, projects, onImport, onImportTemplates]);

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
          <div 
            data-testid="export-import-modal"
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4">
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
              {isAuthenticated && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Проекты на сервере</h3>
                  <div className="space-y-2">
                    {/* Сохранить проект как */}
                    <button
                      onClick={handleOpenSaveAs}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      <Save className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Сохранить как...</div>
                        <div className="text-xs text-purple-600/70">Сохранить проект с новым именем</div>
                      </div>
                    </button>

                    {/* Загрузить проект */}
                    <button
                      onClick={handleOpenLoadDialog}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-cyan-50 text-cyan-700 rounded-xl hover:bg-cyan-100 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Открыть проект...</div>
                        <div className="text-xs text-cyan-600/70">Загрузить проект с сервера</div>
                      </div>
                    </button>

                    {/* Разделитель */}
                    <div className="border-t border-gray-200 my-2"></div>

                    {/* Синхронизация всех проектов */}
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
                          {isSavingToDb ? 'Сохранение...' : 'Сохранить все'}
                        </div>
                        <div className="text-xs text-blue-600/70">Синхронизировать все проекты</div>
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
                          {isLoadingFromDb ? 'Загрузка...' : 'Загрузить все'}
                        </div>
                        <div className="text-xs text-green-600/70">Загрузить все проекты с сервера</div>
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
                    data-testid="export-json-btn"
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
                    data-testid="export-csv-btn"
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

      {/* Диалог "Сохранить как" */}
      {showSaveAsDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSaveAsDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
              <button
                onClick={() => setShowSaveAsDialog(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Save className="w-5 h-5 text-purple-600" />
                Сохранить проект как
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название проекта
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="Введите название проекта"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAs();
                    if (e.key === 'Escape') setShowSaveAsDialog(false);
                  }}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowSaveAsDialog(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveAs}
                  disabled={isSavingAs || !saveAsName.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingAs && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSavingAs ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Диалог "Открыть проект" */}
      {showLoadDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowLoadDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[80vh] flex flex-col">
              <button
                onClick={() => setShowLoadDialog(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-600" />
                Открыть проект с сервера
              </h2>

              <div className="flex-1 overflow-y-auto mb-4">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Загрузка списка проектов...</span>
                  </div>
                ) : serverProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>На сервере нет сохранённых проектов</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serverProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedProjectId === project.id
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{project.name}</div>
                            {project.city && (
                              <div className="text-sm text-gray-500">{project.city}</div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(project.updated_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end border-t pt-4">
                <button
                  onClick={() => setShowLoadDialog(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleLoadSelectedProject}
                  disabled={isLoadingProject || !selectedProjectId}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoadingProject && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isLoadingProject ? 'Загрузка...' : 'Открыть'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Диалог импорта с названием проекта */}
      {showImportDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowImportDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setPendingImportData(null);
                }}
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
                  onChange={(e) => setImportProjectName(e.target.value)}
                  placeholder="Введите название проекта"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmImportWithProject();
                    if (e.key === 'Escape') setShowImportDialog(false);
                  }}
                />
              </div>

              {pendingImportData && (
                <div className="mb-4 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span>Будет создан проект с <strong>{pendingImportData.objectCount}</strong> объектами</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setPendingImportData(null);
                  }}
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
      )}
    </div>
  );
}
