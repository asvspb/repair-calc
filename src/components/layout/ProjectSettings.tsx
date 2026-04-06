import React, { useState } from 'react';
import { Cloud, CloudOff, Edit2, Check, X as XIcon, Trash2 } from 'lucide-react';
import type { ProjectData } from '../../types';
import { IdMapper } from '../../utils/idMapper';

type ProjectSettingsProps = {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isSyncing: boolean;
  onProjectChange: (id: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onNewProject: () => void;
};

export function ProjectSettings({
  projects,
  activeProjectId,
  activeProject,
  isSyncing,
  onProjectChange,
  onRename,
  onDelete,
  onNewProject,
}: ProjectSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');

  const startEditing = () => {
    if (activeProject) {
      setEditedName(activeProject.name);
      setIsEditing(true);
    }
  };

  const saveName = () => {
    if (editedName.trim()) {
      onRename(editedName.trim());
    }
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  return (
    <div className="p-4 border-b border-gray-200">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Проект
      </label>

      {/* Edit mode */}
      {isEditing ? (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveName();
              } else if (e.key === 'Escape') {
                cancelEditing();
              }
            }}
            autoFocus
            className="flex-1 px-2 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={saveName}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
            title="Сохранить"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEditing}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Отмена"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* View mode with selector */
        <div className="relative mb-2 flex items-center gap-2">
          {/* Sync status indicator */}
          {activeProject && (
            <div className="shrink-0">
              {IdMapper.isServerId(activeProjectId) ? (
                <Cloud className="w-4 h-4 text-green-600" title="Синхронизирован с сервером" />
              ) : (
                <CloudOff className="w-4 h-4 text-amber-500" title="Локальный проект (не синхронизирован)" />
              )}
            </div>
          )}
          <select
            value={activeProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 truncate cursor-pointer"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Rename button */}
      {!isEditing && activeProject && (
        <button
          onClick={startEditing}
          className="w-full flex items-center justify-center gap-2 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm cursor-pointer"
        >
          <Edit2 className="w-4 h-4" />
          <span>Переименовать проект</span>
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        <span>Удалить проект</span>
      </button>
    </div>
  );
}
