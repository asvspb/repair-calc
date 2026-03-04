import type { RoomData, ProjectData } from '../types';

export const initialRooms: RoomData[] = [
  {
    id: '1',
    name: 'Комната 1',
    geometryMode: 'simple',
    length: 3.6,
    width: 2.9,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w1', width: 1.5, height: 1.5, comment: '' }],
    doors: [{ id: 'd1', width: 1.0, height: 2.2, comment: '' }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 2500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 3500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 800, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 4500, materialPriceType: 'total', materialPrice: 15000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 4000, count: 6, isCustom: true },
    ],
    simpleModeData: {
      length: 3.6,
      width: 2.9,
      windows: [{ id: 'w1', width: 1.5, height: 1.5, comment: '' }],
      doors: [{ id: 'd1', width: 1.0, height: 2.2, comment: '' }]
    },
    extendedModeData: {
      subSections: []
    },
    advancedModeData: {
      segments: [],
      obstacles: [],
      wallSections: []
    }
  },
  {
    id: '2',
    name: 'Комната 2',
    geometryMode: 'simple',
    length: 4.9,
    width: 3.6,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w2', width: 1.4, height: 2.1, comment: '' }],
    doors: [{ id: 'd2', width: 2.2, height: 2.5, comment: '' }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 1200, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 8000, materialPriceType: 'total', materialPrice: 35000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 6500, count: 10, isCustom: true },
    ],
    simpleModeData: {
      length: 4.9,
      width: 3.6,
      windows: [{ id: 'w2', width: 1.4, height: 2.1, comment: '' }],
      doors: [{ id: 'd2', width: 2.2, height: 2.5, comment: '' }]
    },
    extendedModeData: {
      subSections: []
    },
    advancedModeData: {
      segments: [],
      obstacles: [],
      wallSections: []
    }
  }
];

export const initialProjects: ProjectData[] = [
  {
    id: 'p1',
    name: 'Квартира (пример)',
    rooms: initialRooms
  }
];