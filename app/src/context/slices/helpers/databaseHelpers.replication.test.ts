import {describe, expect, it, vi} from 'vitest';
import PouchDB from 'pouchdb-browser';
import {
  createPouchDbReplication,
  normalizeChangeSyncInfo,
} from './databaseHelpers';
import {PouchDBWrapper} from './pouchDBWrapper';

vi.mock('pouchdb-browser', () => {
  const sync = vi.fn(() => ({on: vi.fn().mockReturnThis()}));
  const replicate = vi.fn(() => ({on: vi.fn().mockReturnThis()}));
  return {
    default: {sync, replicate},
  };
});

describe('normalizeChangeSyncInfo', () => {
  const replicateChange = {
    ok: true,
    start_time: '2025-01-01T00:00:00.000Z',
    docs_read: 2,
    docs_written: 1,
    doc_write_failures: 0,
    errors: [],
    last_seq: 3,
    pending: 4,
  };

  it('wraps one-way replicate() change events', () => {
    expect(normalizeChangeSyncInfo(replicateChange, 'push')).toEqual({
      direction: 'push',
      change: replicateChange,
    });
  });

  it('passes through two-way sync() change events', () => {
    const syncChange = {
      direction: 'pull' as const,
      change: replicateChange,
    };
    expect(normalizeChangeSyncInfo(syncChange, 'push')).toEqual(syncChange);
  });
});

describe('createPouchDbReplication', () => {
  const localDb = {db: {name: 'local'}} as unknown as PouchDBWrapper<{}>;
  const remoteDb = {name: 'remote'} as unknown as PouchDB.Database<{}>;

  it('uses PouchDB.sync for both mode', () => {
    createPouchDbReplication({
      syncMode: 'both',
      attachmentDownload: false,
      localDb,
      remoteDb,
    });
    expect(PouchDB.sync).toHaveBeenCalled();
  });

  it('uses PouchDB.replicate local→remote for push mode', () => {
    createPouchDbReplication({
      syncMode: 'push',
      attachmentDownload: false,
      localDb,
      remoteDb,
    });
    expect(PouchDB.replicate).toHaveBeenCalledWith(
      localDb.db,
      remoteDb,
      expect.objectContaining({live: true})
    );
  });

  it('uses PouchDB.replicate remote→local for pull mode', () => {
    createPouchDbReplication({
      syncMode: 'pull',
      attachmentDownload: false,
      localDb,
      remoteDb,
    });
    expect(PouchDB.replicate).toHaveBeenCalledWith(
      remoteDb,
      localDb.db,
      expect.objectContaining({live: true})
    );
  });
});
