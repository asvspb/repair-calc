import type { ProjectData } from '../App';
import type { WorkTemplate } from '../types/workTemplate';
import { TemplateStorage } from './templateStorage';

const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
  LAST_BACKUP: 'repair-calc-last-backup',
  WORK_TEMPLATES: 'repair-calc-work-templates',
} as const;

const CURRENT_VERSION = '1.0.0';

export interface BackupData {
  version: string;
  exportedAt: string;
  projects: ProjectData[];
  activeProjectId: string;
  workTemplates?: WorkTemplate[];
}

export interface StorageError {
  type: 'quota_exceeded' | 'corrupted' | 'unknown';
  message: string;
}

export class StorageManager {
  static saveProjects(projects: ProjectData[]): void {
    try {
      const data = JSON.stringify(projects);
      localStorage.setItem(STORAGE_KEYS.PROJECTS, data);
      localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          throw { type: 'quota_exceeded', message: 'Превышен лимит хранилища. Удалите старые проекты или создайте бэкап.' } as StorageError;
        }
      }
      throw { type: 'unknown', message: 'Ошибка сохранения данных' } as StorageError;
    }
  }

  static loadProjects(): ProjectData[] | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (!data) return null;
      
      const projects = JSON.parse(data) as ProjectData[];
      
      // Валидация структуры
      if (!Array.isArray(projects)) {
        throw new Error('Invalid data structure');
      }
      
      return projects;
    } catch (error) {
      console.error('Error loading projects:', error);
      return null;
    }
  }

  static saveActiveProject(projectId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, projectId);
    } catch (error) {
      console.error('Error saving active project:', error);
    }
  }

  static loadActiveProject(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
    } catch (error) {
      console.error('Error loading active project:', error);
      return null;
    }
  }

  static exportToJSON(projects: ProjectData[], activeProjectId: string): string {
    const workTemplates = TemplateStorage.loadTemplates();
    const backupData: BackupData = {
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
      activeProjectId,
      workTemplates
    };
    return JSON.stringify(backupData, null, 2);
  }

  static importFromJSON(jsonString: string): { success: true; data: BackupData } | { success: false; error: string } {
    try {
      const data = JSON.parse(jsonString) as BackupData;

      // Валидация структуры
      if (!data.projects || !Array.isArray(data.projects)) {
        return { success: false, error: 'Неверная структура файла: отсутствуют проекты' };
      }

      if (!data.version) {
        return { success: false, error: 'Неверная структура файла: отсутствует версия' };
      }

      // Проверка каждого проекта
      for (const project of data.projects) {
        if (!project.id || !project.name || !Array.isArray(project.rooms)) {
          return { success: false, error: `Неверная структура проекта: ${project.name || 'без названия'}` };
        }
      }

      // Валидация шаблонов (если есть)
      if (data.workTemplates) {
        if (!Array.isArray(data.workTemplates)) {
          return { success: false, error: 'Неверная структура шаблонов работ' };
        }
        // Проверяем структуру каждого шаблона
        for (const template of data.workTemplates) {
          if (!template.id || !template.name || !template.category) {
            return { success: false, error: `Неверная структура шаблона: ${template.name || 'без названия'}` };
          }
        }
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: 'Неверный формат JSON файла' };
    }
  }

  static exportToCSV(projects: ProjectData[]): string {
    const rows: string[] = [];
    
    // Заголовки
    rows.push(['Объект', 'Комната', 'Работа', 'Единица', 'Объем', 'Цена работы', 'Цена материалов', 'Итого'].join(';'));
    
    for (const project of projects) {
      for (const room of project.rooms) {
        // Расчет метрик комнаты
        const floorArea = room.length * room.width;
        const perimeter = (room.length + room.width) * 2;
        const grossWallArea = perimeter * room.height;
        const windowsArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
        const doorsArea = room.doors.reduce((sum, d) => sum + d.width * d.height, 0);
        const doorsWidth = room.doors.reduce((sum, d) => sum + d.width, 0);
        const netWallArea = Math.max(0, grossWallArea - windowsArea - doorsArea);
        const skirtingLength = Math.max(0, perimeter - doorsWidth);
        
        for (const work of room.works) {
          if (!work.enabled) continue;
          
          let qty = 0;
          if (work.calculationType === 'floorArea') qty = floorArea;
          else if (work.calculationType === 'netWallArea') qty = netWallArea;
          else if (work.calculationType === 'skirtingLength') qty = skirtingLength;
          else if (work.calculationType === 'customCount') qty = work.count || 0;
          
          const workCost = qty * work.workUnitPrice;
          const materialCost = work.materialPriceType === 'per_unit' ? qty * work.materialPrice : work.materialPrice;
          const total = workCost + materialCost;
          
          rows.push([
            project.name,
            room.name,
            work.name,
            work.unit,
            qty.toFixed(2),
            workCost.toFixed(2),
            materialCost.toFixed(2),
            total.toFixed(2)
          ].join(';'));
        }
      }
    }
    
    // Добавляем BOM для корректного отображения кириллицы в Excel
    return '\uFEFF' + rows.join('\n');
  }

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
    localStorage.removeItem(STORAGE_KEYS.WORK_TEMPLATES);
  }

  static importWorkTemplates(templates: WorkTemplate[]): void {
    TemplateStorage.saveTemplates(templates);
  }

  static getStorageInfo(): { used: number; total: number; percentage: number } {
    let used = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
      }
    }
    
    // Приблизительный лимит для localStorage (5-10 MB)
    const total = 5 * 1024 * 1024; // 5 MB
    const percentage = Math.min((used / total) * 100, 100);
    
    return { used, total, percentage };
  }
}

export { STORAGE_KEYS, CURRENT_VERSION };
