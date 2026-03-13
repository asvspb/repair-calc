import type { RoomData, ProjectData, WorkData, Material, Tool } from '../types';
import { WORK_TEMPLATES_CATALOG } from './workTemplatesCatalog';

/**
 * Создаёт WorkData из шаблона каталога
 */
function createWorkFromTemplate(
  templateId: string,
  enabled: boolean = true,
  customCount?: number
): WorkData {
  const template = WORK_TEMPLATES_CATALOG.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Преобразуем материалы из шаблона
  const materials: Material[] = template.materials.map(mat => ({
    id: mat.id,
    name: mat.name,
    unit: mat.unit,
    quantity: 0,
    pricePerUnit: mat.defaultPrice || 0,
    coveragePerUnit: mat.coveragePerUnit,
    consumptionRate: mat.consumptionRate,
    layers: mat.layers,
    piecesPerUnit: mat.piecesPerUnit,
    wastePercent: mat.wastePercent,
    packageSize: mat.packageSize,
    isPerimeter: mat.isPerimeter,
    multiplier: mat.multiplier,
    calculatedQty: 0,
    autoCalcEnabled: true,
  }));

  // Преобразуем инструменты из шаблона
  const tools: Tool[] = template.tools.map(tool => ({
    id: tool.id,
    name: tool.name,
    quantity: 1,
    price: tool.defaultPrice || 0,
    isRent: tool.isRentDefault,
    rentPeriod: tool.defaultRentPeriod,
  }));

  return {
    id: templateId,
    name: template.name,
    unit: template.unit,
    enabled,
    workUnitPrice: template.defaultWorkPrice || 0,
    calculationType: template.calculationType,
    isCustom: false,
    materials,
    tools,
    count: customCount,
  };
}

/**
 * Демонстрационные комнаты с работами из каталога шаблонов
 */
export const initialRooms: RoomData[] = [
  {
    id: '1',
    name: 'Спальня',
    geometryMode: 'simple',
    length: 4.0,
    width: 3.5,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w1', width: 1.5, height: 1.4, comment: '' }],
    doors: [{ id: 'd1', width: 0.9, height: 2.1, comment: '' }],
    works: [
      createWorkFromTemplate('screed-floor', true),        // Заливка стяжки
      createWorkFromTemplate('laminate-flooring', true),   // Укладка ламината
      createWorkFromTemplate('wallpaper-walls', true),     // Поклейка обоев
      createWorkFromTemplate('paint-ceiling', true),       // Покраска потолка
      createWorkFromTemplate('install-door', true, 1),     // Установка двери
      createWorkFromTemplate('electrical', true, 4),       // Электрика
    ],
    simpleModeData: {
      length: 4.0,
      width: 3.5,
      windows: [{ id: 'w1', width: 1.5, height: 1.4, comment: '' }],
      doors: [{ id: 'd1', width: 0.9, height: 2.1, comment: '' }]
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
    name: 'Гостиная',
    geometryMode: 'simple',
    length: 5.2,
    width: 4.0,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [
      { id: 'w2', width: 1.8, height: 1.5, comment: '' },
      { id: 'w3', width: 1.8, height: 1.5, comment: '' }
    ],
    doors: [{ id: 'd2', width: 0.9, height: 2.1, comment: '' }],
    works: [
      createWorkFromTemplate('screed-floor', true),        // Заливка стяжки
      createWorkFromTemplate('laminate-flooring', true),   // Укладка ламината
      createWorkFromTemplate('wallpaper-walls', true),     // Поклейка обоев
      createWorkFromTemplate('stretch-ceiling', true),     // Натяжной потолок
      createWorkFromTemplate('install-door', true, 1),     // Установка двери
      createWorkFromTemplate('electrical', true, 6),       // Электрика
    ],
    simpleModeData: {
      length: 5.2,
      width: 4.0,
      windows: [
        { id: 'w2', width: 1.8, height: 1.5, comment: '' },
        { id: 'w3', width: 1.8, height: 1.5, comment: '' }
      ],
      doors: [{ id: 'd2', width: 0.9, height: 2.1, comment: '' }]
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
    id: '3',
    name: 'Кухня',
    geometryMode: 'simple',
    length: 3.5,
    width: 3.0,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w4', width: 1.4, height: 1.4, comment: '' }],
    doors: [{ id: 'd3', width: 0.8, height: 2.1, comment: '' }],
    works: [
      createWorkFromTemplate('screed-floor', true),        // Заливка стяжки
      createWorkFromTemplate('tile-flooring', true),       // Укладка плитки (пол)
      createWorkFromTemplate('tile-walls', true),          // Укладка плитки (стены) - фартук
      createWorkFromTemplate('paint-ceiling', true),       // Покраска потолка
      createWorkFromTemplate('install-door', true, 1),     // Установка двери
      createWorkFromTemplate('electrical', true, 8),       // Электрика
    ],
    simpleModeData: {
      length: 3.5,
      width: 3.0,
      windows: [{ id: 'w4', width: 1.4, height: 1.4, comment: '' }],
      doors: [{ id: 'd3', width: 0.8, height: 2.1, comment: '' }]
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