import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ImportStatus } from './modalTypes';

interface ImportStatusBannerProps {
  importStatus: ImportStatus;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Баннер статуса импорта в ProjectsModal (выделен в TASK-BATCH-013). */
export function ImportStatusBanner({
  importStatus,
  onConfirm,
  onDismiss,
}: ImportStatusBannerProps) {
  return (
    <div
      className={`mt-4 p-4 rounded-lg ${
        importStatus.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : importStatus.type === 'error'
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {importStatus.type === 'success' && <CheckCircle className="w-5 h-5 mt-0.5" />}
        {importStatus.type === 'error' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
        {importStatus.type === 'confirm' && <AlertTriangle className="w-5 h-5 mt-0.5" />}
        <div className="flex-1">
          <p className="text-sm">{importStatus.message}</p>
          {importStatus.type === 'confirm' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors cursor-pointer"
              >
                Импортировать
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
