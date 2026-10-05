import { Database, FolderOpen, RefreshCw, X } from 'lucide-react';
import type { ServerProject } from '../model/types';

interface LoadProjectDialogProps {
  serverProjects: ServerProject[];
  isLoadingProjects: boolean;
  isLoadingProject: boolean;
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onLoad: () => void;
}

/** Диалог «Открыть проект с сервера» (выделен из SyncPanel, TASK-BATCH-013). */
export function LoadProjectDialog(props: LoadProjectDialogProps) {
  const {
    serverProjects,
    isLoadingProjects,
    isLoadingProject,
    selectedProjectId,
    onSelect,
    onClose,
    onLoad,
  } = props;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[80vh] flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-cyan-600" />
            Открыть проект с сервера
          </h2>

          <div className="flex-1 overflow-y-auto mb-4">
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Загрузка списка проектов...</span>
              </div>
            ) : serverProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>На сервере нет сохранённых проектов</p>
              </div>
            ) : (
              <div className="space-y-2">
                {serverProjects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => onSelect(project.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedProjectId === project.id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{project.name}</div>
                        {project.city && (
                          <div className="text-sm text-gray-500">{project.city}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(project.updated_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={onLoad}
              disabled={isLoadingProject || !selectedProjectId}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoadingProject && <RefreshCw className="w-4 h-4 animate-spin" />}
              {isLoadingProject ? 'Загрузка...' : 'Открыть'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
