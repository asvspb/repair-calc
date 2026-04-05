import type { RoomData, ProjectData, ObjectData, WorkData, Material, Tool, RoomMetrics } from '../types';
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
  windows: { width: number; height: number }[] = [],
  doors: { width: number; height: number }[] = []
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

/**
 * Создаёт комнату с работами
 */
function createRoom(
  id: string,
  name: string,
  length: number,
  width: number,
  height: number,
  works: WorkData[],
  windows: { id: string; width: number; height: number; comment?: string }[] = [],
  doors: { id: string; width: number; height: number; comment?: string }[] = []
): RoomData {
  return {
    id,
    name,
    geometryMode: 'simple',
    length,
    width,
    height,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows,
    doors,
    works,
    simpleModeData: {
      length,
      width,
      windows,
      doors
    },
    extendedModeData: {
      subSections: []
    },
    advancedModeData: {
      segments: [],
      obstacles: [],
      wallSections: []
    }
  };
}

/**
 * Создаёт работы для жилой комнаты
 */
function createResidentialRoomWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('screed-floor', metrics, true),
    createWorkFromTemplate('laminate-flooring', metrics, true),
    createWorkFromTemplate('wallpaper-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
    createWorkFromTemplate('install-door', metrics, true, 1),
    createWorkFromTemplate('electrical', metrics, true, 4),
  ];
}

/**
 * Создаёт работы для ванной
 */
function createBathroomWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('screed-floor', metrics, true),
    createWorkFromTemplate('tile-flooring', metrics, true),
    createWorkFromTemplate('tile-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
    createWorkFromTemplate('install-door', metrics, true, 1),
    createWorkFromTemplate('electrical', metrics, true, 4),
    createWorkFromTemplate('plumbing', metrics, true, 3),
  ];
}

/**
 * Создаёт работы для балкона/террасы
 */
function createBalconyWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('tile-flooring', metrics, true),
    createWorkFromTemplate('paint-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
  ];
}

/**
 * Создаёт работы для технического помещения
 */
function createTechnicalRoomWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('screed-floor', metrics, true),
    createWorkFromTemplate('paint-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
    createWorkFromTemplate('electrical', metrics, true, 2),
  ];
}

// ============================================
// ДЕМОНСТРАЦИОННЫЕ КОМНАТЫ
// ============================================

// --- Дом ---
const houseKitchenMetrics = calculateSimpleMetrics(4.0, 3.0, 2.6, [{ width: 1.4, height: 1.4 }], [{ width: 0.8, height: 2.1 }]);
const houseLivingRoomMetrics = calculateSimpleMetrics(5.0, 4.0, 2.6, [{ width: 1.8, height: 1.5 }, { width: 1.8, height: 1.5 }], [{ width: 0.9, height: 2.1 }]);
const houseBedroomMetrics = calculateSimpleMetrics(4.0, 4.0, 2.6, [{ width: 1.5, height: 1.4 }], [{ width: 0.9, height: 2.1 }]);
const houseBathroomMetrics = calculateSimpleMetrics(3.0, 2.0, 2.6, [], [{ width: 0.7, height: 2.0 }]);
const houseBalconyMetrics = calculateSimpleMetrics(2.0, 2.0, 2.6, [{ width: 1.5, height: 1.2 }], []);

const houseRooms: RoomData[] = [
  createRoom('house-kitchen', 'Кухня', 4.0, 3.0, 2.6, [
    createWorkFromTemplate('screed-floor', houseKitchenMetrics, true),
    createWorkFromTemplate('tile-flooring', houseKitchenMetrics, true),
    createWorkFromTemplate('tile-walls', houseKitchenMetrics, true), // фартук
    createWorkFromTemplate('paint-ceiling', houseKitchenMetrics, true),
    createWorkFromTemplate('install-door', houseKitchenMetrics, true, 1),
    createWorkFromTemplate('electrical', houseKitchenMetrics, true, 6),
  ], [{ id: 'w-house-1', width: 1.4, height: 1.4 }], [{ id: 'd-house-1', width: 0.8, height: 2.1 }]),
  
  createRoom('house-living', 'Зал', 5.0, 4.0, 2.6, createResidentialRoomWorks(houseLivingRoomMetrics),
    [{ id: 'w-house-2', width: 1.8, height: 1.5 }, { id: 'w-house-3', width: 1.8, height: 1.5 }],
    [{ id: 'd-house-2', width: 0.9, height: 2.1 }]),
  
  createRoom('house-bedroom', 'Спальня', 4.0, 4.0, 2.6, createResidentialRoomWorks(houseBedroomMetrics),
    [{ id: 'w-house-4', width: 1.5, height: 1.4 }], [{ id: 'd-house-3', width: 0.9, height: 2.1 }]),
  
  createRoom('house-bathroom', 'Ванная', 3.0, 2.0, 2.6, createBathroomWorks(houseBathroomMetrics),
    [], [{ id: 'd-house-4', width: 0.7, height: 2.0 }]),
  
  createRoom('house-balcony', 'Балкон', 2.0, 2.0, 2.6, createBalconyWorks(houseBalconyMetrics),
    [{ id: 'w-house-5', width: 1.5, height: 1.2 }], []),
];

// --- Гараж ---
const garageUpperMetrics = calculateSimpleMetrics(6.0, 3.0, 2.5, [{ width: 2.5, height: 2.2 }], [{ width: 3.0, height: 2.2 }]);
const garageLowerMetrics = calculateSimpleMetrics(6.0, 3.0, 2.0, [], []);

const garageRooms: RoomData[] = [
  createRoom('garage-upper', 'Верхняя часть', 6.0, 3.0, 2.5, [
    createWorkFromTemplate('screed-floor', garageUpperMetrics, true),
    createWorkFromTemplate('paint-walls', garageUpperMetrics, true),
    createWorkFromTemplate('paint-ceiling', garageUpperMetrics, true),
    createWorkFromTemplate('electrical', garageUpperMetrics, true, 4),
  ], [{ id: 'w-garage-1', width: 2.5, height: 2.2 }], [{ id: 'd-garage-1', width: 3.0, height: 2.2 }]),
  
  createRoom('garage-lower', 'Нижняя часть', 6.0, 3.0, 2.0, createTechnicalRoomWorks(garageLowerMetrics), [], []),
];

// --- Дача ---
const dachaRoom1Metrics = calculateSimpleMetrics(4.5, 3.0, 2.5, [{ width: 1.4, height: 1.3 }], [{ width: 0.9, height: 2.0 }]);
const dachaRoom2Metrics = calculateSimpleMetrics(4.5, 3.0, 2.5, [{ width: 1.4, height: 1.3 }], [{ width: 0.9, height: 2.0 }]);
const dachaKitchenMetrics = calculateSimpleMetrics(4.0, 2.5, 2.5, [{ width: 1.2, height: 1.2 }], [{ width: 0.8, height: 2.0 }]);
const dachaTerraceMetrics = calculateSimpleMetrics(4.0, 4.0, 2.5, [], []);

const dachaRooms: RoomData[] = [
  createRoom('dacha-room1', 'Комната первый этаж', 4.5, 3.0, 2.5, createResidentialRoomWorks(dachaRoom1Metrics),
    [{ id: 'w-dacha-1', width: 1.4, height: 1.3 }], [{ id: 'd-dacha-1', width: 0.9, height: 2.0 }]),
  
  createRoom('dacha-room2', 'Комната второй этаж', 4.5, 3.0, 2.5, createResidentialRoomWorks(dachaRoom2Metrics),
    [{ id: 'w-dacha-2', width: 1.4, height: 1.3 }], [{ id: 'd-dacha-2', width: 0.9, height: 2.0 }]),
  
  createRoom('dacha-kitchen', 'Кухня', 4.0, 2.5, 2.5, createResidentialRoomWorks(dachaKitchenMetrics),
    [{ id: 'w-dacha-3', width: 1.2, height: 1.2 }], [{ id: 'd-dacha-3', width: 0.8, height: 2.0 }]),
  
  createRoom('dacha-terrace', 'Терраса', 4.0, 4.0, 2.5, createBalconyWorks(dachaTerraceMetrics), [], []),
];

// --- Магазин ---
const shopSection1Metrics = calculateSimpleMetrics(8.0, 5.0, 3.0, [{ width: 2.0, height: 1.5 }], [{ width: 1.0, height: 2.2 }]);
const shopSection2Metrics = calculateSimpleMetrics(8.0, 5.0, 3.0, [{ width: 2.0, height: 1.5 }], [{ width: 1.0, height: 2.2 }]);

const shopRooms: RoomData[] = [
  createRoom('shop-section1', 'Секция 1', 8.0, 5.0, 3.0, createTechnicalRoomWorks(shopSection1Metrics),
    [{ id: 'w-shop-1', width: 2.0, height: 1.5 }], [{ id: 'd-shop-1', width: 1.0, height: 2.2 }]),
  
  createRoom('shop-section2', 'Секция 2', 8.0, 5.0, 3.0, createTechnicalRoomWorks(shopSection2Metrics),
    [{ id: 'w-shop-2', width: 2.0, height: 1.5 }], [{ id: 'd-shop-2', width: 1.0, height: 2.2 }]),
];

// --- Склад ---
const warehouseRoom1Metrics = calculateSimpleMetrics(10.0, 5.0, 3.5, [], [{ width: 1.2, height: 2.5 }]);
const warehouseRoom2Metrics = calculateSimpleMetrics(10.0, 5.0, 3.5, [], [{ width: 1.2, height: 2.5 }]);

const warehouseRooms: RoomData[] = [
  createRoom('warehouse-room1', 'Помещение 1', 10.0, 5.0, 3.5, createTechnicalRoomWorks(warehouseRoom1Metrics),
    [], [{ id: 'd-warehouse-1', width: 1.2, height: 2.5 }]),
  
  createRoom('warehouse-room2', 'Помещение 2', 10.0, 5.0, 3.5, createTechnicalRoomWorks(warehouseRoom2Metrics),
    [], [{ id: 'd-warehouse-2', width: 1.2, height: 2.5 }]),
];

// --- Мастерская ---
const workshopZoneMetrics = calculateSimpleMetrics(6.0, 5.0, 3.0, [{ width: 1.5, height: 1.5 }], [{ width: 1.0, height: 2.2 }]);
const workshopStorageMetrics = calculateSimpleMetrics(3.5, 3.0, 3.0, [], [{ width: 0.9, height: 2.1 }]);
const workshopCellarMetrics = calculateSimpleMetrics(3.0, 2.5, 2.2, [], [{ width: 0.8, height: 1.8 }]);

const workshopRooms: RoomData[] = [
  createRoom('workshop-zone', 'Рабочая зона', 6.0, 5.0, 3.0, createTechnicalRoomWorks(workshopZoneMetrics),
    [{ id: 'w-workshop-1', width: 1.5, height: 1.5 }], [{ id: 'd-workshop-1', width: 1.0, height: 2.2 }]),
  
  createRoom('workshop-storage', 'Подсобка', 3.5, 3.0, 3.0, createTechnicalRoomWorks(workshopStorageMetrics),
    [], [{ id: 'd-workshop-2', width: 0.9, height: 2.1 }]),
  
  createRoom('workshop-cellar', 'Погреб', 3.0, 2.5, 2.2, createTechnicalRoomWorks(workshopCellarMetrics),
    [], [{ id: 'd-workshop-3', width: 0.8, height: 1.8 }]),
];

// ============================================
// ДЕМОНСТРАЦИОННЫЕ ОБЪЕКТЫ
// ============================================

/**
 * Создаёт демонстрационный объект
 */
function createDemoObject(
  id: string,
  projectId: string,
  name: string,
  rooms: RoomData[],
  city?: string
): ObjectData {
  return {
    id,
    projectId,
    name,
    city,
    rooms,
    sortOrder: 0,
  };
}

// ============================================
// ДЕМОНСТРАЦИОННЫЕ ПРОЕКТЫ
// ============================================

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