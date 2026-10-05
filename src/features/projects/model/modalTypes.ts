import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../../types/workTemplate';

export type ImportStatus = {
  type: 'success' | 'error' | 'confirm';
  message: string;
  data?: { projects: ProjectData[]; activeProjectId: string; workTemplates?: WorkTemplate[] };
};
