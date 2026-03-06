import React from 'react';
import { Plus, ChevronUp, Square, Triangle } from 'lucide-react';
import type { RoomData, Opening, WallSection, RoomSubSection } from '../../types';
import { SubSectionItem } from './SubSectionItem';

// Custom SVG icons for shapes not available in lucide-react
const Trapezoid = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19 L7 5 L17 5 L20 19 Z" />
  </svg>
);

const Parallelogram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 19 L12 5 L22 5 L18 19 Z" />
  </svg>
);

interface ExtendedGeometryProps {
  room: RoomData;
  isCollapsed: boolean;
  subSectionsExpanded: boolean;
  onToggleExpand: () => void;
  addSubSection: () => void;
  removeSubSection: (id: string) => void;
  updateSubSection: (id: string, field: keyof RoomSubSection, val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]) => void;
  updateSubSectionWindow: (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionWindow: (subSectionId: string) => void;
  removeSubSectionWindow: (subSectionId: string, windowId: string) => void;
  updateSubSectionDoor: (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionDoor: (subSectionId: string) => void;
  removeSubSectionDoor: (subSectionId: string, doorId: string) => void;
}

export function ExtendedGeometry({
  room,
  isCollapsed,
  subSectionsExpanded,
  onToggleExpand,
  addSubSection,
  removeSubSection,
  updateSubSection,
  updateSubSectionWindow,
  addSubSectionWindow,
  removeSubSectionWindow,
  updateSubSectionDoor,
  addSubSectionDoor,
  removeSubSectionDoor,
}: ExtendedGeometryProps) {
  if (isCollapsed) return null;

  return (
    <>
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs font-medium text-gray-600 mb-2">Доступные формы секций:</div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Square className="w-4 h-4 text-indigo-500" /> Прямоугольник</span>
          <span className="flex items-center gap-1"><Trapezoid className="w-4 h-4 text-indigo-500" /> Трапеция</span>
          <span className="flex items-center gap-1"><Triangle className="w-4 h-4 text-indigo-500" /> Треугольник</span>
          <span className="flex items-center gap-1"><Parallelogram className="w-4 h-4 text-indigo-500" /> Параллелограмм</span>
        </div>
      </div>

      {(room.subSections || []).length === 0 ? (
        <div className="text-sm text-gray-400 italic mb-4">Нет секций. Добавьте хотя бы одну секцию.</div>
      ) : (
        <div className="space-y-4 mb-4">
          {(room.subSections || []).map((subSection, i) => (
            <SubSectionItem
              key={subSection.id}
              index={i}
              subSection={subSection}
              roomHeight={room.height}
              onUpdate={updateSubSection}
              onRemove={removeSubSection}
              onUpdateWindow={updateSubSectionWindow}
              onAddWindow={addSubSectionWindow}
              onRemoveWindow={removeSubSectionWindow}
              onUpdateDoor={updateSubSectionDoor}
              onAddDoor={addSubSectionDoor}
              onRemoveDoor={removeSubSectionDoor}
            />
          ))}
        </div>
      )}

      <button
        onClick={addSubSection}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Добавить секцию
      </button>

      <div className="flex justify-end mt-4">
        <button
          onClick={onToggleExpand}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
        >
          <ChevronUp className={`w-4 h-4 transition-transform ${subSectionsExpanded ? '' : 'rotate-180'}`} />
          {subSectionsExpanded ? 'Свернуть' : 'Развернуть'}
        </button>
      </div>
    </>
  );
}
