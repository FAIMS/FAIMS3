// SPDX-License-Identifier: Apache-2.0
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {StartupMigrationLockOptions} from '../src/couchdb/startupMigrationLock';

const getMigrationDbStore = vi.hoisted(() => vi.fn());
const initialiseAndMigrateDBs = vi.hoisted(() => vi.fn());
const validateDatabases = vi.hoisted(() => vi.fn());
const withStartupMigrationLock = vi.hoisted(() => vi.fn());
const getStartupMigrationFingerprint = vi.hoisted(() => vi.fn());
const isStartupMigrationClusterAhead = vi.hoisted(() => vi.fn());
const writeNotebookSchemaMarker = vi.hoisted(() => vi.fn());
const PROCESS_FINGERPRINT = 'aabbccddeeff';
const configMock = vi.hoisted(() => ({
  disableMigrateOnStartup: false,
  startupMigrationLockEnabled: true,
  startupMigrationLockTimeoutMs: 12_345,
  apiVersion: '1.11.0',
}));

vi.mock('../src/buildconfig', () => ({
  config: configMock,
}));

vi.mock('../src/couchdb', () => ({
  getMigrationDbStore,
  initialiseAndMigrateDBs,
}));

vi.mock('../src/couchdb/validateDatabases', () => ({
  validateDatabases,
}));

vi.mock('../src/couchdb/startupMigrationFingerprint', () => ({
  getStartupMigrationFingerprint,
}));

vi.mock('../src/couchdb/startupMigrationAhead', () => ({
  isStartupMigrationClusterAhead,
}));

vi.mock('../src/couchdb/notebookSchemaMarker', () => ({
  writeNotebookSchemaMarker,
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
    getMigrationDbStore.mockReset();
    initialiseAndMigrateDBs.mockReset();
    validateDatabases.mockReset();
    withStartupMigrationLock.mockReset();
    getStartupMigrationFingerprint.mockReset();
    writeNotebookSchemaMarker.mockReset();
    writeNotebookSchemaMarker.mockResolvedValue({
      written: true,
      schemaVersion: '1.0.1',
    });
    withStartupMigrationLock.mockImplementation(async options => {
      await options.run();
      return {role: 'doer', status: 'complete'};
    });
    getStartupMigrationFingerprint.mockResolvedValue(PROCESS_FINGERPRINT);
    getMigrationDbStore.mockReturnValue(lockDb);
    initialiseAndMigrateDBs.mockResolvedValue(undefined);
    validateDatabases.mockResolvedValue({valid: true});
    configMock.disableMigrateOnStartup = false;
    configMock.startupMigrationLockEnabled = true;
    configMock.startupMigrationLockTimeoutMs = 12_345;
    configMock.apiVersion = '1.11.0';
  });

  it('passes config timeout and migrate-with-keys flags, then validateDatabases', async () => {
    await expect(runStartupMigrations()).resolves.toBeUndefined();

    expect(withStartupMigrationLock).toHaveBeenCalledOnce();
    const options = withStartupMigrationLock.mock
      .calls[0]?.[0] as StartupMigrationLockOptions;
    expect(options.db).toBe(lockDb);
    expect(options.timeoutMs).toBe(12_345);
    expect(options.instanceId).toContain(`:${process.pid}:`);
    expect(options.fingerprint).toBe(PROCESS_FINGERPRINT);
    expect(options.apiVersion).toBe('1.11.0');
    expect(options.isClusterAhead).toBe(isStartupMigrationClusterAhead);
    expect(getStartupMigrationFingerprint).toHaveBeenCalledOnce();

    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledWith({
      force: true,
      pushKeys: true,
      setupDiagnostics: {
        fingerprint: PROCESS_FINGERPRINT,
        apiVersion: '1.11.0',
        writerId: expect.stringContaining(`:${process.pid}:`),
      },
    });
    expect(validateDatabases).toHaveBeenCalledOnce();
    expect(initialiseAndMigrateDBs.mock.invocationCallOrder[0]).toBeLessThan(
      validateDatabases.mock.invocationCallOrder[0]!
    );
  });

  it('writes the notebook marker after a successful walk', async () => {
    await expect(runStartupMigrations()).resolves.toBeUndefined();

    expect(writeNotebookSchemaMarker).toHaveBeenCalledOnce();
    expect(writeNotebookSchemaMarker).toHaveBeenCalledWith(
      expect.objectContaining({
        db: lockDb,
        fingerprint: PROCESS_FINGERPRINT,
        apiVersion: '1.11.0',
        writerId: expect.stringContaining(`:${process.pid}:`),
      })
    );
    expect(validateDatabases.mock.invocationCallOrder[0]).toBeLessThan(
      writeNotebookSchemaMarker.mock.invocationCallOrder[0]!
    );
  });

  it('does not write the marker when the notebook walk throws', async () => {
    validateDatabases.mockRejectedValueOnce(new Error('walk exploded'));

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(writeNotebookSchemaMarker).not.toHaveBeenCalled();
  });

  it('logs a marker write failure without failing the migration', async () => {
    writeNotebookSchemaMarker.mockRejectedValueOnce(new Error('couch blip'));
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });
    let runResult: Promise<void> | undefined;
    withStartupMigrationLock.mockImplementationOnce(async options => {
      runResult = options.run();
      await runResult;
      return {role: 'doer', status: 'complete'};
    });

    try {
      await expect(runStartupMigrations()).resolves.toBeUndefined();
      await expect(runResult).resolves.toBeUndefined();
      expect(
        logs.some(line => line.includes('notebook_schema_marker_write_failed'))
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not walk notebooks if Couch migrate throws, and still resolves', async () => {
    initialiseAndMigrateDBs.mockRejectedValueOnce(
      new Error('migrate exploded')
    );

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(validateDatabases).not.toHaveBeenCalled();
    expect(writeNotebookSchemaMarker).not.toHaveBeenCalled();
  });

  it('swallows a lock throw so listen can proceed', async () => {
    withStartupMigrationLock.mockRejectedValueOnce(new Error('couch down'));

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(initialiseAndMigrateDBs).not.toHaveBeenCalled();
    expect(validateDatabases).not.toHaveBeenCalled();
  });

  it('skips the lock and still migrates when the lock is disabled', async () => {
    configMock.startupMigrationLockEnabled = false;

    await expect(runStartupMigrations()).resolves.toBeUndefined();

    expect(withStartupMigrationLock).not.toHaveBeenCalled();
    expect(getStartupMigrationFingerprint).not.toHaveBeenCalled();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledWith({
      force: true,
      pushKeys: true,
      setupDiagnostics: {
        fingerprint: undefined,
        apiVersion: '1.11.0',
        writerId: expect.stringContaining(`:${process.pid}:`),
      },
    });
    expect(validateDatabases).toHaveBeenCalledOnce();
    expect(writeNotebookSchemaMarker).toHaveBeenCalledOnce();
    expect(writeNotebookSchemaMarker).toHaveBeenCalledWith(
      expect.objectContaining({db: lockDb, fingerprint: undefined})
    );
  });

  it('skips migrate and the lock when DISABLE_MIGRATE_ON_STARTUP is set', async () => {
    configMock.disableMigrateOnStartup = true;

    await expect(runStartupMigrations()).resolves.toBeUndefined();

    expect(withStartupMigrationLock).not.toHaveBeenCalled();
    expect(getStartupMigrationFingerprint).not.toHaveBeenCalled();
    expect(getMigrationDbStore).not.toHaveBeenCalled();
    expect(initialiseAndMigrateDBs).not.toHaveBeenCalled();
    expect(validateDatabases).not.toHaveBeenCalled();
  });

  it('still resolves when the lock is disabled and migrate throws', async () => {
    configMock.startupMigrationLockEnabled = false;
    initialiseAndMigrateDBs.mockRejectedValueOnce(
      new Error('migrate exploded')
    );

    await expect(runStartupMigrations()).resolves.toBeUndefined();
    expect(withStartupMigrationLock).not.toHaveBeenCalled();
    expect(initialiseAndMigrateDBs).toHaveBeenCalledOnce();
    expect(validateDatabases).not.toHaveBeenCalled();
  });
});
