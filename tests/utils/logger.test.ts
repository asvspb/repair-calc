/**
 * Тесты для утилиты логирования
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logUserAction,
  logSuccess,
  logError,
  logWarning,
  logDebug,
  logStart,
  logEnd,
  logApiRequest,
  logApiSuccess,
  logApiError,
  logStateChange,
  getActionHistory,
  clearActionHistory,
} from '../../src/utils/logger';

describe('Logger utility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearActionHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logUserAction', () => {
    it('should add action to history', () => {
      logUserAction('Test action', { key: 'value' });
      const history = getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].category).toBe('UserAction');
      expect(history[0].action).toBe('Test action');
      expect(history[0].level).toBe('info');
    });

    it('should add action without data', () => {
      logUserAction('Simple action');
      const history = getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toBeUndefined();
    });
  });

  describe('logSuccess', () => {
    it('should log success with timing', () => {
      const startTime = logStart('Test', 'Operation');
      logSuccess('Test', 'Operation completed', { result: 'ok' }, startTime);
      const history = getActionHistory();
      expect(history).toHaveLength(2);
      expect(history[1].level).toBe('success');
      expect(history[1].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error');
      logError('Test', 'Error occurred', error, { context: 'test' });
      expect(console.groupCollapsed).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logWarning', () => {
    it('should add warning to history', () => {
      logWarning('Test', 'Warning message');
      const history = getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].level).toBe('warning');
    });
  });

  describe('logDebug', () => {
    it('should add debug to history', () => {
      logDebug('Test', 'Debug message', { debug: true });
      const history = getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].level).toBe('debug');
    });
  });

  describe('API logging', () => {
    it('should log API request with timing', () => {
      const startTime = logApiRequest('GET', '/api/projects');
      expect(typeof startTime).toBe('number');
      
      logApiSuccess('GET', '/api/projects', startTime, { data: [] });
      const history = getActionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].category).toBe('API');
      expect(history[1].category).toBe('API');
    });

    it('should log API error', () => {
      const startTime = logApiRequest('POST', '/api/projects');
      const error = new Error('Network error');
      
      logApiError('POST', '/api/projects', startTime, error);
      expect(console.groupCollapsed).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logStateChange', () => {
    it('should log state changes', () => {
      logStateChange('Component', 'state updated', { new: 'value' }, { old: 'value' });
      expect(console.groupCollapsed).toHaveBeenCalled();
    });
  });

  describe('History management', () => {
    it('should limit history to MAX_HISTORY', () => {
      // Добавляем больше 100 записей
      for (let i = 0; i < 150; i++) {
        logUserAction(`Action ${i}`);
      }
      const history = getActionHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should clear history', () => {
      logUserAction('Action 1');
      logUserAction('Action 2');
      expect(getActionHistory()).toHaveLength(2);
      
      clearActionHistory();
      expect(getActionHistory()).toHaveLength(0);
    });
  });
});