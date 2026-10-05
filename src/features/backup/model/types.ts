import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../../types/workTemplate';

export interface BackupManagerProps {
  projects: ProjectData[];
  activeProjectId: string;
  onImport: (projects: ProjectData[], activeProjectId: string) => void;
  onClearAll: () => void;
  onImportTemplates?: (templates: WorkTemplate[]) => void;
}

export type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: { projects: ProjectData[]; activeProjectId: string; workTemplates?: WorkTemplate[] };
};

/** Тип для ожидающих импорта данных */
export type PendingImportData = {
  projects: ProjectData[];
  activeProjectId: string;
  workTemplates?: WorkTemplate[];
  objectCount: number;
};

/** Типы для диалогов сохранения/загрузки */
export type ServerProject = {
  id: string;
  name: string;
  city: string | null;
  updated_at: string;
};

/** Общий сеттер статуса для панелей бэкапа */
export type SetImportStatus = (status: ImportStatus | null) => void;
