import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { ObjectData } from '../../types';
import { ObjectCard } from './ObjectCard';
import { CreateObjectModal } from './CreateObjectModal';

interface ObjectsListProps {
  className?: string;
}

export function ObjectsList({ className = '' }: ObjectsListProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeObjectId = useProjectStore((s) => s.activeObjectId);
  const setActiveObjectId = useProjectStore((s) => s.setActiveObjectId);
  const deleteObject = useProjectStore((s) => s.deleteObject);
  const copyObject = useProjectStore((s) => s.copyObject);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingObject, setEditingObject] = useState<ObjectData | null>(null);

  const objects = activeProject?.objects || [];

  const handleDelete = (objectId: string) => {
    if (window.confirm('Удалить объект? Все комнаты в этом объекте будут удалены.')) {
      deleteObject(objectId);
    }
  };

  const handleCopy = (objectId: string) => {
    const newId = copyObject(objectId);
    if (newId) {
      setActiveObjectId(newId);
    }
  };

  return (
    <div className={`objects-list ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">Объекты</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить
        </button>
      </div>

      <div className="space-y-2">
        {objects.map((obj: ObjectData) => (
          <ObjectCard
            key={obj.id}
            object={obj}
            isActive={obj.id === activeObjectId}
            roomsCount={obj.rooms?.length || 0}
            onClick={() => setActiveObjectId(obj.id)}
            onEdit={() => setEditingObject(obj)}
            onDelete={() => handleDelete(obj.id)}
            onCopy={() => handleCopy(obj.id)}
          />
        ))}
      </div>

      {objects.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">
          Нет объектов. Создайте первый объект.
        </p>
      )}

      {showCreateModal && (
        <CreateObjectModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingObject && (
        <CreateObjectModal
          object={editingObject}
          onClose={() => setEditingObject(null)}
        />
      )}
    </div>
  );
}