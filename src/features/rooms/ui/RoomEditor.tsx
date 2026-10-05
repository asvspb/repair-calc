import React, { useMemo } from 'react';
import { RoomHeader } from './RoomHeader';
import { RoomMetricsSummary } from './RoomMetricsSummary';
import { GeometrySection } from './geometry';
import { useGeometryState } from '../model/useGeometryState';
import { calculateRoomMetrics } from '../../../domain/geometry/geometry';
import { calculateRoomCosts } from '../../../domain/pricing/costs';
import type { RoomMetrics, RoomCosts } from '../../../types';
import type { RoomData } from '@shared/types';
import { useProjectStore } from '../../../store/useProjectStore';

/**
 * Контекст, который RoomEditor передаёт works-слоту. Слот — ReactNode,
 * смонтированный на уровне app-композиции (ContentArea); RoomEditor сам
 * НЕ импортирует works-компоненты (FSD, R4 batch 031).
 */
export interface RoomWorksSlotContext {
  room: RoomData;
  city?: string;
  updateRoom: (r: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  metrics: RoomMetrics;
  costs: RoomCosts;
}

interface RoomEditorProps {
  room: RoomData;
  city?: string;
  updateRoom: (r: RoomData) => void;

  deleteRoom: () => void;
  /** Слот works-панели: рендерится родителем (app-слой) из контекста комнаты. */
  worksSlot?: (ctx: RoomWorksSlotContext) => React.ReactNode;
}

export function RoomEditor({ room, city, updateRoom, deleteRoom, worksSlot }: RoomEditorProps) {
  const updateRoomById = useProjectStore(s => s.updateRoomById);

  // Добавляем флаг монтирования для предотвращения hydration ошибок
  const normalizedRoom = useMemo(
    () => ({
      ...room,
      length: room.length ?? 0,
      width: room.width ?? 0,
      height: room.height ?? 0,
      segments: room.segments || [],
      obstacles: room.obstacles || [],
      wallSections: room.wallSections || [],
      subSections: room.subSections || [],
      windows: room.windows || [],
      doors: room.doors || [],
      works: room.works || [],
    }),
    [room],
  );

  const metrics = useMemo(() => calculateRoomMetrics(normalizedRoom), [normalizedRoom]);
  const { costs, total } = useMemo(() => calculateRoomCosts(normalizedRoom), [normalizedRoom]);

  const geometry = useGeometryState(room, updateRoom, updateRoomById);

  const segmentsDelta = (room.segments || []).reduce(
    (sum, s) => sum + s.length * s.width * (s.operation === 'add' ? 1 : -1),
    0,
  );
  const obstaclesDelta = (room.obstacles || []).reduce(
    (sum, o) => sum + o.area * (o.operation === 'add' ? 1 : -1),
    0,
  );

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <RoomHeader room={room} onUpdateRoom={updateRoom} onDelete={deleteRoom} />
      <RoomMetricsSummary metrics={metrics} total={total} />

      <GeometrySection
        room={room}
        updateRoom={updateRoom}
        updateRoomById={updateRoomById}
        isGeometryCollapsed={geometry.isGeometryCollapsed}
        isExtendedGeometryCollapsed={geometry.isExtendedGeometryCollapsed}
        subSectionsExpanded={geometry.subSectionsExpanded}
        toggleGeometryCollapse={geometry.toggleGeometryCollapse}
        toggleExtendedGeometryCollapse={geometry.toggleExtendedGeometryCollapse}
        toggleSubSectionsExpand={geometry.toggleSubSectionsExpand}
        handleGeometryModeChange={geometry.handleGeometryModeChange}
        updateSimpleField={geometry.updateSimpleField}
        addWindow={geometry.addWindow}
        removeWindow={geometry.removeWindow}
        updateWindow={geometry.updateWindow}
        addDoor={geometry.addDoor}
        removeDoor={geometry.removeDoor}
        updateDoor={geometry.updateDoor}
        addSubSection={geometry.addSubSection}
        removeSubSection={geometry.removeSubSection}
        updateSubSection={geometry.updateSubSection}
        updateSubSectionWindow={geometry.updateSubSectionWindow}
        addSubSectionWindow={geometry.addSubSectionWindow}
        removeSubSectionWindow={geometry.removeSubSectionWindow}
        updateSubSectionDoor={geometry.updateSubSectionDoor}
        addSubSectionDoor={geometry.addSubSectionDoor}
        removeSubSectionDoor={geometry.removeSubSectionDoor}
        addSegment={geometry.addSegment}
        removeSegment={geometry.removeSegment}
        updateSegment={geometry.updateSegment}
        addObstacle={geometry.addObstacle}
        removeObstacle={geometry.removeObstacle}
        updateObstacle={geometry.updateObstacle}
        addWallSection={geometry.addWallSection}
        removeWallSection={geometry.removeWallSection}
        updateWallSection={geometry.updateWallSection}
        segmentsDelta={segmentsDelta}
        obstaclesDelta={obstaclesDelta}
      />

      {worksSlot?.({ room, city, updateRoom, updateRoomById, metrics, costs })}
    </div>
  );
}
