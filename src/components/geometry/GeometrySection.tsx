import React from 'react';
import { ChevronUp, AlertCircle } from 'lucide-react';
import type { RoomData, Opening, WallSection, RoomSubSection, GeometryMode } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { ModeSelector } from './ModeSelector';
import { SimpleGeometry } from './SimpleGeometry';
import { ExtendedGeometry } from './ExtendedGeometry';
import { AdvancedGeometry } from './AdvancedGeometry';

interface GeometrySectionProps {
  room: RoomData;
  updateRoom: (r: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  // UI State
  isGeometryCollapsed: boolean;
  isExtendedGeometryCollapsed: boolean;
  subSectionsExpanded: boolean;
  // UI Handlers
  toggleGeometryCollapse: () => void;
  toggleExtendedGeometryCollapse: () => void;
  toggleSubSectionsExpand: () => void;
  // Mode switching
  handleGeometryModeChange: (mode: GeometryMode) => void;
  // Simple mode handlers
  updateSimpleField: (field: 'length' | 'width', val: number) => void;
  addWindow: () => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, field: keyof Opening, val: number | string) => void;
  addDoor: () => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, field: keyof Opening, val: number | string) => void;
  // Extended mode handlers
  addSubSection: () => void;
  removeSubSection: (id: string) => void;
  updateSubSection: (id: string, field: keyof RoomSubSection, val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[]) => void;
  updateSubSectionWindow: (subSectionId: string, windowId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionWindow: (subSectionId: string) => void;
  removeSubSectionWindow: (subSectionId: string, windowId: string) => void;
  updateSubSectionDoor: (subSectionId: string, doorId: string, field: keyof Opening, val: number | string) => void;
  addSubSectionDoor: (subSectionId: string) => void;
  removeSubSectionDoor: (subSectionId: string, doorId: string) => void;
  // Advanced mode handlers
  addSegment: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, field: keyof import('../../types').RoomSegment, val: string | number) => void;
  addObstacle: () => void;
  removeObstacle: (id: string) => void;
  updateObstacle: (id: string, field: keyof import('../../types').Obstacle, val: string | number) => void;
  addWallSection: () => void;
  removeWallSection: (id: string) => void;
  updateWallSection: (id: string, field: keyof import('../../types').WallSection, val: string | number) => void;
  // Advanced mode calculations
  segmentsDelta: number;
  obstaclesDelta: number;
}

export function GeometrySection({
  room,
  updateRoom,
  updateRoomById,
  isGeometryCollapsed,
  isExtendedGeometryCollapsed,
  subSectionsExpanded,
  toggleGeometryCollapse,
  toggleExtendedGeometryCollapse,
  toggleSubSectionsExpand,
  handleGeometryModeChange,
  updateSimpleField,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
  addSubSection,
  removeSubSection,
  updateSubSection,
  updateSubSectionWindow,
  addSubSectionWindow,
  removeSubSectionWindow,
  updateSubSectionDoor,
  addSubSectionDoor,
  removeSubSectionDoor,
  addSegment,
  removeSegment,
  updateSegment,
  addObstacle,
  removeObstacle,
  updateObstacle,
  addWallSection,
  removeWallSection,
  updateWallSection,
  segmentsDelta,
  obstaclesDelta,
}: GeometrySectionProps) {
  const normalizedRoom = {
    ...room,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div
            onClick={() => {
              if (room.geometryMode === 'simple') toggleGeometryCollapse();
              else if (room.geometryMode === 'extended') toggleExtendedGeometryCollapse();
              else toggleGeometryCollapse();
            }}
            className="flex items-center gap-4 cursor-pointer"
            title={
              (room.geometryMode === 'simple' && isGeometryCollapsed) ||
              (room.geometryMode === 'extended' && isExtendedGeometryCollapsed) ||
              (room.geometryMode === 'advanced' && isGeometryCollapsed)
                ? 'Развернуть'
                : 'Свернуть'
            }
          >
            <h3 className="text-lg font-medium">Габариты помещения</h3>
            <ChevronUp
              className={`w-5 h-5 text-gray-400 transition-transform ${
                (room.geometryMode === 'simple' && isGeometryCollapsed) ||
                (room.geometryMode === 'extended' && isExtendedGeometryCollapsed) ||
                (room.geometryMode === 'advanced' && isGeometryCollapsed)
                  ? 'rotate-180'
                  : ''
              }`}
            />
          </div>
        </div>
        <ModeSelector currentMode={room.geometryMode} onModeChange={handleGeometryModeChange} />
      </div>

      {/* Mode descriptions */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        {room.geometryMode === 'simple' && (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Простой режим:</span> одна прямоугольная комната с окнами и дверями.
          </p>
        )}
        {room.geometryMode === 'extended' && (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Расширенный режим:</span> несколько прямоугольных секций (например, L-образная комната). Каждая секция имеет свои проёмы.
          </p>
        )}
        {room.geometryMode === 'advanced' && (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Профессиональный режим:</span> сегменты, препятствия, перепады высоты стен — для помещений сложной формы.
          </p>
        )}
      </div>

      {/* Warning about existing data */}
      {normalizedRoom.geometryMode === 'simple' &&
        (normalizedRoom.segments.length +
          normalizedRoom.obstacles.length +
          normalizedRoom.wallSections.length +
          normalizedRoom.subSections.length >
          0) && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            Есть данные в других режимах. Переключение в простой режим сохранит их, но они не будут учитываться в расчетах.
          </p>
        </div>
      )}

      {normalizedRoom.geometryMode === 'extended' &&
        (normalizedRoom.segments.length +
          normalizedRoom.obstacles.length +
          normalizedRoom.wallSections.length >
          0) && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            Есть данные в профессиональном режиме. При переключении они сохранятся, но не будут использоваться.
          </p>
        </div>
      )}

      {/* Height is always visible when not collapsed */}
      {((room.geometryMode === 'simple' || room.geometryMode === 'advanced') &&
        !isGeometryCollapsed) ||
      (room.geometryMode === 'extended' && !isExtendedGeometryCollapsed) ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {room.geometryMode !== 'extended' && (
              <>
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
              </>
            )}
            {room.geometryMode === 'extended' && (
              <>
                <div className="sm:col-span-2 text-sm text-gray-500 italic flex items-end pb-2">
                  Размеры секций указаны ниже
                </div>
              </>
            )}
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

          {/* Simple mode geometry */}
          {room.geometryMode === 'simple' && (
            <SimpleGeometry
              room={room}
              isCollapsed={isGeometryCollapsed}
              addWindow={addWindow}
              removeWindow={removeWindow}
              updateWindow={updateWindow}
              addDoor={addDoor}
              removeDoor={removeDoor}
              updateDoor={updateDoor}
            />
          )}

          {/* Extended mode geometry */}
          {room.geometryMode === 'extended' && (
            <ExtendedGeometry
              room={room}
              isCollapsed={isExtendedGeometryCollapsed}
              subSectionsExpanded={subSectionsExpanded}
              onToggleExpand={toggleSubSectionsExpand}
              addSubSection={addSubSection}
              removeSubSection={removeSubSection}
              updateSubSection={updateSubSection}
              updateSubSectionWindow={updateSubSectionWindow}
              addSubSectionWindow={addSubSectionWindow}
              removeSubSectionWindow={removeSubSectionWindow}
              updateSubSectionDoor={updateSubSectionDoor}
              addSubSectionDoor={addSubSectionDoor}
              removeSubSectionDoor={removeSubSectionDoor}
            />
          )}

          {/* Advanced mode geometry */}
          {room.geometryMode === 'advanced' && (
            <AdvancedGeometry
              room={room}
              segmentsDelta={segmentsDelta}
              obstaclesDelta={obstaclesDelta}
              addSegment={addSegment}
              removeSegment={removeSegment}
              updateSegment={updateSegment}
              addObstacle={addObstacle}
              removeObstacle={removeObstacle}
              updateObstacle={updateObstacle}
              addWallSection={addWallSection}
              removeWallSection={removeWallSection}
              updateWallSection={updateWallSection}
              addWindow={addWindow}
              removeWindow={removeWindow}
              updateWindow={updateWindow}
              addDoor={addDoor}
              removeDoor={removeDoor}
              updateDoor={updateDoor}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
