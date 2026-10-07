/**
 * Общие парсеры списков works/materials/tools для AI-провайдеров
 * (тела перенесены байт-в-байт из Gemini/Mistral провайдеров, TASK-BATCH-041)
 */
import type { RecommendedWork, RecommendedMaterial, RecommendedTool } from './types.js';

/**
 * Парсинг списка работ
 */
export function parseWorks(works: unknown): RecommendedWork[] {
  if (!Array.isArray(works)) return [];

  return works.map((w: unknown) => {
    const work = w as Record<string, unknown>;
    return {
      name: String(work.name || ''),
      unit: String(work.unit || 'м²'),
      quantity: Number(work.quantity) || 0,
      pricePerUnit: Number(work.pricePerUnit) || 0,
      calculationType: String(work.calculationType || 'customCount'),
      category: work.category ? String(work.category) : undefined,
    };
  });
}

/**
 * Парсинг списка материалов
 */
export function parseMaterials(materials: unknown): RecommendedMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials.map((m: unknown) => {
    const material = m as Record<string, unknown>;
    return {
      name: String(material.name || ''),
      unit: String(material.unit || 'шт'),
      quantity: Number(material.quantity) || 0,
      pricePerUnit: Number(material.pricePerUnit) || 0,
      coverage: material.coverage ? String(material.coverage) : undefined,
    };
  });
}

/**
 * Парсинг списка инструментов
 */
export function parseTools(tools: unknown): RecommendedTool[] {
  if (!Array.isArray(tools)) return [];

  return tools.map((t: unknown) => {
    const tool = t as Record<string, unknown>;
    return {
      name: String(tool.name || ''),
      quantity: Number(tool.quantity) || 1,
      pricePerUnit: Number(tool.pricePerUnit) || 0,
      isRent: Boolean(tool.isRent),
    };
  });
}
