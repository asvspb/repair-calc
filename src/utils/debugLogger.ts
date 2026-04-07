/**
 * Simple debug logger that survives production minification.
 * Always enabled — useful for tracking project creation flow.
 */

// Use a reference that esbuild can't statically analyze
const _log = typeof console !== 'undefined' ? console.log.bind(console) : () => {};
const _err = typeof console !== 'undefined' ? console.error.bind(console) : () => {};

export const dlog = (prefix: string, ...args: unknown[]) => {
  _log(`%c${prefix}`, 'color: #6366f1; font-weight: bold;', ...args);
};

export const derror = (prefix: string, ...args: unknown[]) => {
  _err(`%c${prefix}`, 'color: #ef4444; font-weight: bold;', ...args);
};
