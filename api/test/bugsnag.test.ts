// SPDX-License-Identifier: Apache-2.0
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const start = vi.fn();
const getPlugin = vi.fn();

vi.mock('@bugsnag/js', () => ({
  default: {
    start,
    getPlugin,
  },
}));

vi.mock('@bugsnag/plugin-express', () => ({
  default: {name: 'express'},
}));

const configMock = vi.hoisted(() => ({
  bugsnagApiKey: 'test-key',
  apiVersion: '1.11.0',
}));

vi.mock('../src/buildconfig', () => ({
  config: configMock,
}));

vi.mock('../src/logging', () => ({
  shouldReportErrorToBugsnag: () => true,
}));

describe('startBugsnag', () => {
  beforeEach(() => {
    vi.resetModules();
    start.mockReset();
    configMock.bugsnagApiKey = 'test-key';
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('starts Bugsnag once and is idempotent', async () => {
    const {startBugsnag} = await import('../src/bugsnag');
    expect(startBugsnag()).toBe(true);
    expect(startBugsnag()).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        appVersion: '1.11.0',
      })
    );
  });

  it('does not start when no API key is set', async () => {
    configMock.bugsnagApiKey = '';
    const {startBugsnag} = await import('../src/bugsnag');
    expect(startBugsnag()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
