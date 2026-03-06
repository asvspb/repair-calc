import React from 'react';
import { Trash2, HelpCircle, Square } from 'lucide-react';
import type { RoomSubSection, Opening, WallSection } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { OpeningList } from './OpeningList';
import { GeometryMetrics } from './GeometryMetrics';
import { calculateSectionMetrics } from '../../utils/geometry';

// Custom SVG icons for shapes
const Trapezoid = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19 L7 5 L17 5 L20 19 Z" />
  </svg>
);

const Triangle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 L22 19 L2 19 Z" />
  </svg>
);

const Parallelogram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 19 L12 5 L22 5 L18 19 Z" />
  </svg>
);

interface SubSectionItemProps {
  index: number;
  subSection: RoomSubSection;
  roomHeight: number;
  onUpdate: (id: string, field: keyof RoomSubSection, val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]) => void;
  onRemove: (id: string) => void;
  onUpdateWindow: (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => void;
  onAddWindow: (subSectionId: string) => void;
  onRemoveWindow: (subSectionId: string, windowId: string) => void;
  onUpdateDoor: (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => void;
  onAddDoor: (subSectionId: string) => void;
  onRemoveDoor: (subSectionId: string, doorId: string) => void;
}

export const SubSectionItem = React.memo(function SubSectionItem({
  index,
  subSection,
  roomHeight,
  onUpdate,
  onRemove,
  onUpdateWindow,
  onAddWindow,
  onRemoveWindow,
  onUpdateDoor,
  onAddDoor,
  onRemoveDoor,
}: SubSectionItemProps) {
  // Calculate metrics using the utility function
  const subMetrics = calculateSectionMetrics(subSection);
  const openingsArea = (subSection.windows || []).reduce((sum, w) => sum + w.width * w.height, 0) +
                      (subSection.doors || []).reduce((sum, d) => sum + d.width * d.height, 0);
  const wallArea = subMetrics.perimeter * roomHeight - openingsArea;
  const volume = subMetrics.area * roomHeight;
  const doorsWidth = (subSection.doors || []).reduce((sum, d) => sum + d.width, 0);
  const skirtingLength = Math.max(0, subMetrics.perimeter - doorsWidth);

  // Shape icon
  const ShapeIcon = subSection.shape === 'trapezoid' ? Trapezoid :
                    subSection.shape === 'triangle' ? Triangle :
                    subSection.shape === 'parallelogram' ? Parallelogram : Square;

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">{index + 1}</span>
        <ShapeIcon className="w-4 h-4 text-indigo-500" />
        <input
          value={subSection.name}
          onChange={e => onUpdate(subSection.id, 'name', e.target.value)}
          className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
          placeholder="Название секции"
        />
        <button
          onClick={() => onRemove(subSection.id)}
          className="p-1 text-gray-400 hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Shape selector */}
      <div className="mb-4 pl-10">
        <label className="block text-xs text-gray-500 mb-2">Форма секции</label>
        <div className="flex flex-wrap gap-2">
          {(['rectangle', 'trapezoid', 'triangle', 'parallelogram'] as const).map(shape => {
            const Icon = shape === 'trapezoid' ? Trapezoid :
                        shape === 'triangle' ? Triangle :
                        shape === 'parallelogram' ? Parallelogram : Square;
            const label = shape === 'rectangle' ? 'Прямоугольник' :
                          shape === 'trapezoid' ? 'Трапеция' :
                          shape === 'triangle' ? 'Треугольник' : 'Параллелограмм';
            return (
              <button
                key={shape}
                onClick={() => onUpdate(subSection.id, 'shape', shape)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  (subSection.shape || 'rectangle') === shape
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimension inputs based on shape */}
      <div className="mb-4 pl-10">
        {subSection.shape === 'rectangle' || !subSection.shape ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
              <NumberInput
                value={subSection.length}
                onChange={(v: number) => onUpdate(subSection.id, 'length', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
              <NumberInput
                value={subSection.width}
                onChange={(v: number) => onUpdate(subSection.id, 'width', v)}
                className="w-full"
                step={0.1}
              />
            </div>
          </div>
        ) : subSection.shape === 'trapezoid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Основание 1 (м)</label>
              <NumberInput
                value={subSection.base1 || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'base1', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Основание 2 (м)</label>
              <NumberInput
                value={subSection.base2 || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'base2', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Глубина (м)
                <span className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Расстояние между основаниями
                  </span>
                </span>
              </label>
              <NumberInput
                value={subSection.depth || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'depth', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Бок. сторона 1 (м)</label>
              <NumberInput
                value={subSection.side1 || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'side1', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Бок. сторона 2 (м)</label>
              <NumberInput
                value={subSection.side2 || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'side2', v)}
                className="w-full"
                step={0.1}
              />
            </div>
          </div>
        ) : subSection.shape === 'triangle' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Сторона A (м)</label>
              <NumberInput
                value={subSection.sideA || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'sideA', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Сторона B (м)</label>
              <NumberInput
                value={subSection.sideB || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'sideB', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Сторона C (м)</label>
              <NumberInput
                value={subSection.sideC || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'sideC', v)}
                className="w-full"
                step={0.1}
              />
            </div>
          </div>
        ) : subSection.shape === 'parallelogram' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Основание (м)</label>
              <NumberInput
                value={subSection.base || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'base', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Глубина (м)
                <span className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Высота, опущенная на основание
                  </span>
                </span>
              </label>
              <NumberInput
                value={subSection.depth || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'depth', v)}
                className="w-full"
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Боковая сторона (м)</label>
              <NumberInput
                value={subSection.side || 0}
                onChange={(v: number) => onUpdate(subSection.id, 'side', v)}
                className="w-full"
                step={0.1}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Windows and Doors for this subsection */}
      <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <OpeningList
          title="Окна"
          emptyText="Нет окон"
          commentPlaceholder="Комментарий"
          openings={subSection.windows || []}
          onAdd={() => onAddWindow(subSection.id)}
          onRemove={(id) => onRemoveWindow(subSection.id, id)}
          onUpdate={(id, field, val) => onUpdateWindow(subSection.id, id, field, val)}
        />
        <OpeningList
          title="Двери/Проход"
          emptyText="Нет дверей"
          commentPlaceholder="Комментарий"
          openings={subSection.doors || []}
          onAdd={() => onAddDoor(subSection.id)}
          onRemove={(id) => onRemoveDoor(subSection.id, id)}
          onUpdate={(id, field, val) => onUpdateDoor(subSection.id, id, field, val)}
        />
      </div>

      {/* Section metrics */}
      <div className="pl-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
          <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 mb-1">Пол/Потолок</div>
            <div className="text-sm font-semibold text-gray-900">{subMetrics.area.toFixed(2)} м²</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 mb-1">Стены</div>
            <div className="text-sm font-semibold text-gray-900">{wallArea.toFixed(2)} м²</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 mb-1">Периметр/Плинтус</div>
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col items-center">
                <div className="text-sm font-semibold">{subMetrics.perimeter.toFixed(2)}</div>
                <div className="w-8 border-t border-gray-200 my-0.5"></div>
                <div className="text-sm font-semibold">{skirtingLength.toFixed(2)}</div>
              </div>
              <span className="text-xs text-gray-400">м</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="text-xs text-gray-500 mb-1">Объем</div>
            <div className="text-sm font-semibold text-gray-900">{volume.toFixed(2)} м³</div>
          </div>
        </div>
      </div>
    </div>
  );
});
