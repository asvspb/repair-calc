import type { RoomData } from '@shared/types';
import {
  createRoom,
  createWorkFromTemplate,
  calculateSimpleMetrics,
  createTechnicalRoomWorks,
} from './factories';

// --- Гараж ---
const garageUpperMetrics = calculateSimpleMetrics(
  6.0,
  3.0,
  2.5,
  [{ width: 2.5, height: 2.2 }],
  [{ width: 3.0, height: 2.2 }],
);
const garageLowerMetrics = calculateSimpleMetrics(6.0, 3.0, 2.0, [], []);

export const garageRooms: RoomData[] = [
  createRoom(
    'garage-upper',
    'Верхняя часть',
    6.0,
    3.0,
    2.5,
    [
      createWorkFromTemplate('screed-floor', garageUpperMetrics, true),
      createWorkFromTemplate('paint-walls', garageUpperMetrics, true),
      createWorkFromTemplate('paint-ceiling', garageUpperMetrics, true),
      createWorkFromTemplate('electrical', garageUpperMetrics, true, 4),
    ],
    [{ id: 'w-garage-1', width: 2.5, height: 2.2 }],
    [{ id: 'd-garage-1', width: 3.0, height: 2.2 }],
  ),

  createRoom(
    'garage-lower',
    'Нижняя часть',
    6.0,
    3.0,
    2.0,
    createTechnicalRoomWorks(garageLowerMetrics),
    [],
    [],
  ),
];
