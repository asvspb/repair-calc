import type { RoomData } from '@shared/types';
import { createRoom, calculateSimpleMetrics, createTechnicalRoomWorks } from './factories';

// --- Склад ---
const warehouseRoom1Metrics = calculateSimpleMetrics(
  10.0,
  5.0,
  3.5,
  [],
  [{ width: 1.2, height: 2.5 }],
);
const warehouseRoom2Metrics = calculateSimpleMetrics(
  10.0,
  5.0,
  3.5,
  [],
  [{ width: 1.2, height: 2.5 }],
);

export const warehouseRooms: RoomData[] = [
  createRoom(
    'warehouse-room1',
    'Помещение 1',
    10.0,
    5.0,
    3.5,
    createTechnicalRoomWorks(warehouseRoom1Metrics),
    [],
    [{ id: 'd-warehouse-1', width: 1.2, height: 2.5 }],
  ),

  createRoom(
    'warehouse-room2',
    'Помещение 2',
    10.0,
    5.0,
    3.5,
    createTechnicalRoomWorks(warehouseRoom2Metrics),
    [],
    [{ id: 'd-warehouse-2', width: 1.2, height: 2.5 }],
  ),
];
