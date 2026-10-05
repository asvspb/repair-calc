import { useCallback, useEffect, useState } from 'react';
import { Database, FolderOpen, RefreshCw, Save, X } from 'lucide-react';
import { LoadProjectDialog } from './LoadProjectDialog';
import type { ProjectData } from '@shared/types';
import { useAuth } from '../../../contexts/AuthContext';
import { ApiStorageProvider } from '../../../api/storage/apiStorageProvider';
import { getProjects, getProject } from '../../../api/projects';
import { getAllRooms } from '../../../utils/projectObjects';
import { logError } from '../../../utils/logger';
import type { SetImportStatus, ServerProject } from '../model/types';

interface SyncPanelProps {
  projects: ProjectData[];
  activeProjectId: string;
  onImport: (projects: ProjectData[], activeProjectId: string) => void;
  setImportStatus: SetImportStatus;
  /** Закрыть выпадающее меню при открытии диалога */
  onOpenDialog: () => void;
}

export function SyncPanel({
  projects,
  activeProjectId,
  onImport,
  setImportStatus,
  onOpenDialog,
}: SyncPanelProps) {
  const { isAuthenticated } = useAuth();
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);

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
      logError('BackupManager', 'Error saving to database', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения в базу данных. Проверьте подключение к серверу.',
      });
    } finally {
      setIsSavingToDb(false);
    }
  }, [isAuthenticated, projects, setImportStatus]);

  // Load from database
  const handleLoadFromDb = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingFromDb(true);
    try {
      const apiProvider = ApiStorageProvider.getInstance();
      const loadedProjects = await apiProvider.loadProjectsAsync();

      if (loadedProjects.length > 0) {
        onImport(loadedProjects, loadedProjects[0].id);
        setImportStatus({
          type: 'success',
          message: `Загружено ${loadedProjects.length} проектов(а) из базы данных`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: 'На сервере нет сохранённых проектов',
        });
      }
    } catch (error) {
      logError('BackupManager', 'Error loading from database', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки из базы данных. Проверьте подключение к серверу.',
      });
    } finally {
      setIsLoadingFromDb(false);
    }
  }, [isAuthenticated, onImport, setImportStatus]);

  // Открыть диалог "Сохранить как"
  const handleOpenSaveAs = useCallback(() => {
    const activeProject = projects.find(p => p.id === activeProjectId);
    setSaveAsName(activeProject?.name || '');
    setShowSaveAsDialog(true);
    onOpenDialog();
  }, [projects, activeProjectId, onOpenDialog]);

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
          const { createRoom } = await import('../../../api/rooms');
          await createRoom(newProject.id, room);
        } catch (roomError) {
          logError('BackupManager', 'Error creating room', roomError);
        }
      }

      // Добавляем новый проект в список локально
      const updatedProjects = [
        ...projects,
        { ...activeProject, id: newProject.id, name: saveAsName.trim() },
      ];
      onImport(updatedProjects, newProject.id);

      setImportStatus({
        type: 'success',
        message: `Проект "${saveAsName.trim()}" успешно сохранён`,
      });
      setShowSaveAsDialog(false);
    } catch (error) {
      logError('BackupManager', 'Error saving project as', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения проекта. Проверьте подключение к серверу.',
      });
    } finally {
      setIsSavingAs(false);
    }
  }, [saveAsName, projects, activeProjectId, onImport, setImportStatus]);

  // Открыть диалог "Загрузить проект"
  const handleOpenLoadDialog = useCallback(async () => {
    setShowLoadDialog(true);
    onOpenDialog();
    setIsLoadingProjects(true);
    setSelectedProjectId(null);

    try {
      const response = await getProjects();
      setServerProjects(
        response.data.map(p => ({
          id: p.id,
          name: p.name,
          city: p.city,
          updated_at: p.updated_at,
        })),
      );
    } catch (error) {
      logError('BackupManager', 'Error loading projects list', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки списка проектов',
      });
      setShowLoadDialog(false);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [onOpenDialog, setImportStatus]);

  // Загрузить выбранный проект
  const handleLoadSelectedProject = useCallback(async () => {
    if (!selectedProjectId) return;

    setIsLoadingProject(true);
    try {
      const response = await getProject(selectedProjectId);
      const { apiToClientProject } = await import('../../../api/projects');
      const loadedProject = apiToClientProject(response.data);

      // Проверяем, есть ли уже такой проект локально
      const existingIndex = projects.findIndex(p => p.id === loadedProject.id);
      let updatedProjects: ProjectData[];

      if (existingIndex >= 0) {
        // Обновляем существующий проект
        updatedProjects = projects.map(p => (p.id === loadedProject.id ? loadedProject : p));
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
      logError('BackupManager', 'Error loading project', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки проекта',
      });
    } finally {
      setIsLoadingProject(false);
    }
  }, [selectedProjectId, projects, onImport, setImportStatus]);

  if (!isAuthenticated) return null;

  return (
    <>
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
              <div className="font-medium">{isSavingToDb ? 'Сохранение...' : 'Сохранить все'}</div>
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
              <div className="font-medium">{isLoadingFromDb ? 'Загрузка...' : 'Загрузить все'}</div>
              <div className="text-xs text-green-600/70">Загрузить все проекты с сервера</div>
            </div>
          </button>
        </div>
      </div>

      {/* Диалог "Сохранить как" */}
      {showSaveAsDialog && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowSaveAsDialog(false)}
          />
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
                  onChange={e => setSaveAsName(e.target.value)}
                  placeholder="Введите название проекта"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={e => {
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
        <LoadProjectDialog
          serverProjects={serverProjects}
          isLoadingProjects={isLoadingProjects}
          isLoadingProject={isLoadingProject}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onClose={() => setShowLoadDialog(false)}
          onLoad={handleLoadSelectedProject}
        />
      )}
    </>
  );
}
