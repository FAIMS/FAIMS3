import {$, expect} from '@wdio/globals';

/**
 * Locate an element by exact data-testid.
 */
export function byTestId(testId: string) {
  return $(`[data-testid="${testId}"]`);
}

/**
 * Set a React-controlled `datetime-local` to `YYYY-MM-DDTHH:MM`.
 *
 * Chrome's picker is segmented; WebdriverIO `setValue` / sendKeys does not
 * commit that string or fire React `onChange`. Export tests then send no
 * `updatedAfter` / `updatedBefore`, and an invalid leftover value can block
 * HTML form submit (zero intercepted export URLs).
 */
export async function setDateTimeLocal(testId: string, value: string) {
  const el = byTestId(testId);
  await el.waitForDisplayed();
  await el.execute((input, next) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (!setter) {
      throw new Error('HTMLInputElement value setter is missing');
    }
    setter.call(input, next);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
  await expect(el).toHaveValue(value);
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
