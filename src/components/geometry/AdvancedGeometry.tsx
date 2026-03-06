import React from 'react';
import { Plus, Layers, Box, Ruler, X } from 'lucide-react';
import type { RoomData, Opening, RoomSegment, Obstacle, WallSection } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { OpeningList } from './OpeningList';

interface AdvancedGeometryProps {
  room: RoomData;
  segmentsDelta: number;
  obstaclesDelta: number;
  addSegment: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, field: keyof RoomSegment, val: string | number) => void;
  addObstacle: () => void;
  removeObstacle: (id: string) => void;
  updateObstacle: (id: string, field: keyof Obstacle, val: string | number) => void;
  addWallSection: () => void;
  removeWallSection: (id: string) => void;
  updateWallSection: (id: string, field: keyof WallSection, val: string | number) => void;
  addWindow: () => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, field: keyof Opening, val: number | string) => void;
  addDoor: () => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, field: keyof Opening, val: number | string) => void;
}

export function AdvancedGeometry({
  room,
  segmentsDelta,
  obstaclesDelta,
  addSegment,
  removeSegment,
  updateSegment,
  addObstacle,
  removeObstacle,
  updateObstacle,
  addWallSection,
  removeWallSection,
  updateWallSection,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
}: AdvancedGeometryProps) {
  return (
    <>
      {/* Segments */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-medium">Сегменты помещения</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Для L-образных комнат, ниш и эркеров</p>

        {(room.segments || []).length === 0 ? (
          <div className="text-sm text-gray-400 italic mb-4">Нет сегментов</div>
        ) : (
          <div className="space-y-3 mb-4">
            {(room.segments || []).map((segment, i) => (
              <div key={segment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                  <input
                    value={segment.name}
                    onChange={e => updateSegment(segment.id, 'name', e.target.value)}
                    className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                    placeholder="Название"
                  />
                  <button
                    onClick={() => removeSegment(segment.id)}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-8">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                    <NumberInput
                      value={segment.length}
                      onChange={(v: number) => updateSegment(segment.id, 'length', v)}
                      className="w-full"
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
                    <NumberInput
                      value={segment.width}
                      onChange={(v: number) => updateSegment(segment.id, 'width', v)}
                      className="w-full"
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Операция</label>
                    <select
                      value={segment.operation}
                      onChange={e => updateSegment(segment.id, 'operation', e.target.value)}
                      className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="add">Добавить</option>
                      <option value="subtract">Вычесть</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      Площадь: {(segment.length * segment.width).toFixed(2)} м²
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(room.segments || []).length > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
            <div className="text-sm text-indigo-700">
              <span className="font-medium">Итого сегменты:</span> {segmentsDelta > 0 ? '+' : ''}{segmentsDelta.toFixed(2)} м²
            </div>
          </div>
        )}

        <button
          onClick={addSegment}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить сегмент
        </button>
      </div>

      {/* Obstacles */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Box className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-medium">Препятствия</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Колонны, воздуховоды, ниши</p>

        {(room.obstacles || []).length === 0 ? (
          <div className="text-sm text-gray-400 italic mb-4">Нет препятствий</div>
        ) : (
          <div className="space-y-3 mb-4">
            {(room.obstacles || []).map((obstacle, i) => (
              <div key={obstacle.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                  <input
                    value={obstacle.name}
                    onChange={e => updateObstacle(obstacle.id, 'name', e.target.value)}
                    className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                    placeholder="Название"
                  />
                  <button
                    onClick={() => removeObstacle(obstacle.id)}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pl-8">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Тип</label>
                    <select
                      value={obstacle.type}
                      onChange={e => updateObstacle(obstacle.id, 'type', e.target.value)}
                      className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="column">Колонна</option>
                      <option value="duct">Воздуховод</option>
                      <option value="niche">Ниша</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Площадь (м²)</label>
                    <NumberInput
                      value={obstacle.area}
                      onChange={(v: number) => updateObstacle(obstacle.id, 'area', v)}
                      className="w-full"
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Периметр (м)</label>
                    <NumberInput
                      value={obstacle.perimeter}
                      onChange={(v: number) => updateObstacle(obstacle.id, 'perimeter', v)}
                      className="w-full"
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Операция</label>
                    <select
                      value={obstacle.operation}
                      onChange={e => updateObstacle(obstacle.id, 'operation', e.target.value)}
                      className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="add">Добавить</option>
                      <option value="subtract">Вычесть</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      {obstacle.operation === 'add' ? '+' : '-'} {obstacle.area.toFixed(2)} м²
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(room.obstacles || []).length > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
            <div className="text-sm text-indigo-700">
              <span className="font-medium">Итого препятствия:</span> {obstaclesDelta > 0 ? '+' : ''}{obstaclesDelta.toFixed(2)} м²
            </div>
          </div>
        )}

        <button
          onClick={addObstacle}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить препятствие
        </button>
      </div>

      {/* Wall Sections */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-medium">Перепады высоты стен</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Участки стен с отличающейся высотой</p>

        {(room.wallSections || []).length === 0 ? (
          <div className="text-sm text-gray-400 italic mb-4">Нет перепадов высоты</div>
        ) : (
          <div className="space-y-3 mb-4">
            {(room.wallSections || []).map((section, i) => (
              <div key={section.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                  <input
                    value={section.name}
                    onChange={e => updateWallSection(section.id, 'name', e.target.value)}
                    className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                    placeholder="Название"
                  />
                  <button
                    onClick={() => removeWallSection(section.id)}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 pl-8">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                    <NumberInput
                      value={section.length}
                      onChange={(v: number) => updateWallSection(section.id, 'length', v)}
                      className="w-full"
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Высота (м)</label>
                    <NumberInput
                      value={section.height}
                      onChange={(v: number) => updateWallSection(section.id, 'height', v)}
                      className="w-full"
                      step={0.1}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      Площадь: {(section.length * section.height).toFixed(2)} м²
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addWallSection}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить участок
        </button>
      </div>

      {/* Windows and Doors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
