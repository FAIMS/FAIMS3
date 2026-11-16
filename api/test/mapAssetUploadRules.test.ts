// SPDX-License-Identifier: Apache-2.0
import {INPUT_LIMITS} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  assertUploadCompanions,
  primaryUploadFile,
} from '../src/couchdb/mapAssets/uploadRules';

const bytes = Buffer.from('x');

describe('map asset upload rules', () => {
  it('accepts a GeoJSON file as the primary upload', () => {
    const primary = primaryUploadFile([{filename: 'sites.geojson', bytes}]);
    expect(primary.filename).toBe('sites.geojson');
  });

  it('accepts a zipped File Geodatabase as the primary upload', () => {
    const primary = primaryUploadFile([{filename: 'bores.gdb.zip', bytes}]);
    expect(primary.filename).toBe('bores.gdb.zip');
  });

  it('requires a world file and a .prj beside a PNG', () => {
    expect(() =>
      assertUploadCompanions([{filename: 'plan.png', bytes}])
    ).toThrow(/world file/);
    expect(() =>
      assertUploadCompanions([
        {filename: 'plan.png', bytes},
        {filename: 'plan.pgw', bytes},
        {filename: 'plan.prj', bytes},
      ])
    ).not.toThrow();
  });

  it('rejects an upload with no recognised map file', () => {
    expect(() => primaryUploadFile([{filename: 'notes.txt', bytes}])).toThrow(
      /GeoJSON/
    );
  });

  it('rejects an oversized filename', () => {
    expect(() =>
      primaryUploadFile([
        {
          filename: `${'a'.repeat(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH + 1)}.geojson`,
          bytes,
        },
      ])
    ).toThrow(/at most/);
  });
});
