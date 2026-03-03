import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight } from 'lucide-react';
import type { RoomData } from '../../App';

type RoomListItemProps = {
  room: RoomData;
  isActive: boolean;
  onClick: () => void;
};

export const RoomListItem: React.FC<RoomListItemProps> = ({
  room,
  isActive,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center transition-all ${
        isDragging
          ? 'opacity-50'
          : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="px-2 py-3 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Перетащить для изменения порядка"
        aria-label="Перетащить элемент"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="truncate pr-2">{room.name}</span>
        <ChevronRight className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
      </button>
    </div>
  );
};
