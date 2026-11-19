// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {DbSetupEvent} from '@faims3/data-model';
import {
  createDbSetupRunLogger,
  handleDbSetupEvent,
} from '../src/couchdb/dbSetupLog';

const logError = vi.hoisted(() => vi.fn());

vi.mock('../src/logging', () => ({
  logError,
}));

const ahead = (dbName: string): DbSetupEvent => ({
  setupType: 'PEOPLE',
  dbName,
  part: 'design',
  action: 'ahead',
  recordedVersion: 9,
  recordedHash: 'old',
  targetVersion: 1,
  targetHash: 'new',
});

describe('dbSetupLog', () => {
  afterEach(() => {
    logError.mockReset();
    vi.restoreAllMocks();
  });

  it('logs patch and upgrade without notifying Bugsnag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    handleDbSetupEvent({
      ...ahead('people'),
      action: 'patch',
      recordedVersion: 1,
    });
    handleDbSetupEvent({
      ...ahead('people'),
      action: 'upgrade',
      recordedVersion: 0,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    expect(logError).not.toHaveBeenCalled();
  });

  it('aggregates ahead events into one logError', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createDbSetupRunLogger();
    logger.onEvent(ahead('people'));
    logger.onEvent(ahead('auth'));
    expect(logError).not.toHaveBeenCalled();
    logger.flush();
    expect(error).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledOnce();
    expect(String(logError.mock.calls[0]?.[0])).toMatch(
      /ahead of this build \(2\)/
    );
  });
});
