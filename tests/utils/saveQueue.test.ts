import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveQueue } from '../../src/utils/saveQueue';

describe('saveQueue', () => {
  beforeEach(() => {
    saveQueue.cancelPending();
    vi.clearAllMocks();
  });

  it('should process a task correctly', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    saveQueue.enqueue(task);

    // Give it a moment to process the task
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending tasks if cancelPending is called', async () => {
    // We create a task that takes some time to resolve
    let resolveFirst: () => void;
    const task1 = vi.fn().mockReturnValue(
      new Promise<void>(resolve => {
        resolveFirst = resolve;
      }),
    );

    const task2 = vi.fn().mockResolvedValue(undefined);

    saveQueue.enqueue(task1); // This starts immediately
    saveQueue.enqueue(task2); // This gets queued as pendingTask

    // While task1 is processing, we cancel the pending task2
    saveQueue.cancelPending();

    // Now resolve task1
    resolveFirst!();

    // Wait to see if task2 runs
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).not.toHaveBeenCalled(); // task2 was cancelled!
  });
});
