/**
 * Демонстрационные данные — фасад.
 * Реализация распилена на модули ./demo/ (волна B1, batch 039):
 * factories (фабрики работ/комнат/объектов) + house/garage/dacha/shop/
 * warehouse/workshop (демо-комнаты по объектам). Сборка проектов — здесь,
 * чтобы граф импортов оставался однонаправленным (объекты → factories).
 */

import type { RoomData, ProjectData } from '@shared/types';
import { createDemoObject } from './demo/factories';
import { houseRooms } from './demo/house';
import { garageRooms } from './demo/garage';
import { dachaRooms } from './demo/dacha';
import { shopRooms } from './demo/shop';
import { warehouseRooms } from './demo/warehouse';
import { workshopRooms } from './demo/workshop';

/**
 * Создаёт демонстрационные проекты
 */
function createInitialProjects(): ProjectData[] {
  const project1Id = 'demo-real-estate';
  const project2Id = 'demo-work-projects';

  return [
    {
      id: project1Id,
      name: 'Моя недвижимость',
      objects: [
        createDemoObject('obj-house', project1Id, 'Дом', houseRooms, 'Подмосковье'),
        createDemoObject('obj-garage', project1Id, 'Гараж', garageRooms, 'Подмосковье'),
        createDemoObject('obj-dacha', project1Id, 'Дача', dachaRooms, 'Сельское поселение'),
      ],
    },
    {
      id: project2Id,
      name: 'Рабочие проекты',
      objects: [
        createDemoObject('obj-shop', project2Id, 'Магазин', shopRooms, 'Москва'),
        createDemoObject('obj-warehouse', project2Id, 'Склад', warehouseRooms, 'Москва'),
        createDemoObject('obj-workshop', project2Id, 'Мастерская', workshopRooms, 'Москва'),
      ],
    },
  ];
}

export const initialProjects: ProjectData[] = createInitialProjects();

// ============================================
// УСТАРЕВШИЕ ЭКСПОРТЫ (для обратной совместимости)
// ============================================

/**
 * @deprecated Используйте initialProjects[0].objects[0].rooms
 * Оставлен для обратной совместимости со старым кодом
 */
export const initialRooms: RoomData[] = houseRooms;
