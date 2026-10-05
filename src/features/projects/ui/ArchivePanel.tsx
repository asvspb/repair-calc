import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { ProjectData } from '@shared/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useAuth } from '../../../store/useAuth';
import { logUserAction, logWarning } from '../../../utils/logger';
import { pluralize } from '../../../utils/format';

/**
 * Элемент списка архива. Дата архивации (серверное deleted_at) в маппинге
 * batch-001 не доезжает до клиента — поле опционально, при отсутствии
 * рендерится '—' (см. developer_log, T4 batch-002).
 */
export type ArchivedProjectItem = ProjectData & {
  objectsCount: number;
  roomsCount: number;
  archivedAt?: string;
};

/** Строки UI — константы по образцу домена (i18n-слой в проекте не заведён) */
const TEXT = {
  title: 'Архив',
  empty: 'Архивных проектов нет',
  loadError: 'Не удалось загрузить архивные проекты',
  retry: 'Повторить',
  restore: 'Восстановить',
  restoring: 'Восстановление...',
  deleteForever: 'Удалить навсегда',
  restoringDone: (name: string) => `Проект «${name}» восстановлен`,
  deletedDone: (name: string) => `Проект «${name}» удалён навсегда`,
  restoreError: 'Не удалось восстановить проект. Попробуйте ещё раз.',
  deleteError: 'Не удалось удалить проект. Попробуйте ещё раз.',
  deleteTitle: 'Удалить проект навсегда?',
  deletePrompt: (name: string) =>
    `Проект «${name}» и все его объекты с комнатами будут удалены безвозвратно. Введите имя проекта для подтверждения.`,
  deleteInputLabel: 'Имя проекта для подтверждения',
  deleteHint: 'Сравнение — после обрезки пробелов и с учётом регистра.',
  deleteConfirm: 'Удалить навсегда',
  cancel: 'Отмена',
  deleting: 'Удаление...',
} as const;

type LoadStatus = 'loading' | 'ready' | 'error';

type Notice = { type: 'success' | 'error'; message: string };

/** Дата в формате dd.MM.yyyy; пустое/невалидное значение — прочерк */
export function formatArchivedDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/**
 * Секция «Архив» в настройках проекта (TASK-BATCH-002-archive-t4).
 * Список архивных проектов + восстановление и безвозвратное удаление.
 * Логика — только store-экшены batch-001; гостю секция не рендерится.
 */
export function ArchivePanel() {
  const fetchArchivedProjects = useProjectStore(s => s.fetchArchivedProjects);
  const restoreProject = useProjectStore(s => s.restoreProject);
  const permanentDeleteProject = useProjectStore(s => s.permanentDeleteProject);
  const deletingIds = useProjectStore(s => s.deletingIds);
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState<ArchivedProjectItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedProjectItem | null>(null);
  const [confirmName, setConfirmName] = useState('');

  // Гейт от setState после размонтирования (edge-кейс ТЗ)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await fetchArchivedProjects();
      if (!mountedRef.current) return;
      setItems(list);
      setStatus('ready');
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
    }
  }, [fetchArchivedProjects]);

  useEffect(() => {
    if (isAuthenticated) {
      void load();
    }
  }, [isAuthenticated, load]);

  if (!isAuthenticated) return null;

  const handleRestore = async (item: ArchivedProjectItem) => {
    if (pendingId !== null) return;
    setPendingId(item.id);
    setNotice(null);
    logUserAction('Архив: восстановление проекта', { projectId: item.id });
    try {
      await restoreProject(item.id);
      if (!mountedRef.current) return;
      // Проект уходит из архива — исчезнет и из этого списка (в общий список попадёт после refresh/pull)
      setItems(prev => prev.filter(p => p.id !== item.id));
      setNotice({ type: 'success', message: TEXT.restoringDone(item.name) });
    } catch {
      if (!mountedRef.current) return;
      logWarning('ArchivePanel', 'Ошибка восстановления из архива', { projectId: item.id });
      setNotice({ type: 'error', message: TEXT.restoreError });
    } finally {
      if (mountedRef.current) setPendingId(null);
    }
  };

  const handlePermanentDelete = async () => {
    const target = deleteTarget;
    if (!target || pendingId !== null) return;
    // Сравнение строгое: trim() + учёт регистра (пояснено в тесте)
    if (confirmName.trim() !== target.name) return;
    setPendingId(target.id);
    logUserAction('Архив: безвозвратное удаление проекта', { projectId: target.id });
    try {
      await permanentDeleteProject(target.id);
      if (!mountedRef.current) return;
      setItems(prev => prev.filter(p => p.id !== target.id));
      setDeleteTarget(null);
      setConfirmName('');
      setNotice({ type: 'success', message: TEXT.deletedDone(target.name) });
    } catch {
      if (!mountedRef.current) return;
      logWarning('ArchivePanel', 'Ошибка безвозвратного удаления', { projectId: target.id });
      setDeleteTarget(null);
      setConfirmName('');
      setNotice({ type: 'error', message: TEXT.deleteError });
    } finally {
      if (mountedRef.current) setPendingId(null);
    }
  };

  const isBusy = (item: ArchivedProjectItem) => pendingId !== null || deletingIds.includes(item.id);

  const canConfirmDelete =
    deleteTarget !== null && confirmName.trim() === deleteTarget.name && pendingId === null;

  return (
    <div className="mt-8 pt-6 border-t border-gray-200" data-testid="archive-panel">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">{TEXT.title}</h3>
      </div>

      {status === 'loading' && (
        <div
          className="flex items-center gap-2 text-sm text-gray-500 py-4"
          data-testid="archive-loading"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Загрузка...</span>
        </div>
      )}

      {status === 'error' && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200"
          data-testid="archive-load-error"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm flex-1">{TEXT.loadError}</span>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {TEXT.retry}
          </button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="text-center py-6" data-testid="archive-empty">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{TEXT.empty}</p>
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="p-4 rounded-lg border border-gray-200 bg-white"
              data-testid={`archive-row-${item.id}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-medium text-gray-900 truncate">{item.name}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                    <span data-testid={`archive-date-${item.id}`}>
                      {formatArchivedDate(item.archivedAt)}
                    </span>
                    <span>
                      {item.objectsCount}{' '}
                      {pluralize(item.objectsCount, 'объект', 'объекта', 'объектов')}
                    </span>
                    <span>
                      {item.roomsCount} {pluralize(item.roomsCount, 'комната', 'комнаты', 'комнат')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => void handleRestore(item)}
                    disabled={isBusy(item)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {pendingId === item.id ? TEXT.restoring : TEXT.restore}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmName('');
                      setDeleteTarget(item);
                    }}
                    disabled={isBusy(item)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-lg hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {TEXT.deleteForever}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            notice.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
          data-testid="archive-notice"
        >
          <div className="flex items-start gap-3">
            {notice.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            )}
            <p className="text-sm">{notice.message}</p>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
          data-testid="archive-delete-dialog"
          onClick={() => {
            if (pendingId === null) {
              setDeleteTarget(null);
              setConfirmName('');
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-800">{TEXT.deleteTitle}</h2>
              </div>
            </div>

            <div className="p-4">
              <p className="text-gray-600">{TEXT.deletePrompt(deleteTarget.name)}</p>
              <input
                type="text"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                aria-label={TEXT.deleteInputLabel}
                autoFocus
                className="w-full mt-3 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-400">{TEXT.deleteHint}</p>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmName('');
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium cursor-pointer"
              >
                {TEXT.cancel}
              </button>
              <button
                onClick={() => void handlePermanentDelete()}
                disabled={!canConfirmDelete}
                data-testid="archive-delete-confirm"
                className="px-4 py-2 text-white bg-red-600 rounded-lg transition-colors font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingId === deleteTarget.id ? TEXT.deleting : TEXT.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
