import React from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { WorkListItem } from './WorkListItem';
import type { WorkData } from '../../types';

type WorkListProps = {
  works: WorkData[];
  costs: Record<string, { work: number; material: number; tools: number; total: number }>;
  expandedWorks: Set<string>;
  onToggleWork: (id: string) => void;
  onDeleteWork: (id: string) => void;
  onNameChange: (id: string, name: string) => void;
  onReorderWorks: (works: WorkData[]) => void;
  onToggleExpand: (id: string) => void;
  renderExpandedContent?: (work: WorkData) => React.ReactNode;
  onSaveTemplate?: (work: WorkData, forceReplace: boolean) => { success: boolean; error?: string; needsConfirm?: boolean };
};

export const WorkList: React.FC<WorkListProps> = ({
  works,
  costs,
  expandedWorks,
  onToggleWork,
  onDeleteWork,
  onNameChange,
  onReorderWorks,
  onToggleExpand,
  renderExpandedContent,
  onSaveTemplate,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = works.findIndex((w) => w.id === active.id);
      const newIndex = works.findIndex((w) => w.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newWorks = arrayMove(works, oldIndex, newIndex);
        onReorderWorks(newWorks);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={works.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {works.map((work) => (
            <div key={work.id}>
              <WorkListItem
                work={work}
                costs={costs[work.id] || { work: 0, material: 0, tools: 0, total: 0 }}
                onToggle={onToggleWork}
                onDelete={onDeleteWork}
                onNameChange={onNameChange}
                isExpanded={expandedWorks.has(work.id)}
                onToggleExpand={onToggleExpand}
                onSaveTemplate={onSaveTemplate}
              />
              {renderExpandedContent && expandedWorks.has(work.id) && (
                <div className="mt-3 ml-8 pl-4 border-l-2 border-indigo-100">
                  {renderExpandedContent(work)}
                </div>
              )}
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
