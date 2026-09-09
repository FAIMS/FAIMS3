import {describe, expect, it, vi} from 'vitest';
import PouchDB from 'pouchdb-browser';
import {
  createPouchDbReplication,
  normalizeChangeSyncInfo,
} from './databaseHelpers';
import {PouchDBWrapper} from './pouchDBWrapper';

/**
 * The last handle each PouchDB factory produced, so tests can assert WHICH
 * emitter a handler was attached to. The two-way sync handle carries its
 * `push`/`pull` children, matching PouchDB's real shape.
 */
const mocks = vi.hoisted(() => ({
  handles: {} as {
    sync?: {
      on: ReturnType<typeof vi.fn>;
      push: {on: ReturnType<typeof vi.fn>};
      pull: {on: ReturnType<typeof vi.fn>};
    };
    replicate?: {on: ReturnType<typeof vi.fn>};
  },
}));

vi.mock('pouchdb-browser', () => {
  const sync = vi.fn(() => {
    const handle = {
      on: vi.fn().mockReturnThis(),
      push: {on: vi.fn().mockReturnThis()},
      pull: {on: vi.fn().mockReturnThis()},
    };
    mocks.handles.sync = handle;
    return handle;
  });
  const replicate = vi.fn(() => {
    const handle = {on: vi.fn().mockReturnThis()};
    mocks.handles.replicate = handle;
    return handle;
  });
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

  describe('pullPaused routing', () => {
    const paused = vi.fn();
    const pullPaused = vi.fn();

    it('attaches pullPaused to the pull child in both mode, never the aggregate', () => {
      // The aggregate strips the child's error, so an offline device would
      // look idle-and-finished there.
      createPouchDbReplication({
        syncMode: 'both',
        attachmentDownload: false,
        localDb,
        remoteDb,
        eventHandlers: {paused, pullPaused},
      });
      const handle = mocks.handles.sync!;
      expect(handle.pull.on).toHaveBeenCalledWith('paused', pullPaused);
      expect(handle.on).toHaveBeenCalledWith('paused', paused);
      expect(handle.on).not.toHaveBeenCalledWith('paused', pullPaused);
      expect(handle.push.on).not.toHaveBeenCalledWith('paused', pullPaused);
    });

    it('attaches pullPaused to the handle itself in pull mode', () => {
      // A one-way pull replication is its own pull side.
      createPouchDbReplication({
        syncMode: 'pull',
        attachmentDownload: false,
        localDb,
        remoteDb,
        eventHandlers: {pullPaused},
      });
      expect(mocks.handles.replicate!.on).toHaveBeenCalledWith(
        'paused',
        pullPaused
      );
    });

    it('never attaches pullPaused in push mode (there is no pull side)', () => {
      createPouchDbReplication({
        syncMode: 'push',
        attachmentDownload: false,
        localDb,
        remoteDb,
        eventHandlers: {pullPaused},
      });
      expect(mocks.handles.replicate!.on).not.toHaveBeenCalledWith(
        'paused',
        pullPaused
      );
    });
  });
});
