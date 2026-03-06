import React from 'react';
import type { RoomData, Opening } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { OpeningList } from './OpeningList';

interface SimpleGeometryProps {
  room: RoomData;
  isCollapsed: boolean;
  updateRoom: (r: RoomData) => void;
  updateSimpleField: (field: 'length' | 'width', val: number) => void;
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
  updateRoom,
  updateSimpleField,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
}: SimpleGeometryProps) {
  if (isCollapsed) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Длина (м)</label>
          <NumberInput
            value={room.length}
            onChange={(v: number) => updateSimpleField('length', v)}
            className="w-full"
            step={0.1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Ширина (м)</label>
          <NumberInput
            value={room.width}
            onChange={(v: number) => updateSimpleField('width', v)}
            className="w-full"
            step={0.1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Высота (м)</label>
          <NumberInput
            value={room.height}
            onChange={(v: number) => updateRoom({ ...room, height: v })}
            className="w-full"
            step={0.1}
          />
        </div>
      </div>

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
    </>
  );
}
