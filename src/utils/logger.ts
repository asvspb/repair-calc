/**
 * Утилита для логирования действий пользователя и состояния приложения
 * Логи выводятся в консоль браузера с группировкой и цветовым выделением
 */

const _c = typeof console !== 'undefined' ? console : undefined as unknown as Console;

function bindConsole(method: 'log' | 'group' | 'groupCollapsed' | 'groupEnd' | 'error'): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    if (_c && typeof _c[method] === 'function') {
      (_c[method] as (...a: unknown[]) => void)(...args);
    }
  };
}

const _log = bindConsole('log');
const _group = bindConsole('group');
const _groupCollapsed = bindConsole('groupCollapsed');
const _groupEnd = bindConsole('groupEnd');
const _error = bindConsole('error');

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  action: string;
  data?: unknown;
  duration?: number;
}

// Настройки логирования
const LOG_CONFIG = {
  enabled: true,
  showTimestamp: true,
  showDuration: true,
  groupRelated: true,
  maxDataLength: 1000, // Максимальная длина данных для отображения
};

// Хранилище последних действий для отладки
const actionHistory: LogEntry[] = [];
const MAX_HISTORY = 100;

// Стили для разных уровней логирования
const LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'color: #2196F3; font-weight: bold',
  success: 'color: #4CAF50; font-weight: bold',
  warning: 'color: #FF9800; font-weight: bold',
  error: 'color: #F44336; font-weight: bold',
  debug: 'color: #9E9E9E; font-weight: bold',
};

// Эмодзи для уровней
const LEVEL_EMOJI: Record<LogLevel, string> = {
  info: '📋',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍',
};

function log(
  level: LogLevel,
  category: string,
  action: string,
  data?: unknown,
  startTime?: number
): void {
  if (!LOG_CONFIG.enabled) return;

  const timestamp = new Date();
  const duration = startTime ? timestamp.getTime() - startTime : undefined;

  const entry: LogEntry = {
    timestamp,
    level,
    category,
    action,
    data,
    duration,
  };

  // Добавляем в историю
  actionHistory.push(entry);
  if (actionHistory.length > MAX_HISTORY) {
    actionHistory.shift();
  }

  // Формируем сообщение
  const emoji = LEVEL_EMOJI[level];
  const timestampStr = LOG_CONFIG.showTimestamp 
    ? `[${timestamp.toLocaleTimeString('ru-RU')}.${String(timestamp.getMilliseconds()).padStart(3, '0')}]` 
    : '';
  const durationStr = duration !== undefined && LOG_CONFIG.showDuration 
    ? ` (${duration}ms)` 
    : '';
  const style = LEVEL_STYLES[level];

  // Выводим в консоль
  _groupCollapsed(
    `%c${emoji} ${timestampStr} [${category}] ${action}${durationStr}`,
    style
  );
  
  if (data !== undefined) {
    _log('📦 Данные:', data);
  }
  
  _groupEnd();
}

/**
 * Логирование действия пользователя
 */
export function logUserAction(action: string, data?: unknown): void {
  log('info', 'UserAction', action, data);
}

/**
 * Логирование успешного действия
 */
export function logSuccess(category: string, action: string, data?: unknown, startTime?: number): void {
  log('success', category, action, data, startTime);
}

/**
 * Логирование ошибки
 */
export function logError(category: string, action: string, error: unknown, data?: unknown): void {
  _groupCollapsed(`%c❌ [${category}] ${action}`, LEVEL_STYLES.error);
  _error('🚨 Ошибка:', error);
  if (data) {
    _log('📦 Контекст:', data);
  }
  _groupEnd();
}

/**
 * Логирование предупреждения
 */
export function logWarning(category: string, action: string, data?: unknown): void {
  log('warning', category, action, data);
}

/**
 * Логирование отладочной информации
 */
export function logDebug(category: string, action: string, data?: unknown): void {
  log('debug', category, action, data);
}

/**
 * Начало операции с таймером
 */
export function logStart(category: string, action: string, data?: unknown): number {
  const startTime = Date.now();
  log('info', category, `⏳ Начало: ${action}`, data);
  return startTime;
}

/**
 * Завершение операции
 */
export function logEnd(category: string, action: string, startTime: number, data?: unknown): void {
  log('success', category, `✅ Завершено: ${action}`, data, startTime);
}

/**
 * Логирование API запроса
 */
export function logApiRequest(method: string, endpoint: string, data?: unknown): number {
  const startTime = Date.now();
  log('info', 'API', `→ ${method.toUpperCase()} ${endpoint}`, data);
  return startTime;
}

/**
 * Логирование успешного API ответа
 */
export function logApiSuccess(method: string, endpoint: string, startTime: number, data?: unknown): void {
  log('success', 'API', `← ${method.toUpperCase()} ${endpoint}`, data, startTime);
}

/**
 * Логирование ошибки API
 */
export function logApiError(method: string, endpoint: string, startTime: number, error: unknown): void {
  _groupCollapsed(
    `%c❌ [API] ← ${method.toUpperCase()} ${endpoint}`,
    LEVEL_STYLES.error
  );
  _error('🚨 Ошибка:', error);
  _log('⏱️ Время:', `${Date.now() - startTime}ms`);
  _groupEnd();
}

/**
 * Логирование изменения состояния
 */
export function logStateChange(component: string, change: string, newValue: unknown, oldValue?: unknown): void {
  _groupCollapsed(`%c🔄 [${component}] ${change}`, 'color: #9C27B0; font-weight: bold');
  if (oldValue !== undefined) {
    _log('📤 Было:', oldValue);
  }
  _log('📥 Стало:', newValue);
  _groupEnd();
}

/**
 * Логирование сохранения проекта
 */
export function logProjectSave(source: 'local' | 'server', projectId: string, roomsCount: number, startTime: number): void {
  const emoji = source === 'server' ? '☁️' : '💾';
  log(
    source === 'server' ? 'success' : 'info',
    'ProjectSave',
    `${emoji} Сохранение проекта на ${source === 'server' ? 'сервер' : 'локально'}`,
    { projectId, roomsCount },
    startTime
  );
}

/**
 * Получение истории действий (для отладки)
 */
export function getActionHistory(): LogEntry[] {
  return [...actionHistory];
}

/**
 * Вывод истории действий в консоль
 */
export function printActionHistory(): void {
  _group('📜 История действий');
  actionHistory.forEach((entry, index) => {
    const emoji = LEVEL_EMOJI[entry.level];
    _log(`${index + 1}. ${emoji} [${entry.category}] ${entry.action}`);
  });
  _groupEnd();
}

/**
 * Очистка истории
 */
export function clearActionHistory(): void {
  actionHistory.length = 0;
}

// Экспорт объекта для использования в консоли
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).debugLogger = {
    getHistory: getActionHistory,
    printHistory: printActionHistory,
    clearHistory: clearActionHistory,
  };
}

export default {
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
  logProjectSave,
  getActionHistory,
  printActionHistory,
  clearActionHistory,
};