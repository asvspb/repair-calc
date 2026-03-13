import type { RoomData, ProjectData, WorkData, Material, Tool, RoomMetrics } from '../types';
import { WORK_TEMPLATES_CATALOG } from './workTemplatesCatalog';
import { calculateMaterialQuantity } from '../utils/materialCalculations';

/**
 * Создаёт WorkData из шаблона каталога с рассчитанными материалами
 */
function createWorkFromTemplate(
  templateId: string,
  metrics: RoomMetrics,
  enabled: boolean = true,
  customCount?: number
): WorkData {
  const template = WORK_TEMPLATES_CATALOG.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Преобразуем материалы из шаблона с расчётом количества
  const materials: Material[] = (template.materials || [])
    .filter((mat): mat is NonNullable<typeof mat> => mat != null)
    .map(mat => {
      // Вычисляем количество материала на основе метрик
      let calculatedQty = 0;
      try {
        const calculation = calculateMaterialQuantity(mat, metrics, customCount, template.calculationType);
        calculatedQty = calculation.displayQty;
      } catch {
        // Если не удалось рассчитать, оставляем 0
        calculatedQty = 0;
      }

      return {
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        quantity: calculatedQty,
        pricePerUnit: mat.defaultPrice || 0,
        coveragePerUnit: mat.coveragePerUnit,
        consumptionRate: mat.consumptionRate,
        layers: mat.layers,
        piecesPerUnit: mat.piecesPerUnit,
        wastePercent: mat.wastePercent,
        packageSize: mat.packageSize,
        isPerimeter: mat.isPerimeter,
        multiplier: mat.multiplier,
        calculatedQty,
        autoCalcEnabled: true,
      };
    });

  // Преобразуем инструменты из шаблона (фильтруем undefined)
  const tools: Tool[] = (template.tools || [])
    .filter((tool): tool is NonNullable<typeof tool> => tool != null)
    .map(tool => ({
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
 * Вычисляет метрики комнаты для простого режима
 */
function calculateSimpleMetrics(
  length: number,
  width: number,
  height: number,
  windows: { width: number; height: number }[],
  doors: { width: number; height: number }[]
): RoomMetrics {
  const floorArea = length * width;
  const perimeter = (length + width) * 2;
  const grossWallArea = perimeter * height;
  const windowsArea = windows.reduce((sum, w) => sum + w.width * w.height, 0);
  const doorsArea = doors.reduce((sum, d) => sum + d.width * d.height, 0);
  const doorsWidth = doors.reduce((sum, d) => sum + d.width, 0);
  const netWallArea = Math.max(0, grossWallArea - windowsArea - doorsArea);
  const skirtingLength = Math.max(0, perimeter - doorsWidth);
  const volume = floorArea * height;

  return {
    floorArea,
    perimeter,
    grossWallArea,
    windowsArea,
    doorsArea,
    netWallArea,
    skirtingLength,
    volume
  };
}

// Метрики для демонстрационных комнат (рассчитываются один раз при инициализации)
const bedroomMetrics = calculateSimpleMetrics(
  4.0, 3.5, 2.6,
  [{ width: 1.5, height: 1.4 }],
  [{ width: 0.9, height: 2.1 }]
);

const livingRoomMetrics = calculateSimpleMetrics(
  5.2, 4.0, 2.6,
  [{ width: 1.8, height: 1.5 }, { width: 1.8, height: 1.5 }],
  [{ width: 0.9, height: 2.1 }]
);

const kitchenMetrics = calculateSimpleMetrics(
  3.5, 3.0, 2.6,
  [{ width: 1.4, height: 1.4 }],
  [{ width: 0.8, height: 2.1 }]
);

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
      createWorkFromTemplate('screed-floor', bedroomMetrics, true),        // Заливка стяжки
      createWorkFromTemplate('laminate-flooring', bedroomMetrics, true),   // Укладка ламината
      createWorkFromTemplate('wallpaper-walls', bedroomMetrics, true),     // Поклейка обоев
      createWorkFromTemplate('paint-ceiling', bedroomMetrics, true),       // Покраска потолка
      createWorkFromTemplate('install-door', bedroomMetrics, true, 1),     // Установка двери
      createWorkFromTemplate('electrical', bedroomMetrics, true, 4),       // Электрика
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
      createWorkFromTemplate('screed-floor', livingRoomMetrics, true),        // Заливка стяжки
      createWorkFromTemplate('laminate-flooring', livingRoomMetrics, true),   // Укладка ламината
      createWorkFromTemplate('wallpaper-walls', livingRoomMetrics, true),     // Поклейка обоев
      createWorkFromTemplate('stretch-ceiling', livingRoomMetrics, true),     // Натяжной потолок
      createWorkFromTemplate('install-door', livingRoomMetrics, true, 1),     // Установка двери
      createWorkFromTemplate('electrical', livingRoomMetrics, true, 6),       // Электрика
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
      createWorkFromTemplate('screed-floor', kitchenMetrics, true),        // Заливка стяжки
      createWorkFromTemplate('tile-flooring', kitchenMetrics, true),       // Укладка плитки (пол)
      createWorkFromTemplate('tile-walls', kitchenMetrics, true),          // Укладка плитки (стены) - фартук
      createWorkFromTemplate('paint-ceiling', kitchenMetrics, true),       // Покраска потолка
      createWorkFromTemplate('install-door', kitchenMetrics, true, 1),     // Установка двери
      createWorkFromTemplate('electrical', kitchenMetrics, true, 8),       // Электрика
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
    city: 'Москва',
    rooms: initialRooms
  }
];
