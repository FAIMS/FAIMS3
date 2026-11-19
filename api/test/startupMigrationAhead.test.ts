// SPDX-License-Identifier: Apache-2.0
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DatabaseType,
} from '@faims3/data-model';
import {STARTUP_MIGRATION_LOCK_ID} from '../src/couchdb/startupMigrationLock';

const getMigrationDb = vi.hoisted(() => vi.fn());
const getAllProjectsListing = vi.hoisted(() => vi.fn());
const getTemplates = vi.hoisted(() => vi.fn());

vi.mock('../src/couchdb', () => ({
  getMigrationDb,
}));

vi.mock('../src/couchdb/notebooks', () => ({
  getAllProjectsListing,
}));

vi.mock('../src/couchdb/templates', () => ({
  getTemplates,
}));

import {
  isStartupMigrationClusterAhead,
  readStartupMigrationAheadReasons,
} from '../src/couchdb/startupMigrationAhead';

function allDocs(docs: Array<{_id: string} & Record<string, unknown>>) {
  return {
    rows: docs.map(doc => ({id: doc._id, doc})),
  };
}

describe('startupMigrationAhead', () => {
  beforeEach(() => {
    getMigrationDb.mockReset();
    getAllProjectsListing.mockReset();
    getTemplates.mockReset();
    getAllProjectsListing.mockResolvedValue([]);
    getTemplates.mockResolvedValue([]);
  });

  it('ignores the lock document and design docs when reading migration versions', async () => {
    getMigrationDb.mockReturnValue({
      allDocs: vi.fn(async () =>
        allDocs([
          {_id: '_design/migrations', dbType: DatabaseType.AUTH, version: 99},
          {
            _id: STARTUP_MIGRATION_LOCK_ID,
            kind: 'startup-migration-lock',
            version: 99,
          },
          {
            _id: 'mig-auth',
            dbType: DatabaseType.AUTH,
            dbName: 'auth',
            version: 1,
          },
        ])
      ),
    });

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([]);
    await expect(isStartupMigrationClusterAhead()).resolves.toBe(false);
  });

  it('is ahead when a live notebook schema is past this process', async () => {
    getMigrationDb.mockReturnValue({
      allDocs: vi.fn(async () => allDocs([])),
    });
    getAllProjectsListing.mockResolvedValue([
      {
        _id: 'survey-1',
        uiSpecProperties: {schemaVersion: '9.0.0'},
      },
    ]);

    const reasons = await readStartupMigrationAheadReasons();
    expect(reasons).toEqual([
      {
        kind: 'notebook',
        notebookKind: 'project',
        id: 'survey-1',
        liveVersion: '9.0.0',
        targetVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      },
    ]);
    await expect(isStartupMigrationClusterAhead()).resolves.toBe(true);
  });
});
