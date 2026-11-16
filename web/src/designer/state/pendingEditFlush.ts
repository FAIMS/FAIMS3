// SPDX-License-Identifier: Apache-2.0

/**
 * @file Registry of pending DebouncedTextField / ExpressionEditor lodash timers.
 * Autosave and publish flush these so the last keystrokes are serialised without
 * an extra blur.
 */

const flushers = new Set<() => void>();

/**
 * Register a flush callback for a mounted debounced editor.
 *
 * @returns Unregister function (call on unmount).
 */
export function registerPendingEditFlush(flush: () => void): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/**
 * Flush every registered DebouncedTextField / ExpressionEditor timer so the
 * Redux store (and therefore draft/publish JSON) includes the latest keystrokes.
 */
export function flushPendingDesignerEdits(): void {
  for (const flush of flushers) {
    flush();
  }
}
