import { useCallback } from 'react';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import type { ProjectData } from '@shared/types';
import { StorageManager } from '../../../utils/storage';

interface ExportPanelProps {
  projects: ProjectData[];
  activeProjectId: string;
}

function downloadFile(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportPanel({ projects, activeProjectId }: ExportPanelProps) {
  const handleExportJSON = useCallback(() => {
    const json = StorageManager.exportToJSON(projects, activeProjectId);
    downloadFile(
      json,
      'application/json',
      `repair-calc-backup-${new Date().toISOString().split('T')[0]}.json`,
    );
  }, [projects, activeProjectId]);

  const handleExportCSV = useCallback(() => {
    const csv = StorageManager.exportToCSV(projects);
    downloadFile(
      csv,
      'text/csv;charset=utf-8;',
      `repair-calc-export-${new Date().toISOString().split('T')[0]}.csv`,
    );
  }, [projects]);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Экспорт данных</h3>
      <div className="space-y-2">
        <button
          data-testid="export-json-btn"
          onClick={handleExportJSON}
          className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          <FileJson className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">Сохранить бэкап (JSON)</div>
            <div className="text-xs text-indigo-600/70">Полная копия всех проектов</div>
          </div>
          <Download className="w-4 h-4 ml-auto" />
        </button>

        <button
          data-testid="export-csv-btn"
          onClick={handleExportCSV}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">Экспорт в Excel (CSV)</div>
            <div className="text-xs text-gray-500">Для работы в таблицах</div>
          </div>
          <Download className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  );
}
