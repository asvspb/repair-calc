import type { RoomData } from '@shared/types';
import {
  createRoom,
  calculateSimpleMetrics,
  createResidentialRoomWorks,
  createBalconyWorks,
} from './factories';

// --- Дача ---
const dachaRoom1Metrics = calculateSimpleMetrics(
  4.5,
  3.0,
  2.5,
  [{ width: 1.4, height: 1.3 }],
  [{ width: 0.9, height: 2.0 }],
);
const dachaRoom2Metrics = calculateSimpleMetrics(
  4.5,
  3.0,
  2.5,
  [{ width: 1.4, height: 1.3 }],
  [{ width: 0.9, height: 2.0 }],
);
const dachaKitchenMetrics = calculateSimpleMetrics(
  4.0,
  2.5,
  2.5,
  [{ width: 1.2, height: 1.2 }],
  [{ width: 0.8, height: 2.0 }],
);
const dachaTerraceMetrics = calculateSimpleMetrics(4.0, 4.0, 2.5, [], []);

export const dachaRooms: RoomData[] = [
  createRoom(
    'dacha-room1',
    'Комната первый этаж',
    4.5,
    3.0,
    2.5,
    createResidentialRoomWorks(dachaRoom1Metrics),
    [{ id: 'w-dacha-1', width: 1.4, height: 1.3 }],
    [{ id: 'd-dacha-1', width: 0.9, height: 2.0 }],
  ),

  createRoom(
    'dacha-room2',
    'Комната второй этаж',
    4.5,
    3.0,
    2.5,
    createResidentialRoomWorks(dachaRoom2Metrics),
    [{ id: 'w-dacha-2', width: 1.4, height: 1.3 }],
    [{ id: 'd-dacha-2', width: 0.9, height: 2.0 }],
  ),

  createRoom(
    'dacha-kitchen',
    'Кухня',
    4.0,
    2.5,
    2.5,
    createResidentialRoomWorks(dachaKitchenMetrics),
    [{ id: 'w-dacha-3', width: 1.2, height: 1.2 }],
    [{ id: 'd-dacha-3', width: 0.8, height: 2.0 }],
  ),

  createRoom(
    'dacha-terrace',
    'Терраса',
    4.0,
    4.0,
    2.5,
    createBalconyWorks(dachaTerraceMetrics),
    [],
    [],
  ),
];
