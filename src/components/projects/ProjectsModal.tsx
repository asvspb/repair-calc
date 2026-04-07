import React, { useState, useCallback, useEffect } from 'react';
import {
  X, FolderOpen, Plus, Edit2, Copy, Trash2,
  Download, Upload, FileJson, FileSpreadsheet,
  Server, RefreshCw, Save, AlertTriangle, CheckCircle
} from 'lucide-react';
import type { ProjectData } from '../../types';
import type { WorkTemplate } from '../../types/workTemplate';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { StorageManager } from '../../utils/storage';
import { ApiStorageProvider } from '../../api/storage/apiStorageProvider';
import { getAllRooms, migrateProjectToObjects } from '../../utils/projectObjects';
import { pluralize } from '../../utils/format';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
}

type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: { projects: ProjectData[]; activeProjectId: string; workTemplates?: WorkTemplate[] };
};

export function ProjectsModal({ isOpen, onClose, onImportTemplates }: ProjectsModalProps) {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    updateProjects,
    createProject,
    deleteProject,
    isSyncing,
  } = useProjectContext();

  const { isAuthenticated } = useAuth();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCity, setNewProjectCity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copyConfirmId, setCopyConfirmId] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowCreateForm(false);
      setEditingProjectId(null);
      setImportStatus(null);
      setDeleteConfirmId(null);
      setCopyConfirmId(null);
    }
  }, [isOpen]);

  // Calculate project stats
  const getProjectStats = useCallback((project: ProjectData) => {
    const objectsCount = project.objects?.length || 0;
    const allRooms = getAllRooms(project);
    const roomsCount = allRooms.length;

    // Calculate total cost
    let totalCost = 0;
    for (const room of allRooms) {
      for (const work of room.works || []) {
        totalCost += (work.cost || 0) * (work.quantity || 0);
      }
      for (const material of room.materials || []) {
        totalCost += (material.cost || 0) * (material.quantity || 0);
      }
      for (const tool of room.tools || []) {
        totalCost += (tool.cost || 0) * (tool.quantity || 0);
      }
    }

    return { objectsCount, roomsCount, totalCost };
  }, []);

  // Create new project
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const newProject = await createProject({
        name: newProjectName.trim(),
        city: newProjectCity.trim() || undefined,
      });

      setNewProjectName('');
      setNewProjectCity('');
      setShowCreateForm(false);
      setImportStatus({
        type: 'success',
        message: `Проект "${newProject.name}" успешно создан`,
      });
    } catch (error) {
      console.error('Error creating project:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка создания проекта',
      });
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, newProjectCity, createProject]);

  // Rename project
  const handleRenameProject = useCallback((projectId: string) => {
    if (!editingName.trim()) {
      setEditingProjectId(null);
      return;
    }

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, name: editingName.trim() } : p
    );
    updateProjects(updatedProjects);
    setEditingProjectId(null);
  }, [projects, editingName, updateProjects]);

  // Copy project
  const handleCopyProject = useCallback((projectId: string) => {
    const sourceProject = projects.find(p => p.id === projectId);
    if (!sourceProject) return;

    const copiedProject: ProjectData = {
      ...JSON.parse(JSON.stringify(sourceProject)),
      id: `local-${Date.now()}`,
      name: `${sourceProject.name} (копия)`,
    };

    // Re-generate IDs for objects and rooms to avoid conflicts
    if (copiedProject.objects) {
      copiedProject.objects = copiedProject.objects.map((obj: any) => ({
        ...obj,
        id: `obj-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        projectId: copiedProject.id,
        rooms: obj.rooms?.map((room: any) => ({
          ...room,
          id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          objectId: obj.id,
        })),
      }));
    }

    const updatedProjects = [...projects, copiedProject];
    updateProjects(updatedProjects);
    setActiveProjectId(copiedProject.id);

    setCopyConfirmId(null);
    setImportStatus({
      type: 'success',
      message: `Проект "${sourceProject.name}" успешно скопирован`,
    });
  }, [projects, updateProjects, setActiveProjectId]);

  // Delete project
  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      // Use context's deleteProject if authenticated (handles server deletion)
      if (isAuthenticated) {
        await deleteProject(projectId);
      } else {
        // Local deletion
        const updatedProjects = projects.filter(p => p.id !== projectId);
        updateProjects(updatedProjects);
        if (updatedProjects.length > 0 && activeProjectId === projectId) {
          setActiveProjectId(updatedProjects[0].id);
        } else if (updatedProjects.length === 0) {
          setActiveProjectId('');
        }
      }

      setDeleteConfirmId(null);
      setImportStatus({
        type: 'success',
        message: 'Проект успешно удалён',
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка удаления проекта',
      });
    }
  }, [projects, activeProjectId, isAuthenticated, deleteProject, updateProjects, setActiveProjectId]);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const json = StorageManager.exportToJSON(projects, activeProjectId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair-calc-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Delayed cleanup to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    setImportStatus({
      type: 'success',
      message: 'Бэкап успешно экспортирован в JSON',
    });
  }, [projects, activeProjectId]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csv = StorageManager.exportToCSV(projects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair-calc-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Delayed cleanup to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }

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
      const migratedProjects = importStatus.data.projects.map(p => migrateProjectToObjects(p));
      updateProjects(migratedProjects);
      setActiveProjectId(importStatus.data.activeProjectId);

      if (importStatus.data.workTemplates && onImportTemplates) {
        onImportTemplates(importStatus.data.workTemplates);
      }

      setImportStatus({
        type: 'success',
        message: 'Данные успешно импортированы',
      });
    }
  }, [importStatus, updateProjects, setActiveProjectId, onImportTemplates]);

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
      console.error('Error saving to server:', error);
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
        const migratedProjects = serverProjects.map(p => migrateProjectToObjects(p));
        updateProjects(migratedProjects);
        setActiveProjectId(migratedProjects[0].id);

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
      console.error('Error loading from server:', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки с сервера. Проверьте подключение.',
      });
    } finally {
      setIsLoadingFromServer(false);
    }
  }, [isAuthenticated, updateProjects, setActiveProjectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in">
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
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Новый проект</span>
            </button>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
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

                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-10">
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>JSON (бэкап)</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>CSV (Excel)</span>
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h3 className="text-sm font-medium text-indigo-900 mb-3">Новый проект</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Название проекта"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setShowCreateForm(false);
                  }}
                />
                <input
                  type="text"
                  value={newProjectCity}
                  onChange={(e) => setNewProjectCity(e.target.value)}
                  placeholder="Город (для поиска цен)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setShowCreateForm(false);
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isCreating ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project list */}
          <div className="space-y-3">
            {projects.map(project => {
              const stats = getProjectStats(project);
              const isActive = project.id === activeProjectId;
              const isEditing = editingProjectId === project.id;

              return (
                <div
                  key={project.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Project icon and info */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full px-3 py-1.5 text-lg font-medium border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                          autoFocus
                          onBlur={() => handleRenameProject(project.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameProject(project.id);
                            if (e.key === 'Escape') setEditingProjectId(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <FolderOpen className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {project.name}
                          </h3>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                              Активен
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {project.city && (
                          <span>{project.city}</span>
                        )}
                        <span>
                          {stats.objectsCount} {pluralize(stats.objectsCount, 'объект', 'объекта', 'объектов')}
                        </span>
                        <span>
                          {stats.roomsCount} {pluralize(stats.roomsCount, 'комната', 'комнаты', 'комнат')}
                        </span>
                        {stats.totalCost > 0 && (
                          <span className="font-medium text-gray-700">
                            {stats.totalCost.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingProjectId(project.id);
                            setEditingName(project.name);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          title="Переименовать"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                      )}

                      <button
                        onClick={() => setCopyConfirmId(project.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        title="Копировать"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(project.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => setActiveProjectId(project.id)}
                          className="ml-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Открыть
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {projects.length === 0 && (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Нет проектов. Создайте первый проект.</p>
              </div>
            )}
          </div>

          {/* Server sync section */}
          {isAuthenticated && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-700">Синхронизация с сервером</h3>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveAllToServer}
                  disabled={isSavingToServer}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                >
                  {isSavingToServer ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSavingToServer ? 'Сохранение...' : 'Сохранить все'}
                </button>

                <button
                  onClick={handleLoadAllFromServer}
                  disabled={isLoadingFromServer}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                >
                  {isLoadingFromServer ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4" />
                  )}
                  {isLoadingFromServer ? 'Загрузка...' : 'Загрузить все'}
                </button>
              </div>
            </div>
          )}

          {/* Import status */}
          {importStatus && (
            <div className={`mt-4 p-4 rounded-lg ${
              importStatus.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : importStatus.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
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
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <ConfirmDialog
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={() => handleDeleteProject(deleteConfirmId)}
          title="Удалить проект?"
          message={`Проект «${projects.find(p => p.id === deleteConfirmId)?.name}» будет удалён безвозвратно. Рекомендуется сделать бэкап перед удалением.`}
          confirmLabel="Удалить"
          variant="danger"
        />
      )}

      {/* Copy confirmation dialog */}
      {copyConfirmId && (
        <ConfirmDialog
          isOpen={!!copyConfirmId}
          onClose={() => setCopyConfirmId(null)}
          onCancel={() => setCopyConfirmId(null)}
          onConfirm={() => handleCopyProject(copyConfirmId)}
          title="Копировать проект?"
          message={`Создать копию проекта «${projects.find(p => p.id === copyConfirmId)?.name}»?`}
          confirmLabel="Копировать"
        />
      )}
    </div>
  );
}
