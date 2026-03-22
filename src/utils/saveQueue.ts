/**
 * SaveQueue — очередь сохранений для предотвращения race conditions
 * Гарантирует последовательное выполнение операций сохранения
 * При нескольких быстрых изменениях — сохраняется только последнее состояние
 */

type SaveTask = () => Promise<void>;

interface SaveQueueState {
  isProcessing: boolean;
  pendingTask: SaveTask | null;
  lastError: Error | null;
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

  /**
   * Добавить задачу сохранения в очередь.
   * Если задача уже выполняется — новая задача заменяет предыдущую pending.
   * Это гарантирует сохранение только актуального состояния.
   */
  enqueue(task: SaveTask): void {
    this.state.pendingTask = task;
    this.state.lastError = null;
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
    } catch (error) {
      this.state.lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[SaveQueue] Ошибка сохранения:', error);
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