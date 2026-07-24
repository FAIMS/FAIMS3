import {$} from '@wdio/globals';

/**
 * Locate an element by exact data-testid.
 */
export function byTestId(testId: string) {
  return $(`[data-testid="${testId}"]`);
}

/**
 * Locate an element whose data-testid contains the given substring.
 */
export function byTestIdContaining(partial: string) {
  return $(`[data-testid*="${partial}"]`);
}

/**
 * CSS attribute selector string for a testid (for chaining / waitUntil).
 */
export function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}
