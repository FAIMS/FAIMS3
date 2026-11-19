// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DB_TARGET_VERSIONS,
  DatabaseType,
  findStartupMigrationAheadReasons,
  formatStartupMigrationAheadSample,
  isNotebookUiSchemaMarker,
  isStartupMigrationClusterAhead,
  mergeNotebookUiSchemaMarkerVersion,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  NOTEBOOK_UI_SCHEMA_MARKER_KIND,
} from '../src';

describe('startupMigrationAhead', () => {
  const authTarget = DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion;
  const currentAuth = [
    {dbType: DatabaseType.AUTH, dbName: 'auth', version: authTarget},
  ];

  it('is not ahead when live versions match this process targets', () => {
    const input = {
      databases: currentAuth,
      notebookMarker: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    };

    expect(findStartupMigrationAheadReasons(input)).toEqual([]);
    expect(isStartupMigrationClusterAhead(input)).toBe(false);
    expect(
      formatStartupMigrationAheadSample(findStartupMigrationAheadReasons(input))
    ).toBeUndefined();
  });

  it('is ahead when a Couch DB version is past this process target', () => {
    const databases = [
      {dbType: DatabaseType.AUTH, dbName: 'auth', version: authTarget + 1},
    ];

    const reasons = findStartupMigrationAheadReasons({databases});
    expect(reasons).toEqual([
      {
        kind: 'db',
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        liveVersion: authTarget + 1,
        targetVersion: authTarget,
      },
    ]);
    expect(isStartupMigrationClusterAhead({databases})).toBe(true);
    expect(formatStartupMigrationAheadSample(reasons)).toBe(
      `auth:${authTarget + 1}>${authTarget}`
    );
  });

  it('is ahead when the notebook marker is newer than this process target', () => {
    const reasons = findStartupMigrationAheadReasons({
      databases: currentAuth,
      notebookMarker: '9.0.0',
      notebookTarget: '1.0.1',
    });
    expect(reasons).toEqual([
      {kind: 'notebook', liveVersion: '9.0.0', targetVersion: '1.0.1'},
    ]);
    expect(formatStartupMigrationAheadSample(reasons)).toBe(
      'notebook-ui-schema:9.0.0>1.0.1'
    );
  });

  it.each([
    ['equal', '1.0.1'],
    ['older', '1.0.0'],
    ['missing', undefined],
    ['non-semver', '7.0'],
    ['garbage', 'not-a-version'],
  ])('is not ahead when the notebook marker is %s', (_label, marker) => {
    expect(
      findStartupMigrationAheadReasons({
        databases: currentAuth,
        notebookMarker: marker,
        notebookTarget: '1.0.1',
      })
    ).toEqual([]);
  });

  it('reports DB reasons independently of the notebook marker', () => {
    const databases = [
      {dbType: DatabaseType.AUTH, dbName: 'auth', version: authTarget + 2},
    ];
    const dbReason = {
      kind: 'db',
      dbType: DatabaseType.AUTH,
      dbName: 'auth',
      liveVersion: authTarget + 2,
      targetVersion: authTarget,
    };

    expect(
      findStartupMigrationAheadReasons({
        databases,
        notebookMarker: '1.0.0',
        notebookTarget: '1.0.1',
      })
    ).toEqual([dbReason]);

    const both = findStartupMigrationAheadReasons({
      databases,
      notebookMarker: '2.0.0',
      notebookTarget: '1.0.1',
    });
    expect(both).toEqual([
      dbReason,
      {kind: 'notebook', liveVersion: '2.0.0', targetVersion: '1.0.1'},
    ]);
    expect(formatStartupMigrationAheadSample(both)).toBe(
      `auth:${authTarget + 2}>${authTarget},notebook-ui-schema:2.0.0>1.0.1`
    );
  });

  it('ignores unknown db types and behind versions', () => {
    expect(
      findStartupMigrationAheadReasons({
        databases: [
          {dbType: 'NOT_A_TYPE', dbName: 'mystery', version: 99},
          {dbType: DatabaseType.AUTH, dbName: 'auth', version: authTarget - 1},
        ],
      })
    ).toEqual([]);
  });
});

describe('notebook UI-schema marker helpers', () => {
  it('recognises the marker by id and kind', () => {
    expect(
      isNotebookUiSchemaMarker({
        _id: NOTEBOOK_UI_SCHEMA_MARKER_ID,
        kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
        schemaVersion: '1.0.0',
        updatedAtMs: 1,
      })
    ).toBe(true);
    expect(
      isNotebookUiSchemaMarker({_id: NOTEBOOK_UI_SCHEMA_MARKER_ID, kind: 'x'})
    ).toBe(false);
    expect(isNotebookUiSchemaMarker(null)).toBe(false);
  });

  it('never lowers the recorded version and replaces invalid values', () => {
    expect(mergeNotebookUiSchemaMarkerVersion(undefined, '1.0.1')).toBe(
      '1.0.1'
    );
    expect(mergeNotebookUiSchemaMarkerVersion('1.0.0', '1.0.1')).toBe('1.0.1');
    expect(mergeNotebookUiSchemaMarkerVersion('1.0.1', '1.0.1')).toBe('1.0.1');
    expect(mergeNotebookUiSchemaMarkerVersion('2.0.0', '1.0.1')).toBe('2.0.0');
    expect(mergeNotebookUiSchemaMarkerVersion('7.0', '1.0.1')).toBe('1.0.1');
    expect(mergeNotebookUiSchemaMarkerVersion(42, '1.0.1')).toBe('1.0.1');
  });
});
