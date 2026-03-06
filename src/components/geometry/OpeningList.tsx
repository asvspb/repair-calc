import React from 'react';
import { X } from 'lucide-react';
import type { Opening } from '../../types';
import { NumberInput } from '../ui/NumberInput';

interface OpeningListProps {
  title: string;
  emptyText: string;
  commentPlaceholder: string;
  openings: Opening[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof Opening, val: number | string) => void;
}

export function OpeningList({
  title,
  emptyText,
  commentPlaceholder,
  openings,
  onAdd,
  onRemove,
  onUpdate,
}: OpeningListProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        <button
          onClick={onAdd}
          className="text-xs text-indigo-600 font-medium hover:text-indigo-700 cursor-pointer"
        >
          + Добавить
        </button>
      </div>
      {openings.length === 0 ? (
        <div className="text-xs text-gray-400 italic">{emptyText}</div>
      ) : (
        <div className="space-y-3">
          {openings.map((opening, i) => (
            <div key={opening.id} className="p-2 bg-white rounded border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 w-4 font-medium">{i + 1}.</span>
                <NumberInput
                  value={opening.width}
                  onChange={(v: number) => onUpdate(opening.id, 'width', v)}
                  className="w-20 text-xs py-1"
                  step={0.1}
                />
                <span className="text-gray-400 text-xs">×</span>
                <NumberInput
                  value={opening.height}
                  onChange={(v: number) => onUpdate(opening.id, 'height', v)}
                  className="w-20 text-xs py-1"
                  step={0.1}
                />
                <button
                  onClick={() => onRemove(opening.id)}
                  className="p-0.5 text-gray-300 hover:text-red-500 ml-auto cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                placeholder={commentPlaceholder}
                value={opening.comment || ''}
                onChange={(e) => onUpdate(opening.id, 'comment', e.target.value)}
                className="w-full text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
