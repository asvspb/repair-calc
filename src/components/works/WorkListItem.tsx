import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronUp, Package, Wrench } from 'lucide-react';
import type { WorkData } from '../../App';
import { WorkTemplateSaveButton } from './WorkTemplateSaveButton';

type WorkListItemProps = {
  work: WorkData;
  costs: { work: number; material: number; tools: number; total: number };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onNameChange: (id: string, name: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onSaveTemplate?: (work: WorkData, forceReplace: boolean) => { success: boolean; error?: string; needsConfirm?: boolean };
};

export const WorkListItem: React.FC<WorkListItemProps> = ({
  work,
  costs,
  onToggle,
  onDelete,
  onNameChange,
  isExpanded = false,
  onToggleExpand,
  onSaveTemplate,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: work.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const totalCost = Math.ceil(costs.work + costs.material + costs.tools);
  const migratedWork = work.materials ? work : { ...work, materials: [], tools: [] };
  const hasMaterials = (migratedWork.materials?.length || 0) > 0;
  const hasTools = (migratedWork.tools?.length || 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl border transition-colors duration-200 ${
        work.enabled
          ? 'border-indigo-100 bg-indigo-50/30'
          : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            title="Перетащить для изменения порядка"
            aria-label="Перетащить элемент"
          >
            <GripVertical className="w-5 h-5" />
          </button>

          {/* Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(work.id);
            }}
            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 mt-0.5 ${
              work.enabled
                ? 'bg-indigo-600 border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700'
                : 'bg-white border-gray-300 hover:border-indigo-400'
            }`}
            title={work.enabled ? 'Отключить' : 'Включить'}
          >
            {work.enabled ? (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </button>

          {/* Work Name & Edit Area */}
          <div
            onClick={() => onToggleExpand && onToggleExpand(work.id)}
            className="flex-1 min-w-0 cursor-pointer"
          >
            <div className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors">
              <input
                value={work.name}
                onChange={(e) => onNameChange(work.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full"
                placeholder="Название работы"
              />
            </div>
            {work.enabled && (
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                {hasMaterials && (
                  <span className="inline-flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {migratedWork.materials!.length}
                  </span>
                )}
                {hasTools && (
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    {migratedWork.tools!.length}
                  </span>
                )}
                <span>нажмите для редактирования</span>
              </div>
            )}
          </div>

          {/* Price Section */}
          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-semibold text-indigo-900">
              {Math.ceil(totalCost).toLocaleString('ru-RU')} ₽
            </div>
            {(costs.work > 0 || costs.material > 0 || costs.tools > 0) && (
              <div className="text-xs text-gray-500 mt-0.5">
                {costs.work > 0 && (
                  <span>
                    Р: {Math.ceil(costs.work).toLocaleString('ru-RU')}
                  </span>
                )}
                {costs.work > 0 && costs.material > 0 && (
                  <span className="mx-1">•</span>
                )}
                {costs.material > 0 && (
                  <span>
                    М: {Math.ceil(costs.material).toLocaleString('ru-RU')}
                  </span>
                )}
                {costs.tools > 0 && (
                  <>
                    <span className="mx-1">•</span>
                    <span>
                      И: {Math.ceil(costs.tools).toLocaleString('ru-RU')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(work.id);
            }}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded/Collapsed indicator and Save Template button */}
        {onToggleExpand && (
          <div className="mt-2 ml-14 flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(work.id);
              }}
              className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
            >
              <ChevronUp
                className={`w-3 h-3 transition-transform ${
                  isExpanded ? 'rotate-0' : 'rotate-180'
                }`}
              />
              {isExpanded ? 'свернуть' : 'Развернуть'}
            </button>
            {onSaveTemplate && (
              <WorkTemplateSaveButton
                work={work}
                onSave={onSaveTemplate}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
