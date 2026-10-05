import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectData } from '@shared/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useAuth } from '../../features/auth/model/AuthContext';
import { StorageManager } from '../../utils/storage';
import { ApiStorageProvider } from '../../api/storage/apiStorageProvider';
import { migrateProjectToObjects } from '../../utils/projectObjects';
import { cloneProject } from '../../domain/factories/projectFactory';
import { dlog, derror } from '../../utils/debugLogger';
import { useProjectExports } from './useProjectExports';
import { logError } from '../../utils/logger';
import type { ImportStatus } from './modalTypes';

const LOG_PREFIX = '[ProjectsModal]';

interface UseProjectsModalArgs {
  isOpen: boolean;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
}

/**
 * Логика ProjectsModal (TASK-BATCH-013-split-ui): хуки состояния и обработчики
 * вынесены из компонента, публичное поведение не меняется.
 */
export function useProjectsModal({ isOpen, onImportTemplates }: UseProjectsModalArgs) {
  const projects = useProjectStore(s => s.projects);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActiveProjectId = useProjectStore(s => s.setActiveProjectId);
  const updateProjects = useProjectStore(s => s.updateProjects);
  const createProject = useProjectStore(s => s.createProject);
  const deleteProject = useProjectStore(s => s.deleteProject);

  const { isAuthenticated } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copyConfirmId, setCopyConfirmId] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleExportJSON, handleExportCSV } = useProjectExports({
    projects,
    activeProjectId,
    setImportStatus,
  });

  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowCreateModal(false);
      setEditingProjectId(null);
      setImportStatus(null);
      setDeleteConfirmId(null);
      setCopyConfirmId(null);
    }
  }, [isOpen]);

  // Create new project via modal
  const handleCreateProject = useCallback(
    async (data: { name: string; city?: string; objects: string[] }) => {
      dlog(LOG_PREFIX, '[Create] Received create request:', data);
      setIsCreating(true);
      try {
        dlog(LOG_PREFIX, '[Create] Calling context.createProject...');
        const newProject = await createProject({
          name: data.name,
          city: data.city,
          objects: data.objects,
        });

        dlog(
          LOG_PREFIX,
          '[Create] Project created OK:',
          newProject.id,
          newProject.name,
          '- objects:',
          newProject.objects?.length || 0,
        );
        setShowCreateModal(false);
        setImportStatus({
          type: 'success',
          message: `Проект "${newProject.name}" успешно создан`,
        });
      } catch (error) {
        derror(LOG_PREFIX, '[Create] Error creating project:', error);
        setImportStatus({
          type: 'error',
          message: 'Ошибка создания проекта',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [createProject],
  );

  // Import projects from backup
  const handleImportFromBackup = useCallback(
    (importedProjects: ProjectData[]) => {
      dlog(
        LOG_PREFIX,
        '[Import] Received',
        importedProjects.length,
        'project(s):',
        importedProjects.map(p => p.name),
      );
      if (importedProjects.length === 0) return;

      // updateProjects expects an array, not a function
      const updated = [...projects, ...importedProjects];
      dlog(LOG_PREFIX, '[Import] Total projects now:', updated.length);
      updateProjects(updated);

      if (importedProjects[0]) {
        dlog(LOG_PREFIX, '[Import] Setting active to:', importedProjects[0].name);
        setActiveProjectId(importedProjects[0].id);
      }

      setImportStatus({
        type: 'success',
        message: `Импортировано проектов: ${importedProjects.length}`,
      });
    },
    [projects, updateProjects, setActiveProjectId],
  );

  // Rename project
  const handleRenameProject = useCallback(
    (projectId: string) => {
      if (!editingName.trim()) {
        setEditingProjectId(null);
        return;
      }

      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const updatedProjects = projects.map(p =>
        p.id === projectId ? { ...p, name: editingName.trim() } : p,
      );
      updateProjects(updatedProjects);
      setEditingProjectId(null);
    },
    [projects, editingName, updateProjects],
  );

  // Copy project
  const handleCopyProject = useCallback(
    (projectId: string) => {
      const sourceProject = projects.find(p => p.id === projectId);
      if (!sourceProject) return;

      const copiedProject = cloneProject(sourceProject);
      copiedProject.name = `${sourceProject.name} (копия)`;

      const updatedProjects = [...projects, copiedProject];
      updateProjects(updatedProjects);
      setActiveProjectId(copiedProject.id);

      setCopyConfirmId(null);
      setImportStatus({
        type: 'success',
        message: `Проект "${sourceProject.name}" успешно скопирован`,
      });
    },
    [projects, updateProjects, setActiveProjectId],
  );

  // Delete project
  const handleDeleteProject = useCallback(
    async (projectId: string) => {
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
        logError('ProjectsModal', 'Error deleting project', error);
        setImportStatus({
          type: 'error',
          message: 'Ошибка удаления проекта',
        });
      }
    },
    [projects, activeProjectId, isAuthenticated, deleteProject, updateProjects, setActiveProjectId],
  );

  // Import JSON
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      const result = StorageManager.importFromJSON(content);

      if (result.success) {
        setImportStatus({
          type: 'confirm',
          message: `Найдено ${result.data.projects.length} проектов. Заменить текущие данные?`,
          data: result.data,
        });
      } else {
        const failure = result as Extract<typeof result, { success: false }>;
        setImportStatus({
          type: 'error',
          message: failure.error,
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
      logError('ProjectsModal', 'Error saving to server', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка сохранения на сервер. Проверьте подключение.',
      });
    } finally {
      setIsSavingToServer(false);
    }
  }, [isAuthenticated, projects, setImportStatus]);

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
      logError('ProjectsModal', 'Error loading from server', error);
      setImportStatus({
        type: 'error',
        message: 'Ошибка загрузки с сервера. Проверьте подключение.',
      });
    } finally {
      setIsLoadingFromServer(false);
    }
  }, [isAuthenticated, updateProjects, setActiveProjectId, setImportStatus]);

  return {
    // store
    projects,
    activeProjectId,
    setActiveProjectId,
    isAuthenticated,
    // create modal
    showCreateModal,
    setShowCreateModal,
    isCreating,
    handleCreateProject,
    handleImportFromBackup,
    // editing
    editingProjectId,
    editingName,
    setEditingName,
    setEditingProjectId,
    handleRenameProject,
    // confirmations
    deleteConfirmId,
    setDeleteConfirmId,
    copyConfirmId,
    setCopyConfirmId,
    handleCopyProject,
    handleDeleteProject,
    // status / import / export
    importStatus,
    setImportStatus,
    fileInputRef,
    handleFileSelect,
    handleConfirmImport,
    handleExportJSON,
    handleExportCSV,
    // server sync
    isSavingToServer,
    isLoadingFromServer,
    handleSaveAllToServer,
    handleLoadAllFromServer,
  };
}

export type ProjectsModalController = ReturnType<typeof useProjectsModal>;
