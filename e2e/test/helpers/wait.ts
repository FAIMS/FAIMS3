import {browser} from '@wdio/globals';
import {byTestId} from './selectors.ts';

const DEFAULT_TIMEOUT = 15000;

/**
 * Wait until the current URL matches a substring or predicate.
 */
export async function waitForUrl(
  match: string | RegExp | ((url: string) => boolean),
  options: {timeout?: number; timeoutMsg?: string} = {}
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  await browser.waitUntil(
    async () => {
      const url = await browser.getUrl();
      if (typeof match === 'string') return url.includes(match);
      if (match instanceof RegExp) return match.test(url);
      return match(url);
    },
    {
      timeout,
      timeoutMsg:
        options.timeoutMsg ??
        `Expected URL to match ${String(match)} within ${timeout}ms`,
    }
  );
  return browser.getUrl();
}

/**
 * Wait until an element with the given data-testid is displayed.
 */
export async function waitForTestId(
  testId: string,
  options: {timeout?: number; timeoutMsg?: string} = {}
) {
  const el = byTestId(testId);
  await el.waitForDisplayed({
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    timeoutMsg:
      options.timeoutMsg ??
      `Expected [data-testid="${testId}"] to be displayed`,
  });
  return el;
}

/**
 * Wait until an element with the given data-testid is gone / not displayed.
 */
export async function waitForGone(
  testId: string,
  options: {timeout?: number; timeoutMsg?: string} = {}
) {
  const el = byTestId(testId);
  await el.waitForDisplayed({
    reverse: true,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    timeoutMsg:
      options.timeoutMsg ?? `Expected [data-testid="${testId}"] to disappear`,
  });
}

/**
 * Lightweight idle wait: document.readyState complete + short settle.
 * Prefer waitForTestId / waitForUrl over this when possible.
 */
export async function waitForNetworkIdle(
  options: {timeout?: number; settleMs?: number} = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  await browser.waitUntil(
    () => browser.execute(() => document.readyState === 'complete'),
    {
      timeout,
      timeoutMsg: 'document.readyState did not become complete',
    }
  );
  const settleMs = options.settleMs ?? 250;
  if (settleMs > 0) {
    // Documented animation/settle only — prefer explicit waits elsewhere.
    await browser.pause(settleMs);
  }
}
