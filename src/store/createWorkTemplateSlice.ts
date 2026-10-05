import type { StateCreator } from 'zustand';
import type { WorkTemplateSlice, StoreState } from './types';
import type { WorkTemplate, WorkCategory } from '../types/workTemplate';
import { mapWorkCategoryToLegacy } from '../types/workTemplate';
import type { RoomMetrics } from '../types';
import type { WorkData } from '@shared/types';
import { TemplateStorage } from '../utils/templateStorage';
import { migrateWorkData } from '../domain/pricing/costs';
import { generateId } from '../domain/factories/projectFactory';

export const createWorkTemplateSlice: StateCreator<StoreState, [], [], WorkTemplateSlice> = (
  set,
  get,
) => ({
  templates: [],
  workTemplatesLoading: true,

  initWorkTemplates: () => {
    const loadedTemplates = TemplateStorage.loadTemplates();
    set({ templates: loadedTemplates, workTemplatesLoading: false });
  },

  saveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => {
    const currentTemplates = get().templates;
    const migratedWork = migrateWorkData(work);

    // Масштабируем количества материалов если передан объём
    let scaledMaterials = migratedWork.materials || [];
    if (workVolume && workVolume > 0 && migratedWork.materials?.length) {
      const sourceVol = (migratedWork as Record<string, unknown>).sourceVolume as
        number | undefined;
      const scaleFactor = workVolume / (sourceVol || workVolume);
      scaledMaterials = migratedWork.materials.map(m => ({
        ...m,
        quantity: Math.ceil(m.quantity * scaleFactor * 10) / 10,
      }));
    }

    const template: WorkTemplate = {
      id: migratedWork.templateId || `template-${Date.now()}`,
      name: migratedWork.name,
      category: mapWorkCategoryToLegacy((migratedWork.category || 'other') as WorkCategory),
      unit: migratedWork.unit,
      calculationType: migratedWork.calculationType,
      workUnitPrice: migratedWork.workUnitPrice,
      materials: scaledMaterials,
      tools: migratedWork.tools || [],
      createdAt: migratedWork.templateCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceVolume: workVolume,
    };

    // Проверяем, есть ли уже шаблон с таким названием (case-insensitive)
    const existingIndex = currentTemplates.findIndex(
      t => t.name.toLowerCase() === template.name.toLowerCase(),
    );

    if (existingIndex >= 0 && !forceReplace) {
      return {
        success: false,
        error: 'Шаблон с таким названием уже существует',
        needsConfirm: true,
      };
    }

    let newTemplates: WorkTemplate[];
    if (existingIndex >= 0) {
      // Replace existing template, keeping original ID and createdAt
      newTemplates = currentTemplates.map((t, i) =>
        i === existingIndex ? { ...template, id: t.id, createdAt: t.createdAt } : t,
      );
    } else {
      newTemplates = [...currentTemplates, template];
    }

    set({ templates: newTemplates });
    TemplateStorage.saveTemplates(newTemplates);

    return { success: true, isUpdate: existingIndex >= 0 };
  },

  loadTemplate: (template: WorkTemplate, metrics?: RoomMetrics): WorkData => {
    let workVolume = 0;
    if (metrics) {
      switch (template.calculationType) {
        case 'floorArea':
          workVolume = metrics.floorArea;
          break;
        case 'netWallArea':
          workVolume = metrics.netWallArea;
          break;
        case 'skirtingLength':
          workVolume = metrics.skirtingLength;
          break;
        default:
          workVolume = 0;
      }
    }

    // Масштабируем количества материалов
    let scaledMaterials = template.materials || [];
    if (workVolume > 0 && template.sourceVolume && template.sourceVolume > 0) {
      const scaleFactor = workVolume / template.sourceVolume;
      scaledMaterials = template.materials.map(m => ({
        ...m,
        quantity: Math.ceil(m.quantity * scaleFactor * 10) / 10,
      }));
    }

    return {
      id: `work-${Date.now()}`,
      name: template.name,
      category: template.category,
      unit: template.unit,
      enabled: true,
      calculationType: template.calculationType,
      workUnitPrice: template.workUnitPrice,
      materialPriceType: 'total',
      materialPrice: 0,
      materials: scaledMaterials.map(m => ({ ...m, id: generateId('mat-') })),
      tools: (template.tools || []).map(t => ({ ...t, id: generateId('tool-') })),
      isCustom: false,
      templateId: template.id,
      templateCreatedAt: template.createdAt,
      sourceVolume: template.sourceVolume,
    };
  },

  deleteTemplate: (id: string) => {
    const newTemplates = get().templates.filter(t => t.id !== id);
    set({ templates: newTemplates });
    TemplateStorage.saveTemplates(newTemplates);
  },

  importTemplates: (importedTemplates: WorkTemplate[]) => {
    // Объединяем с существующими, новые перезаписывают
    const existingIds = new Set(importedTemplates.map(t => t.id));
    const mergedTemplates = [
      ...get().templates.filter(t => !existingIds.has(t.id)),
      ...importedTemplates,
    ];
    set({ templates: mergedTemplates });
    TemplateStorage.saveTemplates(mergedTemplates);
  },
});
