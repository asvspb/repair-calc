import type { RoomData } from '@shared/types';
import { createRoom, calculateSimpleMetrics, createTechnicalRoomWorks } from './factories';

// --- Магазин ---
const shopSection1Metrics = calculateSimpleMetrics(
  8.0,
  5.0,
  3.0,
  [{ width: 2.0, height: 1.5 }],
  [{ width: 1.0, height: 2.2 }],
);
const shopSection2Metrics = calculateSimpleMetrics(
  8.0,
  5.0,
  3.0,
  [{ width: 2.0, height: 1.5 }],
  [{ width: 1.0, height: 2.2 }],
);

export const shopRooms: RoomData[] = [
  createRoom(
    'shop-section1',
    'Секция 1',
    8.0,
    5.0,
    3.0,
    createTechnicalRoomWorks(shopSection1Metrics),
    [{ id: 'w-shop-1', width: 2.0, height: 1.5 }],
    [{ id: 'd-shop-1', width: 1.0, height: 2.2 }],
  ),

  createRoom(
    'shop-section2',
    'Секция 2',
    8.0,
    5.0,
    3.0,
    createTechnicalRoomWorks(shopSection2Metrics),
    [{ id: 'w-shop-2', width: 2.0, height: 1.5 }],
    [{ id: 'd-shop-2', width: 1.0, height: 2.2 }],
  ),
];
