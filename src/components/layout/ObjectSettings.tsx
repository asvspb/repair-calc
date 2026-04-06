import React from 'react';
import { Plus, Briefcase } from 'lucide-react';
import type { ObjectData } from '../../types';
import { pluralize } from '../../utils/format';

type ObjectSettingsProps = {
  objects: ObjectData[];
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  onObjectChange: (id: string) => void;
  onAddObject: () => void;
  city: string;
  onCityChange: (city: string) => void;
};

export function ObjectSettings({
  objects,
  activeObjectId,
  activeObject,
  onObjectChange,
  onAddObject,
  city,
  onCityChange,
}: ObjectSettingsProps) {
  if (!objects || objects.length === 0) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-200 space-y-3">
      {/* Object selector section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Объект ремонта
          </label>
          {objects.length > 1 && (
            <button
              onClick={onAddObject}
              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Добавить объект"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {objects.length > 1 ? (
          <select
            value={activeObjectId || objects[0]?.id || ''}
            onChange={(e) => onObjectChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 truncate cursor-pointer"
          >
            {objects.map((obj) => (
              <option key={obj.id} value={obj.id}>
                {obj.name}{obj.city ? ` (${obj.city})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <Briefcase className="w-3 h-3 inline mr-2" />
            {activeObject?.name || objects[0]?.name}
          </div>
        )}
      </div>

      {/* City input field */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Город
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Для поиска цен"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}

/**
 * Секция "Другие объекты" для переключения между объектами проекта
 */
type OtherObjectsProps = {
  objects: ObjectData[];
  activeObjectId: string | null;
  onObjectClick: (objectId: string) => void;
};

export function OtherObjectsSection({
  objects,
  activeObjectId,
  onObjectClick,
}: OtherObjectsProps) {
  // Получаем ID активного объекта с fallback на первый объект
  const activeId = activeObjectId || objects[0]?.id;
  
  // Фильтруем - показываем только другие объекты (не активный)
  const otherObjects = objects.filter(obj => obj.id !== activeId);

  if (otherObjects.length === 0) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Другие объекты
      </div>
      <div className="space-y-1">
        {otherObjects.map((obj) => (
          <button
            key={obj.id}
            onClick={() => onObjectClick(obj.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer text-left"
          >
            <Briefcase className="w-4 h-4 text-gray-400" />
            <div className="flex-1 min-w-0">
              <div className="truncate">{obj.name}</div>
              <div className="text-xs text-gray-400">
                {obj.rooms?.length || 0} {pluralize(obj.rooms?.length || 0, 'комната', 'комнаты', 'комнат')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
