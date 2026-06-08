import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { ObjectData } from '../../types';

interface ObjectSelectorProps {
  className?: string;
}

export function ObjectSelector({ className = '' }: ObjectSelectorProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeObjectId = useProjectStore((s) => s.activeObjectId);
  const setActiveObjectId = useProjectStore((s) => s.setActiveObjectId);

  const objects = activeProject?.objects || [];

  if (objects.length <= 1) {
    return null; // Не показываем селектор если только один объект
  }

  return (
    <div className={`object-selector ${className}`} data-testid="object-selector">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Объект
      </label>
      <select
        value={activeObjectId || objects[0]?.id || ''}
        onChange={(e) => setActiveObjectId(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        {objects.map((obj: ObjectData) => (
          <option key={obj.id} value={obj.id}>
            {obj.name}
            {obj.city ? ` (${obj.city})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}