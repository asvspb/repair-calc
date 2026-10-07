import type { RoomData } from '@shared/types';
import {
  createRoom,
  createWorkFromTemplate,
  calculateSimpleMetrics,
  createResidentialRoomWorks,
  createBathroomWorks,
  createBalconyWorks,
} from './factories';

// ============================================
// ДЕМОНСТРАЦИОННЫЕ КОМНАТЫ
// ============================================

// --- Дом ---
const houseKitchenMetrics = calculateSimpleMetrics(
  4.0,
  3.0,
  2.6,
  [{ width: 1.4, height: 1.4 }],
  [{ width: 0.8, height: 2.1 }],
);
const houseLivingRoomMetrics = calculateSimpleMetrics(
  5.0,
  4.0,
  2.6,
  [
    { width: 1.8, height: 1.5 },
    { width: 1.8, height: 1.5 },
  ],
  [{ width: 0.9, height: 2.1 }],
);
const houseBedroomMetrics = calculateSimpleMetrics(
  4.0,
  4.0,
  2.6,
  [{ width: 1.5, height: 1.4 }],
  [{ width: 0.9, height: 2.1 }],
);
const houseBathroomMetrics = calculateSimpleMetrics(
  3.0,
  2.0,
  2.6,
  [],
  [{ width: 0.7, height: 2.0 }],
);
const houseBalconyMetrics = calculateSimpleMetrics(
  2.0,
  2.0,
  2.6,
  [{ width: 1.5, height: 1.2 }],
  [],
);

export const houseRooms: RoomData[] = [
  createRoom(
    'house-kitchen',
    'Кухня',
    4.0,
    3.0,
    2.6,
    [
      createWorkFromTemplate('screed-floor', houseKitchenMetrics, true),
      createWorkFromTemplate('tile-flooring', houseKitchenMetrics, true),
      createWorkFromTemplate('tile-walls', houseKitchenMetrics, true), // фартук
      createWorkFromTemplate('paint-ceiling', houseKitchenMetrics, true),
      createWorkFromTemplate('install-door', houseKitchenMetrics, true, 1),
      createWorkFromTemplate('electrical', houseKitchenMetrics, true, 6),
    ],
    [{ id: 'w-house-1', width: 1.4, height: 1.4 }],
    [{ id: 'd-house-1', width: 0.8, height: 2.1 }],
  ),

  createRoom(
    'house-living',
    'Зал',
    5.0,
    4.0,
    2.6,
    createResidentialRoomWorks(houseLivingRoomMetrics),
    [
      { id: 'w-house-2', width: 1.8, height: 1.5 },
      { id: 'w-house-3', width: 1.8, height: 1.5 },
    ],
    [{ id: 'd-house-2', width: 0.9, height: 2.1 }],
  ),

  createRoom(
    'house-bedroom',
    'Спальня',
    4.0,
    4.0,
    2.6,
    createResidentialRoomWorks(houseBedroomMetrics),
    [{ id: 'w-house-4', width: 1.5, height: 1.4 }],
    [{ id: 'd-house-3', width: 0.9, height: 2.1 }],
  ),

  createRoom(
    'house-bathroom',
    'Ванная',
    3.0,
    2.0,
    2.6,
    createBathroomWorks(houseBathroomMetrics),
    [],
    [{ id: 'd-house-4', width: 0.7, height: 2.0 }],
  ),

  createRoom(
    'house-balcony',
    'Балкон',
    2.0,
    2.0,
    2.6,
    createBalconyWorks(houseBalconyMetrics),
    [{ id: 'w-house-5', width: 1.5, height: 1.2 }],
    [],
  ),
];
