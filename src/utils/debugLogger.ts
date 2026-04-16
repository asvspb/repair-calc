/**
 * Simple debug logger that survives production minification.
 * Always enabled — useful for tracking project creation flow.
 */

const _c = typeof console !== 'undefined' ? console : undefined as unknown as Console;

function bindConsole(method: 'log' | 'error'): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    if (_c && typeof _c[method] === 'function') {
      (_c[method] as (...a: unknown[]) => void)(...args);
    }
  };
}

const _log = bindConsole('log');
const _err = bindConsole('error');

export const dlog = (prefix: string, ...args: unknown[]) => {
  _log(`%c${prefix}`, 'color: #6366f1; font-weight: bold;', ...args);
};

export const derror = (prefix: string, ...args: unknown[]) => {
  _err(`%c${prefix}`, 'color: #ef4444; font-weight: bold;', ...args);
};
