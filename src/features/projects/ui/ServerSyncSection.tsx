import { RefreshCw, Save, Server } from 'lucide-react';

interface ServerSyncSectionProps {
  isSavingToServer: boolean;
  isLoadingFromServer: boolean;
  onSaveAll: () => void;
  onLoadAll: () => void;
}

/** Секция синхронизации с сервером в ProjectsModal (выделена в TASK-BATCH-013). */
export function ServerSyncSection({
  isSavingToServer,
  isLoadingFromServer,
  onSaveAll,
  onLoadAll,
}: ServerSyncSectionProps) {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">Синхронизация с сервером</h3>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSaveAll}
          disabled={isSavingToServer}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
        >
          {isSavingToServer ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSavingToServer ? 'Сохранение...' : 'Сохранить все'}
        </button>

        <button
          onClick={onLoadAll}
          disabled={isLoadingFromServer}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
        >
          {isLoadingFromServer ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Server className="w-4 h-4" />
          )}
          {isLoadingFromServer ? 'Загрузка...' : 'Загрузить все'}
        </button>
      </div>
    </div>
  );
}
