import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncDomain } from '../../../src/hooks/domains/useSyncDomain';
import type { ProjectData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  logDebug: vi.fn(),
}));

vi.mock('../../../src/utils/saveQueue', () => ({
  saveQueue: {
    hasPendingData: false,
    getPendingData: vi.fn(() => null),
    enqueue: vi.fn(),
  },
}));

import { saveQueue } from '../../../src/utils/saveQueue';

describe('useSyncDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return _initSync function', () => {
    const scheduleSave = vi.fn();
    const { result } = renderHook(() =>
      useSyncDomain({ isAuthenticated: false, scheduleSave })
    );

    expect(result.current._initSync).toBeTypeOf('function');
  });

  it('should call _initSync without error', () => {
    const scheduleSave = vi.fn();
    const { result } = renderHook(() =>
      useSyncDomain({ isAuthenticated: false, scheduleSave })
    );

    expect(() => {
      result.current._initSync();
    }).not.toThrow();
  });

  it('should register visibilitychange event listener', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const scheduleSave = vi.fn();

    renderHook(() =>
      useSyncDomain({ isAuthenticated: false, scheduleSave })
    );

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    addSpy.mockRestore();
  });

  it('should remove visibilitychange listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const scheduleSave = vi.fn();

    const { unmount } = renderHook(() =>
      useSyncDomain({ isAuthenticated: false, scheduleSave })
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('should call scheduleSave when visibility changes and has pending data', () => {
    const scheduleSave = vi.fn();
    const pendingProjects: ProjectData[] = [
      { id: 'p1', name: 'Test', objects: [] },
    ];

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue(pendingProjects);

    renderHook(() =>
      useSyncDomain({ isAuthenticated: true, scheduleSave })
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).toHaveBeenCalledWith(pendingProjects);

    (saveQueue.hasPendingData as boolean) = false;
  });

  it('should not call scheduleSave when no pending data', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = false;

    renderHook(() =>
      useSyncDomain({ isAuthenticated: true, scheduleSave })
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('should not call scheduleSave when visibility is not visible', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue([]);

    renderHook(() =>
      useSyncDomain({ isAuthenticated: true, scheduleSave })
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).not.toHaveBeenCalled();

    (saveQueue.hasPendingData as boolean) = false;
  });

  it('should not call scheduleSave when pendingSaveRef already has data', () => {
    const scheduleSave = vi.fn();
    const pendingProjects: ProjectData[] = [
      { id: 'p1', name: 'Test', objects: [] },
    ];

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue(pendingProjects);

    renderHook(() =>
      useSyncDomain({ isAuthenticated: true, scheduleSave })
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).toHaveBeenCalledTimes(1);

    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue(pendingProjects);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).toHaveBeenCalledTimes(1);

    (saveQueue.hasPendingData as boolean) = false;
  });

  it('should not call scheduleSave when getPendingData returns non-array', () => {
    const scheduleSave = vi.fn();

    (saveQueue.hasPendingData as boolean) = true;
    (saveQueue.getPendingData as ReturnType<typeof vi.fn>).mockReturnValue('not-an-array');

    renderHook(() =>
      useSyncDomain({ isAuthenticated: true, scheduleSave })
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(scheduleSave).not.toHaveBeenCalled();

    (saveQueue.hasPendingData as boolean) = false;
  });
});
