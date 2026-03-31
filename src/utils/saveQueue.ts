/**
 * SaveQueue — очередь сохранений для предотвращения race conditions
 * Гарантирует последовательное выполнение операций сохранения
 * При нескольких быстрых изменениях — сохраняется только последнее состояние
 * 
 * Поддерживает персистентность в localStorage для восстановления после перезагрузки
 */

type SaveTask = () => Promise<void>;

interface SaveQueueState {
  isProcessing: boolean;
  pendingTask: SaveTask | null;
  lastError: Error | null;
}

const PENDING_SAVE_KEY = 'repair-calc-pending-save';

/**
 * Сохранение pending данных в localStorage
 */
function persistPendingSave(data: unknown): void {
  try {
    localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (error) {
    console.error('[SaveQueue] Ошибка сохранения pending данных:', error);
  }
}

/**
 * Загрузка pending данных из localStorage
 */
function loadPendingSave(): { timestamp: number; data: unknown } | null {
  try {
    const stored = localStorage.getItem(PENDING_SAVE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as { timestamp: number; data: unknown };
    
    // Проверяем, не слишком ли старые данные (старше 1 часа)
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > ONE_HOUR) {
      console.warn('[SaveQueue] Pending данные слишком старые, пропускаем');
      localStorage.removeItem(PENDING_SAVE_KEY);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('[SaveQueue] Ошибка загрузки pending данных:', error);
    return null;
  }
}

/**
 * Очистка pending данных из localStorage
 */
function clearPendingSave(): void {
  try {
    localStorage.removeItem(PENDING_SAVE_KEY);
  } catch (error) {
    console.error('[SaveQueue] Ошибка очистки pending данных:', error);
  }
}

/**
 * Очередь сохранений с debounce на уровне задач
 */
class SaveQueue {
  private state: SaveQueueState = {
    isProcessing: false,
    pendingTask: null,
    lastError: null,
  };
  
  private pendingData: unknown | null = null;

  constructor() {
    // Восстанавливаем pending данные при загрузке
    const pending = loadPendingSave();
    if (pending) {
      this.pendingData = pending.data;
      console.log('[SaveQueue] Восстановлены pending данные', { timestamp: pending.timestamp });
    }
  }

  /**
   * Добавить задачу сохранения в очередь.
   * Если задача уже выполняется — новая задача заменяет предыдущую pending.
   * Это гарантирует сохранение только актуального состояния.
   */
  enqueue(task: SaveTask, dataToPersist?: unknown): void {
    this.state.pendingTask = task;
    this.state.lastError = null;
    
    // Сохраняем данные для персистентности
    if (dataToPersist !== undefined) {
      this.pendingData = dataToPersist;
      persistPendingSave(dataToPersist);
    }
    
    this.processNext();
  }

  /**
   * Обработка следующей задачи в очереди
   */
  private async processNext(): Promise<void> {
    // Если уже обрабатываем — ждём завершения
    if (this.state.isProcessing) {
      return;
    }

    // Если нет pending задачи — нечего делать
    if (!this.state.pendingTask) {
      return;
    }

    this.state.isProcessing = true;
    const task = this.state.pendingTask;
    this.state.pendingTask = null;

    try {
      await task();
      this.state.lastError = null;
      // Очищаем pending данные после успешного сохранения
      this.pendingData = null;
      clearPendingSave();
    } catch (error) {
      this.state.lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[SaveQueue] Ошибка сохранения:', error);
      // Не очищаем pending данные при ошибке — они будут использованы при следующей попытке
    } finally {
      this.state.isProcessing = false;

      // Если за время выполнения пришла новая задача — запускаем
      if (this.state.pendingTask) {
        // Небольшая задержка для предотвращения бесконечного цикла
        setTimeout(() => this.processNext(), 0);
      }
    }
  }

  /**
   * Текущее состояние очереди
   */
  get isProcessing(): boolean {
    return this.state.isProcessing;
  }

  /**
   * Есть ли ожидающая задача
   */
  get hasPending(): boolean {
    return this.state.pendingTask !== null;
  }

  /**
   * Есть ли pending данные для восстановления
   */
  get hasPendingData(): boolean {
    return this.pendingData !== null;
  }

  /**
   * Получить pending данные
   */
  getPendingData(): unknown {
    return this.pendingData;
  }

  /**
   * Последняя ошибка (если была)
   */
  get lastError(): Error | null {
    return this.state.lastError;
  }

  /**
   * Сбросить последнюю ошибку
   */
  clearError(): void {
    this.state.lastError = null;
  }

  /**
   * Дождаться завершения всех задач
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const checkAndResolve = () => {
        if (!this.state.isProcessing && !this.state.pendingTask) {
          resolve();
        } else {
          setTimeout(checkAndResolve, 50);
        }
      };
      checkAndResolve();
    });
  }
}

// Singleton instance
export const saveQueue = new SaveQueue();