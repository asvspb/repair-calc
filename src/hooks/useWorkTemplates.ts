import { useState, useEffect, useCallback } from 'react';
import type { WorkTemplate, WorkTemplateCategory } from '../types/workTemplate';
import type { WorkData, Material, Tool } from '../types';
import { TemplateStorage } from '../utils/templateStorage';
import { getTemplateCategory } from '../types/workTemplate';

export type SaveResult =
  | { success: true; isUpdate: boolean }
  | { success: false; error: string; needsConfirm?: boolean };

export type RoomMetrics = {
  floorArea: number;
  netWallArea: number;
  skirtingLength: number;
};

/**
 * React hook for managing work templates (v2 with material scaling)
 */
export function useWorkTemplates() {
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates on mount
  useEffect(() => {
    const loaded = TemplateStorage.loadTemplates();
    setTemplates(loaded);
    setIsLoading(false);
  }, []);

  /**
   * Save a work as a template (v2: with sourceVolume for material scaling)
   */
  const saveTemplate = useCallback((work: WorkData, forceReplace = false, workVolume?: number): SaveResult => {
    try {
      const now = new Date().toISOString();

      // Check if template with this name already exists
      const existingTemplate = TemplateStorage.findByName(work.name);

      if (existingTemplate && !forceReplace) {
        return { success: false, error: 'Шаблон с таким названием уже существует', needsConfirm: true };
      }

      const template: WorkTemplate = {
        id: existingTemplate?.id || crypto.randomUUID(),
        name: work.name || 'Без названия',
        category: getTemplateCategory(work.calculationType),
        unit: work.unit,
        workUnitPrice: work.workUnitPrice,
        calculationType: work.calculationType,
        count: work.count,
        sourceVolume: workVolume,  // v2: сохраняем объём для масштабирования
        materials: (work.materials || []).map((m: Material) => ({
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          pricePerUnit: m.pricePerUnit,
        })),
        tools: (work.tools || []).map((t: Tool) => ({
          name: t.name,
          quantity: t.quantity,
          price: t.price,
          isRent: t.isRent,
          rentPeriod: t.rentPeriod,
        })),
        createdAt: existingTemplate?.createdAt || now,
        updatedAt: now,
      };

      const updatedTemplates = TemplateStorage.upsertByName(template);
      setTemplates(updatedTemplates);

      return { success: true, isUpdate: !!existingTemplate };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения шаблона';
      return { success: false, error: message };
    }
  }, []);

  /**
   * Load a template into a WorkData format (v2: with material scaling based on room metrics)
   */
  const loadTemplate = useCallback((template: WorkTemplate, metrics?: RoomMetrics): WorkData => {
    // Определяем целевой объём по метрикам комнаты
    let targetVolume = 0;
    if (metrics) {
      if (template.calculationType === 'floorArea') targetVolume = metrics.floorArea;
      else if (template.calculationType === 'netWallArea') targetVolume = metrics.netWallArea;
      else if (template.calculationType === 'skirtingLength') targetVolume = metrics.skirtingLength;
    } else if (template.calculationType === 'customCount') {
      targetVolume = template.count || 0;
    }

    const sourceVolume = template.sourceVolume || 0;
    const shouldScale = sourceVolume > 0 && targetVolume > 0;
    const ratio = shouldScale ? targetVolume / sourceVolume : 1;

    return {
      id: crypto.randomUUID(),
      enabled: true,
      isCustom: true,
      name: template.name,
      unit: template.unit,
      workUnitPrice: template.workUnitPrice,
      calculationType: template.calculationType,
      count: template.count,
      materials: template.materials.map(m => ({
        id: crypto.randomUUID(),
        name: m.name,
        quantity: shouldScale
          ? Math.round(m.quantity * ratio * 100) / 100  // округление до 2 знаков
          : m.quantity,
        unit: m.unit,
        pricePerUnit: m.pricePerUnit,  // цена за единицу НЕ масштабируется
      })),
      tools: template.tools.map(t => ({
        id: crypto.randomUUID(),
        name: t.name,
        quantity: t.quantity,  // инструменты НЕ масштабируются
        price: t.price,
        isRent: t.isRent,
        rentPeriod: t.rentPeriod,
      })),
    };
  }, []);

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback((id: string) => {
    const updatedTemplates = TemplateStorage.deleteTemplate(id);
    setTemplates(updatedTemplates);
  }, []);

  /**
   * Search templates by name and category
   */
  const searchTemplates = useCallback((query: string, category: WorkTemplateCategory | 'all' = 'all') => {
    return TemplateStorage.searchAndFilter(query, category);
  }, []);

  /**
   * Check if a template with given name exists
   */
  const templateExists = useCallback((name: string) => {
    return TemplateStorage.existsByName(name);
  }, []);

  /**
   * Import templates (for backup restore)
   */
  const importTemplates = useCallback((importedTemplates: WorkTemplate[]) => {
    TemplateStorage.saveTemplates(importedTemplates);
    setTemplates(importedTemplates);
  }, []);

  return {
    templates,
    isLoading,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    searchTemplates,
    templateExists,
    importTemplates,
  };
}