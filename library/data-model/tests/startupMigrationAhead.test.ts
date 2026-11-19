// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DB_TARGET_VERSIONS,
  DatabaseType,
  findStartupMigrationAheadReasons,
  formatStartupMigrationAheadSample,
  isStartupMigrationClusterAhead,
} from '../src';

describe('startupMigrationAhead', () => {
  it('is not ahead when live versions match this process targets', () => {
    const databases = [
      {
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        version: DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion,
      },
    ];
    const notebooks = [
      {
        kind: 'project' as const,
        id: 'survey-1',
        schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      },
    ];

    expect(findStartupMigrationAheadReasons({databases, notebooks})).toEqual(
      []
    );
    expect(isStartupMigrationClusterAhead({databases, notebooks})).toBe(false);
    expect(
      formatStartupMigrationAheadSample(
        findStartupMigrationAheadReasons({databases, notebooks})
      )
    ).toBeUndefined();
  });

  it('is ahead when a Couch DB version is past this process target', () => {
    const targetVersion = DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion;
    const databases = [
      {
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        version: targetVersion + 1,
      },
    ];

    const reasons = findStartupMigrationAheadReasons({databases});
    expect(reasons).toEqual([
      {
        kind: 'db',
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        liveVersion: targetVersion + 1,
        targetVersion,
      },
    ]);
    expect(isStartupMigrationClusterAhead({databases})).toBe(true);
    expect(formatStartupMigrationAheadSample(reasons)).toBe(
      `auth:${targetVersion + 1}>${targetVersion}`
    );
  });

  it('is ahead when a notebook schemaVersion is past this process target', () => {
    const notebooks = [
      {
        kind: 'template' as const,
        id: 'tmpl-1',
        schemaVersion: '9.0.0',
      },
    ];

    const reasons = findStartupMigrationAheadReasons({
      databases: [],
      notebooks,
    });
    expect(reasons).toEqual([
      {
        kind: 'notebook',
        notebookKind: 'template',
        id: 'tmpl-1',
        liveVersion: '9.0.0',
        targetVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      },
    ]);
    expect(isStartupMigrationClusterAhead({databases: [], notebooks})).toBe(
      true
    );
  });

  it('ignores unknown db types, behind versions, and legacy notebook versions', () => {
    expect(
      findStartupMigrationAheadReasons({
        databases: [
          {dbType: 'NOT_A_TYPE', dbName: 'mystery', version: 99},
          {
            dbType: DatabaseType.AUTH,
            dbName: 'auth',
            version: DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion - 1,
          },
        ],
        notebooks: [
          {kind: 'project', id: 'legacy', schemaVersion: '7.0'},
          {kind: 'project', id: 'missing', schemaVersion: undefined},
        ],
      })
    ).toEqual([]);
  });
});
