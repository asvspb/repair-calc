import type { RoomMetrics } from '../../types';
import type { RoomData, ProjectData, ObjectData, WorkData, Material, Tool } from '@shared/types';
import { WORK_TEMPLATES_CATALOG } from '../workTemplatesCatalog';
import { calculateMaterialQuantity } from '../../domain/pricing/materialCalculations';

/**
 * Создаёт WorkData из шаблона каталога с рассчитанными материалами
 */
export function createWorkFromTemplate(
  templateId: string,
  metrics: RoomMetrics,
  enabled: boolean = true,
  customCount?: number,
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
        const calculation = calculateMaterialQuantity(
          mat,
          metrics,
          customCount,
          template.calculationType,
        );
        calculatedQty = calculation.displayQty;
      } catch {
        // Игнорируем ошибки расчета, используем 0
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
export function calculateSimpleMetrics(
  length: number,
  width: number,
  height: number,
  windows: { width: number; height: number }[] = [],
  doors: { width: number; height: number }[] = [],
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
    volume,
  };
}

/**
 * Создаёт комнату с работами
 */
export function createRoom(
  id: string,
  name: string,
  length: number,
  width: number,
  height: number,
  works: WorkData[],
  windows: { id: string; width: number; height: number; comment?: string }[] = [],
  doors: { id: string; width: number; height: number; comment?: string }[] = [],
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
      doors,
    },
    extendedModeData: {
      subSections: [],
    },
    advancedModeData: {
      segments: [],
      obstacles: [],
      wallSections: [],
    },
  };
}

/**
 * Создаёт работы для жилой комнаты
 */
export function createResidentialRoomWorks(metrics: RoomMetrics): WorkData[] {
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
export function createBathroomWorks(metrics: RoomMetrics): WorkData[] {
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
export function createBalconyWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('tile-flooring', metrics, true),
    createWorkFromTemplate('paint-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
  ];
}

/**
 * Создаёт работы для технического помещения
 */
export function createTechnicalRoomWorks(metrics: RoomMetrics): WorkData[] {
  return [
    createWorkFromTemplate('screed-floor', metrics, true),
    createWorkFromTemplate('paint-walls', metrics, true),
    createWorkFromTemplate('paint-ceiling', metrics, true),
    createWorkFromTemplate('electrical', metrics, true, 2),
  ];
}

// ============================================
// ДЕМОНСТРАЦИОННЫЕ ОБЪЕКТЫ
// ============================================

/**
 * Создаёт демонстрационный объект
 */
export function createDemoObject(
  id: string,
  projectId: string,
  name: string,
  rooms: RoomData[],
  city?: string,
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
