import React from 'react';
import type { ObjectData } from '../../types';

interface ObjectCardProps {
  object: ObjectData;
  isActive: boolean;
  roomsCount: number;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function ObjectCard({
  object,
  isActive,
  roomsCount,
  onClick,
  onEdit,
  onDelete,
  onCopy,
}: ObjectCardProps) {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy();
  };

  return (
    <div
      onClick={onClick}
      className={`
        object-card p-3 rounded-lg border cursor-pointer transition-all
        ${isActive
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {object.name}
          </h4>
          {object.city && (
            <p className="text-xs text-gray-500 mt-0.5">{object.city}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {roomsCount} {roomsCount === 1 ? 'комната' : roomsCount < 5 ? 'комнаты' : 'комнат'}
          </p>
        </div>

        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={handleEdit}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="Редактировать"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-green-600 rounded"
            title="Копировать"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="Удалить"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}