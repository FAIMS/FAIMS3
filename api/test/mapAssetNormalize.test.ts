// SPDX-License-Identifier: Apache-2.0
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
});
