import React from 'react';
import type { RoomData, Opening } from '../../types';
import { OpeningList } from './OpeningList';

interface SimpleGeometryProps {
  room: RoomData;
  isCollapsed: boolean;
  addWindow: () => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, field: keyof Opening, val: number | string) => void;
  addDoor: () => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, field: keyof Opening, val: number | string) => void;
}

export function SimpleGeometry({
  room,
  isCollapsed,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
}: SimpleGeometryProps) {
  if (isCollapsed) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      <OpeningList
        title="Окна"
        emptyText="Нет окон"
        commentPlaceholder="Комментарий (например, балконный блок)"
        openings={room.windows || []}
        onAdd={addWindow}
        onRemove={removeWindow}
        onUpdate={updateWindow}
      />
      <OpeningList
        title="Двери/Проход"
        emptyText="Нет дверей/проходов"
        commentPlaceholder="Комментарий (например, входная дверь)"
        openings={room.doors || []}
        onAdd={addDoor}
        onRemove={removeDoor}
        onUpdate={updateDoor}
      />
    </div>
  );
}
