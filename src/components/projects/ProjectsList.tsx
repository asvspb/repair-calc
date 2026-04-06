import React, { useState } from 'react';
import { FolderOpen, Edit2, Check, X as XIcon, Copy, Trash2, Plus } from 'lucide-react';
import type { ProjectData } from '../../types';
import { getAllRooms } from '../../utils/projectObjects';
import { pluralize } from '../../utils/format';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type ProjectsListProps = {
  projects: ProjectData[];
  activeProjectId: string;
  onProjectSelect: (id: string) => void;
  onProjectRename: (id: string, name: string) => void;
  onProjectCopy: (id: string) => void;
  onProjectDelete: (id: string) => void;
  onNewProject: () => void;
};

export function ProjectsList({
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectRename,
  onProjectCopy,
  onProjectDelete,
  onNewProject,
}: ProjectsListProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copyConfirmId, setCopyConfirmId] = useState<string | null>(null);

  const getProjectStats = (project: ProjectData) => {
    const objectsCount = project.objects?.length || 0;
    const allRooms = getAllRooms(project);
    const roomsCount = allRooms.length;

    return { objectsCount, roomsCount };
  };

  const startEditing = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingName(currentName);
  };

  const saveName = (projectId: string) => {
    if (editingName.trim()) {
      onProjectRename(projectId, editingName.trim());
    }
    setEditingProjectId(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  return (
    <div className="border-b border-gray-200">
      <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Проекты
        </div>
        <button
          onClick={onNewProject}
          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
          title="Новый проект"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Project list */}
      <div className="max-h-64 overflow-y-auto">
        {projects.map(project => {
          const stats = getProjectStats(project);
          const isActive = project.id === activeProjectId;
          const isEditing = editingProjectId === project.id;

          return (
            <div
              key={project.id}
              className={`group px-4 py-2.5 border-t border-gray-100 transition-colors ${
                isActive
                  ? 'bg-indigo-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Project name or edit input */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(project.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                    />
                    <button
                      onClick={() => saveName(project.id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer"
                      title="Сохранить"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      title="Отмена"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onProjectSelect(project.id)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {project.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {stats.objectsCount} {pluralize(stats.objectsCount, 'объект', 'объекта', 'объектов')}
                      {stats.roomsCount > 0 && `, ${stats.roomsCount} ${pluralize(stats.roomsCount, 'комната', 'комнаты', 'комнат')}`}
                    </div>
                  </button>
                )}

                {/* Action buttons */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditing(project.id, project.name)}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                      title="Переименовать"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setCopyConfirmId(project.id)}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                      title="Копировать"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <ConfirmDialog
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onConfirm={() => {
            onProjectDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          onCancel={() => setDeleteConfirmId(null)}
          title="Удалить проект?"
          message="Проект будет удалён безвозвратно."
          confirmLabel="Удалить"
          variant="danger"
        />
      )}

      {/* Copy confirmation dialog */}
      {copyConfirmId && (
        <ConfirmDialog
          isOpen={!!copyConfirmId}
          onClose={() => setCopyConfirmId(null)}
          onConfirm={() => {
            onProjectCopy(copyConfirmId);
            setCopyConfirmId(null);
          }}
          onCancel={() => setCopyConfirmId(null)}
          title="Копировать проект?"
          message="Будет создана копия проекта со всеми объектами и комнатами."
          confirmLabel="Копировать"
          variant="info"
        />
      )}
    </div>
  );
}
