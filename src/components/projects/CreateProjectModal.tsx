import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Upload, FileJson, FolderOpen, Check } from 'lucide-react';
import type { ProjectData } from '../../types';
import { StorageManager, type BackupData } from '../../utils/storage';
import { migrateProjectToObjects } from '../../utils/projectObjects';
import { dlog, derror } from '../../utils/debugLogger';

const LOG_PREFIX = '[CreateProjectModal]';

type TabType = 'new' | 'backup';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; city?: string; objects: string[] }) => void;
  onImportFromBackup?: (projects: ProjectData[]) => void;
  isCreating?: boolean;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
  onImportFromBackup,
  isCreating = false
}: CreateProjectModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('new');

  // New project form state
  const [projectName, setProjectName] = useState('');
  const [city, setCity] = useState('');
  const [objects, setObjects] = useState<string[]>(['']);
  const [errors, setErrors] = useState<{ projectName?: string; objects?: string }>({});

  // Backup import state
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Log when modal opens/closes
  useEffect(() => {
    dlog(LOG_PREFIX, 'isOpen changed to:', isOpen);
    if (isOpen) {
      dlog(LOG_PREFIX, 'Modal opened, resetting form');
      setProjectName('');
      setCity('');
      setObjects(['']);
      setErrors({});
      setBackupData(null);
      setSelectedProjectIds(new Set());
      setBackupError(null);
      setActiveTab('new');
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        dlog(LOG_PREFIX, 'Escape pressed, closing');
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const addObject = () => {
    dlog(LOG_PREFIX, 'Adding object field, current count:', objects.length);
    setObjects([...objects, '']);
  };

  const removeObject = (index: number) => {
    if (objects.length > 1) {
      dlog(LOG_PREFIX, 'Removing object at index', index, '- remaining:', objects.length - 1);
      const newObjects = objects.filter((_, i) => i !== index);
      setObjects(newObjects);
    }
  };

  const updateObject = (index: number, value: string) => {
    const newObjects = [...objects];
    newObjects[index] = value;
    setObjects(newObjects);
  };

  const validate = (): boolean => {
    const newErrors: { projectName?: string; objects?: string } = {};

    if (!projectName.trim()) {
      newErrors.projectName = 'Введите название проекта';
      dlog(LOG_PREFIX, 'Validation FAILED: empty project name');
    }

    const validObjects = objects.filter(o => o.trim());
    if (validObjects.length === 0) {
      newErrors.objects = 'Добавьте хотя бы один объект';
      dlog(LOG_PREFIX, 'Validation FAILED: no valid objects');
    }

    const isValid = Object.keys(newErrors).length === 0;
    dlog(LOG_PREFIX, 'Validation result:', isValid, '- errors:', newErrors);
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dlog(LOG_PREFIX, '=== Form submit triggered ===');
    dlog(LOG_PREFIX, 'Form data:', { projectName, city, objects });

    if (!validate()) {
      dlog(LOG_PREFIX, 'Submit BLOCKED due to validation errors');
      return;
    }

    const validObjects = objects.filter(o => o.trim());
    const payload = {
      name: projectName.trim(),
      city: city.trim() || undefined,
      objects: validObjects,
    };

    dlog(LOG_PREFIX, 'Calling onCreate with:', payload);
    onCreate(payload);
  };

  // Handle file selection for backup import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    dlog(LOG_PREFIX, '[Backup] File selected:', file.name, `(${file.size} bytes)`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = StorageManager.importFromJSON(content);

        if (result.success) {
          dlog(LOG_PREFIX, '[Backup] Parsed OK, projects found:', result.data.projects.length);
          setBackupData(result.data);
          setBackupError(null);
          setSelectedProjectIds(new Set(result.data.projects.map(p => p.id)));
        } else {
          dlog(LOG_PREFIX, '[Backup] Parse FAILED:', result.error);
          setBackupData(null);
          setBackupError(result.error);
        }
      } catch {
        derror(LOG_PREFIX, '[Backup] Exception during parse');
        setBackupData(null);
        setBackupError('Ошибка чтения файла. Убедитесь, что это корректный JSON.');
      }
    };
    reader.onerror = () => {
      derror(LOG_PREFIX, '[Backup] File read error');
      setBackupData(null);
      setBackupError('Не удалось прочитать файл');
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    const newSelection = new Set(selectedProjectIds);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjectIds(newSelection);
  };

  const selectAllProjects = () => {
    if (backupData) {
      setSelectedProjectIds(new Set(backupData.projects.map(p => p.id)));
    }
  };

  const deselectAllProjects = () => {
    setSelectedProjectIds(new Set());
  };

  const handleImportBackup = () => {
    if (!backupData || selectedProjectIds.size === 0 || !onImportFromBackup) {
      dlog(LOG_PREFIX, '[Backup] Import BLOCKED:', {
        hasBackup: !!backupData,
        selectedCount: selectedProjectIds.size,
        hasHandler: !!onImportFromBackup,
      });
      return;
    }

    const selectedProjects = backupData.projects
      .filter(p => selectedProjectIds.has(p.id))
      .map(p => migrateProjectToObjects(p));

    dlog(LOG_PREFIX, '[Backup] Importing', selectedProjects.length, 'project(s):', selectedProjects.map(p => p.name));
    onImportFromBackup(selectedProjects);
  };

  const handleTabChange = (tab: TabType) => {
    dlog(LOG_PREFIX, 'Tab changed to:', tab);
    setActiveTab(tab);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      dlog(LOG_PREFIX, 'Backdrop clicked, closing');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full animate-scale-in" data-testid="create-project-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">
              Новый проект
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200" role="tablist">
            <button
              onClick={() => handleTabChange('new')}
              role="tab"
              aria-selected={activeTab === 'new'}
              aria-controls="panel-new"
              id="tab-new"
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'new'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              Создать новый
            </button>
            <button
              onClick={() => handleTabChange('backup')}
              role="tab"
              aria-selected={activeTab === 'backup'}
              aria-controls="panel-backup"
              id="tab-backup"
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'backup'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline-block mr-2" />
              Из бекапа
            </button>
          </div>

          {/* Content */}
          <div className="p-6 min-h-[420px]">
            {activeTab === 'new' && (
              <div role="tabpanel" id="panel-new" aria-labelledby="tab-new">
              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  {/* Project name */}
                  <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Название проекта *
                    </label>
                    <input
                      type="text"
                      id="projectName"
                      value={projectName}
                      onChange={(e) => {
                        setProjectName(e.target.value);
                        if (errors.projectName) setErrors({ ...errors, projectName: undefined });
                      }}
                      placeholder="Например: Ремонт в новостройке"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    {errors.projectName && (
                      <p className="mt-1.5 text-sm text-red-600">{errors.projectName}</p>
                    )}
                  </div>

                  {/* Objects */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Объекты *
                    </label>
                    <div className="space-y-2">
                      {objects.map((obj, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={obj}
                            onChange={(e) => {
                              updateObject(index, e.target.value);
                              if (errors.objects) setErrors({ ...errors, objects: undefined });
                            }}
                            placeholder={index === 0 ? "Например: Квартира" : "Название объекта"}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          {objects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeObject(index)}
                              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Удалить объект"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {errors.objects && (
                      <p className="mt-1.5 text-sm text-red-600">{errors.objects}</p>
                    )}
                    <button
                      type="button"
                      onClick={addObject}
                      className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Добавить объект</span>
                    </button>
                  </div>

                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Город
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Например: Москва (для поиска цен)"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {isCreating ? 'Создание...' : 'Создать проект'}
                  </button>
                </div>
              </form>
              </div>
            )}

            {activeTab === 'backup' && (
              <div role="tabpanel" id="panel-backup" aria-labelledby="tab-backup">
              <div>
                {/* File upload */}
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                  >
                    <FileJson className="w-8 h-8 text-gray-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-700">
                        {backupData ? 'Выбрать другой файл' : 'Выберите файл бекапа'}
                      </p>
                      <p className="text-xs text-gray-500">
                        JSON файл экспорта из приложения
                      </p>
                    </div>
                  </button>
                </div>

                {/* Error message */}
                {backupError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{backupError}</p>
                  </div>
                )}

                {/* Backup content */}
                {backupData && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600">
                        Найдено проектов: {backupData.projects.length}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllProjects}
                          className="text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer"
                        >
                          Выбрать все
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={deselectAllProjects}
                          className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                        >
                          Снять выбор
                        </button>
                      </div>
                    </div>

                    {/* Project list */}
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {backupData.projects.map(project => {
                        const isSelected = selectedProjectIds.has(project.id);
                        return (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => toggleProjectSelection(project.id)}
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Выбрать проект "${project.name}"`}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                isSelected ? 'text-indigo-900' : 'text-gray-700'
                              }`}>
                                {project.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {project.objects?.length || project.rooms?.length || 0} объектов
                                {project.city && ` • ${project.city}`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {backupData.exportedAt && (
                      <p className="mt-2 text-xs text-gray-400">
                        Дата экспорта: {new Date(backupData.exportedAt).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleImportBackup}
                    disabled={isCreating || !backupData || selectedProjectIds.size === 0}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {isCreating
                      ? 'Импорт...'
                      : `Импортировать ${selectedProjectIds.size > 0 ? `(${selectedProjectIds.size})` : ''}`
                    }
                  </button>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
