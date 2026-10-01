// SPDX-License-Identifier: Apache-2.0
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {StartupMigrationLockOptions} from '../src/couchdb/startupMigrationLock';

const getMigrationDb = vi.hoisted(() => vi.fn());
const initialiseAndMigrateDBs = vi.hoisted(() => vi.fn());
const validateDatabases = vi.hoisted(() => vi.fn());
const withStartupMigrationLock = vi.hoisted(() => vi.fn());
const configMock = vi.hoisted(() => ({
  startupMigrationLockTimeoutMs: 12_345,
}));

vi.mock('../src/buildconfig', () => ({
  config: configMock,
}));

vi.mock('../src/couchdb', () => ({
  getMigrationDb,
  initialiseAndMigrateDBs,
}));

vi.mock('../src/couchdb/validateDatabases', () => ({
  validateDatabases,
}));

vi.mock('../src/couchdb/startupMigrationLock', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../src/couchdb/startupMigrationLock')
    >();
  withStartupMigrationLock.mockImplementation(actual.withStartupMigrationLock);
  return {
    ...actual,
    withStartupMigrationLock,
  };
});

import {runStartupMigrations} from '../src/couchdb/startupMigrations';

describe('runStartupMigrations', () => {
  const lockDb = {get: vi.fn(), put: vi.fn()};

  beforeEach(() => {
    getMigrationDb.mockReset();
    initialiseAndMigrateDBs.mockReset();
    validateDatabases.mockReset();
    withStartupMigrationLock.mockReset();
    withStartupMigrationLock.mockImplementation(async options => {
      await options.run();
      return {role: 'doer', status: 'complete'};
    });
    getMigrationDb.mockReturnValue(lockDb);
    initialiseAndMigrateDBs.mockResolvedValue(undefined);
    validateDatabases.mockResolvedValue({valid: true});
    configMock.startupMigrationLockTimeoutMs = 12_345;
  });

  it('passes config timeout and migrate-with-keys flags, then validateDatabases', async () => {
    await expect(runStartupMigrations()).resolves.toBeUndefined();

    expect(getMigrationDb).toHaveBeenCalledOnce();
    expect(withStartupMigrationLock).toHaveBeenCalledOnce();
    const options = withStartupMigrationLock.mock
      .calls[0]?.[0] as StartupMigrationLockOptions;
    expect(options.db).toBe(lockDb);
    expect(options.timeoutMs).toBe(12_345);
    expect(options.instanceId).toContain(`:${process.pid}:`);

    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledWith({
      force: true,
      pushKeys: true,
    });
    expect(validateDatabases).toHaveBeenCalledOnce();
    expect(initialiseAndMigrateDBs.mock.invocationCallOrder[0]).toBeLessThan(
      validateDatabases.mock.invocationCallOrder[0]!
    );
  });

  it('does not walk notebooks if Couch migrate throws, and still resolves', async () => {
    initialiseAndMigrateDBs.mockRejectedValueOnce(
      new Error('migrate exploded')
    );

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(validateDatabases).not.toHaveBeenCalled();
  });

  it('swallows a lock throw so listen can proceed', async () => {
    withStartupMigrationLock.mockRejectedValueOnce(new Error('couch down'));

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(initialiseAndMigrateDBs).not.toHaveBeenCalled();
    expect(validateDatabases).not.toHaveBeenCalled();
  });
});
