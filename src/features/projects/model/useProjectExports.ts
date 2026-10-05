import { useCallback } from 'react';
import type { ProjectData } from '@shared/types';
import { StorageManager } from '../../../utils/storage';
import type { ImportStatus } from './modalTypes';

interface UseProjectExportsArgs {
  projects: ProjectData[];
  activeProjectId: string;
  setImportStatus: (status: ImportStatus | null) => void;
}

/** Экспорт JSON/CSV в ProjectsModal (вынесен из useProjectsModal, TASK-BATCH-013). */
export function useProjectExports({
  projects,
  activeProjectId,
  setImportStatus,
}: UseProjectExportsArgs) {
  // Export JSON
  const handleExportJSON = useCallback(() => {
    const json = StorageManager.exportToJSON(projects, activeProjectId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair-calc-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Delayed cleanup to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    setImportStatus({
      type: 'success',
      message: 'Бэкап успешно экспортирован в JSON',
    });
  }, [projects, activeProjectId, setImportStatus]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csv = StorageManager.exportToCSV(projects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair-calc-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Delayed cleanup to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    setImportStatus({
      type: 'success',
      message: 'Данные успешно экспортированы в CSV',
    });
  }, [projects, setImportStatus]);

  return { handleExportJSON, handleExportCSV };
}
