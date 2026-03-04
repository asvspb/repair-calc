import type { WorkData, Material, Tool, RoomData, RoomMetrics, WorkCosts, RoomCosts } from '../types';
import { calculateRoomMetrics } from './geometry';

/**
 * Helper function to round cost up to nearest integer
 */
export function roundCostUp(cost: number): number {
  return Math.ceil(cost);
}

/**
 * Migrate work data for backward compatibility
 * Converts legacy materialPrice to new materials array format
 */
export function migrateWorkData(work: WorkData): WorkData {
  // Создаём копию, чтобы не мутировать оригинальный объект
  const migrated = { ...work };

  // Если materials/tools не существуют - инициализируем пустыми массивами
  if (!migrated.materials) {
    migrated.materials = [];
  }
  if (!migrated.tools) {
    migrated.tools = [];
  }

  // Если есть legacy materialPrice и нет материалов - создаём один материал
  if (migrated.materialPrice && migrated.materialPrice > 0 && migrated.materials.length === 0) {
    migrated.materials = [{
      id: Math.random().toString(36).substring(2, 11),
      name: 'Материалы',
      quantity: 1,
      unit: migrated.unit || 'м²',
      pricePerUnit: migrated.materialPrice
    }];
  }

  return migrated;
}

/**
 * Calculate work quantity based on calculation type and room metrics
 */
export function calculateWorkQuantity(work: WorkData, metrics: RoomMetrics): number {
  if (work.manualQty !== undefined) {
    return work.manualQty;
  }

  switch (work.calculationType) {
    case 'floorArea':
      return metrics.floorArea;
    case 'netWallArea':
      return metrics.netWallArea;
    case 'skirtingLength':
      return metrics.skirtingLength;
    case 'customCount':
      return work.count || 0;
    default:
      return 0;
  }
}

/**
 * Calculate material cost for a work
 */
function calculateMaterialCost(work: WorkData, qty: number): number {
  if (work.materials && work.materials.length > 0) {
    // Новый способ: сумма стоимости всех материалов
    return roundCostUp(work.materials.reduce((sum: number, m: Material) => sum + m.quantity * m.pricePerUnit, 0));
  } else if (work.materialPrice) {
    // Legacy: старый способ расчёта
    return roundCostUp(work.materialPriceType === 'per_unit' ? qty * work.materialPrice : work.materialPrice);
  }
  return 0;
}

/**
 * Calculate tools cost for a work
 */
function calculateToolsCost(tools: Tool[] | undefined): number {
  return roundCostUp((tools || []).reduce((sum: number, t: Tool) => {
    if (t.isRent && t.rentPeriod) {
      return sum + t.price * t.quantity * t.rentPeriod;
    }
    return sum + t.price * t.quantity;
  }, 0));
}

/**
 * Calculate costs for a single work item
 */
export function calculateWorkCosts(work: WorkData, metrics: RoomMetrics): WorkCosts {
  const migratedWork = migrateWorkData(work);

  if (!migratedWork.enabled) {
    return { work: 0, material: 0, tools: 0, total: 0 };
  }

  const qty = calculateWorkQuantity(migratedWork, metrics);

  // Стоимость работы
  const workCost = roundCostUp(qty * migratedWork.workUnitPrice);

  // Стоимость материалов
  const materialCost = calculateMaterialCost(migratedWork, qty);

  // Стоимость инструментов
  const toolsCost = calculateToolsCost(migratedWork.tools);

  return {
    work: workCost,
    material: materialCost,
    tools: toolsCost,
    total: workCost + materialCost + toolsCost
  };
}

/**
 * Calculate all costs for a room
 */
export function calculateRoomCosts(room: RoomData): RoomCosts {
  const metrics = calculateRoomMetrics(room);

  const costs: Record<string, WorkCosts> = {};
  let totalWork = 0;
  let totalMaterial = 0;
  let totalTools = 0;

  const works = room.works || [];
  works.forEach(work => {
    const workCosts = calculateWorkCosts(work, metrics);
    costs[work.id] = workCosts;
    totalWork += workCosts.work;
    totalMaterial += workCosts.material;
    totalTools += workCosts.tools;
  });

  return {
    costs,
    totalWork,
    totalMaterial,
    totalTools,
    total: totalWork + totalMaterial + totalTools
  };
}