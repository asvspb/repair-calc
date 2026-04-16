import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { WorkTemplate } from '../types/workTemplate';
import type { RoomMetrics } from '../types';
import type { WorkData } from '../types';
import { TemplateStorage } from '../utils/templateStorage';
import { migrateWorkData } from '../utils/costs';
import type { SaveResult } from '../hooks/useWorkTemplates';

interface WorkTemplateContextValue {
  templates: WorkTemplate[];
  isLoading: boolean;
  
  // Actions
  saveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => SaveResult;
  loadTemplate: (template: WorkTemplate, metrics?: RoomMetrics) => WorkData;
  deleteTemplate: (id: string) => void;
  importTemplates: (templates: WorkTemplate[]) => void;
}

const WorkTemplateContext = createContext<WorkTemplateContextValue | null>(null);

interface WorkTemplateProviderProps {
  children: ReactNode;
}

export function WorkTemplateProvider({ children }: WorkTemplateProviderProps) {
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to always access latest templates in callbacks (avoids stale closures)
  const templatesRef = useRef<WorkTemplate[]>([]);
  templatesRef.current = templates;

  // Загрузка шаблонов при монтировании
  useEffect(() => {
    const loadedTemplates = TemplateStorage.loadTemplates();
    setTemplates(loadedTemplates);
    setIsLoading(false);
  }, []);

  // Сохранение шаблона
  // Uses templatesRef to avoid stale closure — callback reference is stable
  const saveTemplate = useCallback((work: WorkData, forceReplace: boolean, workVolume?: number): SaveResult => {
    const currentTemplates = templatesRef.current;
    const migratedWork = migrateWorkData(work);
    
    // Масштабируем количества материалов если передан объём
    let scaledMaterials = migratedWork.materials || [];
    if (workVolume && workVolume > 0 && migratedWork.materials?.length) {
      const sourceVol = (migratedWork as Record<string, unknown>).sourceVolume as number | undefined;
      const scaleFactor = workVolume / (sourceVol || workVolume);
      scaledMaterials = migratedWork.materials.map(m => ({
        ...m,
        quantity: Math.ceil(m.quantity * scaleFactor * 10) / 10
      }));
    }
    
    const template: WorkTemplate = {
      id: migratedWork.templateId || `template-${Date.now()}`,
      name: migratedWork.name,
      category: migratedWork.category || 'other',
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
      t => t.name.toLowerCase() === template.name.toLowerCase()
    );

    if (existingIndex >= 0 && !forceReplace) {
      return { success: false, error: 'Шаблон с таким названием уже существует', needsConfirm: true };
    }

    let newTemplates: WorkTemplate[];
    if (existingIndex >= 0) {
      // Replace existing template, keeping original ID and createdAt
      newTemplates = currentTemplates.map((t, i) =>
        i === existingIndex
          ? { ...template, id: t.id, createdAt: t.createdAt }
          : t
      );
    } else {
      newTemplates = [...currentTemplates, template];
    }

    setTemplates(newTemplates);
    templatesRef.current = newTemplates; // Update ref immediately
    TemplateStorage.saveTemplates(newTemplates);
    
    return { success: true, isUpdate: existingIndex >= 0 };
  }, []);

  // Загрузка шаблона
  const loadTemplate = useCallback((template: WorkTemplate, metrics?: RoomMetrics): WorkData => {
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
        quantity: Math.ceil(m.quantity * scaleFactor * 10) / 10
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
      materials: scaledMaterials,
      tools: template.tools || [],
      isCustom: false,
      templateId: template.id,
      templateCreatedAt: template.createdAt,
      sourceVolume: template.sourceVolume,
    };
  }, []);

  // Удаление шаблона
  const deleteTemplate = useCallback((id: string) => {
    const newTemplates = templatesRef.current.filter(t => t.id !== id);
    setTemplates(newTemplates);
    templatesRef.current = newTemplates;
    TemplateStorage.saveTemplates(newTemplates);
  }, []);

  // Импорт шаблонов
  const importTemplates = useCallback((importedTemplates: WorkTemplate[]) => {
    // Объединяем с существующими, новые перезаписывают
    const existingIds = new Set(importedTemplates.map(t => t.id));
    const mergedTemplates = [
      ...templatesRef.current.filter(t => !existingIds.has(t.id)),
      ...importedTemplates
    ];
    setTemplates(mergedTemplates);
    templatesRef.current = mergedTemplates;
    TemplateStorage.saveTemplates(mergedTemplates);
  }, []);

  const value: WorkTemplateContextValue = {
    templates,
    isLoading,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    importTemplates,
  };

  return (
    <WorkTemplateContext.Provider value={value}>
      {children}
    </WorkTemplateContext.Provider>
  );
}

/**
 * Хук для доступа к контексту шаблонов работ.
 * Выбрасывает ошибку, если используется вне WorkTemplateProvider.
 */
export function useWorkTemplateContext(): WorkTemplateContextValue {
  const context = useContext(WorkTemplateContext);
  if (!context) {
    throw new Error('useWorkTemplateContext must be used within a WorkTemplateProvider');
  }
  return context;
}

export { WorkTemplateContext };