import { Edit2, Copy, Trash2, FolderOpen } from 'lucide-react';
import type { ProjectData } from '@shared/types';
import { calculateRoomCosts } from '../../domain/pricing/costs';
import { getAllRooms } from '../../utils/projectObjects';
import { pluralize } from '../../utils/format';

interface ProjectListItemProps {
  project: ProjectData;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEditing: (project: ProjectData) => void;
  onRename: (projectId: string) => void;
  onCancelEditing: () => void;
  onActivate: (projectId: string) => void;
  onCopy: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

/** Статистика проекта: объекты, комнаты, суммарная стоимость */
export function getProjectStats(project: ProjectData) {
  const objectsCount = project.objects?.length || 0;
  const allRooms = getAllRooms(project);
  const roomsCount = allRooms.length;

  let totalCost = 0;
  for (const room of allRooms) {
    const roomCosts = calculateRoomCosts(room);
    totalCost += roomCosts.total;
  }

  return { objectsCount, roomsCount, totalCost };
}

/** Карточка проекта в списке ProjectsModal (выделена из ProjectsModal, TASK-BATCH-013). */
export function ProjectListItem({
  project,
  isActive,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEditing,
  onRename,
  onCancelEditing,
  onActivate,
  onCopy,
  onDelete,
}: ProjectListItemProps) {
  const stats = getProjectStats(project);

  return (
    <div
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
              onChange={e => onEditingNameChange(e.target.value)}
              className="w-full px-3 py-1.5 text-lg font-medium border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
              autoFocus
              onBlur={() => onRename(project.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRename(project.id);
                if (e.key === 'Escape') onCancelEditing();
              }}
            />
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              <h3 className="text-lg font-medium text-gray-900 truncate">{project.name}</h3>
              {isActive && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  Активен
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            {project.city && <span>{project.city}</span>}
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
              onClick={() => onStartEditing(project)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Переименовать"
            >
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
          )}

          <button
            onClick={() => onCopy(project.id)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Копировать"
          >
            <Copy className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => onDelete(project.id)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>

          {!isActive && (
            <button
              onClick={() => onActivate(project.id)}
              className="ml-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Открыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
