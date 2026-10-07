import type { RoomData } from '@shared/types';
import { createRoom, calculateSimpleMetrics, createTechnicalRoomWorks } from './factories';

// --- Мастерская ---
const workshopZoneMetrics = calculateSimpleMetrics(
  6.0,
  5.0,
  3.0,
  [{ width: 1.5, height: 1.5 }],
  [{ width: 1.0, height: 2.2 }],
);
const workshopStorageMetrics = calculateSimpleMetrics(
  3.5,
  3.0,
  3.0,
  [],
  [{ width: 0.9, height: 2.1 }],
);
const workshopCellarMetrics = calculateSimpleMetrics(
  3.0,
  2.5,
  2.2,
  [],
  [{ width: 0.8, height: 1.8 }],
);

export const workshopRooms: RoomData[] = [
  createRoom(
    'workshop-zone',
    'Рабочая зона',
    6.0,
    5.0,
    3.0,
    createTechnicalRoomWorks(workshopZoneMetrics),
    [{ id: 'w-workshop-1', width: 1.5, height: 1.5 }],
    [{ id: 'd-workshop-1', width: 1.0, height: 2.2 }],
  ),

  createRoom(
    'workshop-storage',
    'Подсобка',
    3.5,
    3.0,
    3.0,
    createTechnicalRoomWorks(workshopStorageMetrics),
    [],
    [{ id: 'd-workshop-2', width: 0.9, height: 2.1 }],
  ),

  createRoom(
    'workshop-cellar',
    'Погреб',
    3.0,
    2.5,
    2.2,
    createTechnicalRoomWorks(workshopCellarMetrics),
    [],
    [{ id: 'd-workshop-3', width: 0.8, height: 1.8 }],
  ),
];
