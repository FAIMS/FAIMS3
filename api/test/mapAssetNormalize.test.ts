// SPDX-License-Identifier: Apache-2.0
import {INPUT_LIMITS} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  isPointOnlyOgrInfo,
  simplificationReducedSize,
} from '../src/couchdb/mapAssets/normalize';
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

describe('isPointOnlyOgrInfo', () => {
  it('accepts Point and Multi Point layers', () => {
    expect(
      isPointOnlyOgrInfo({
        layers: [
          {geometryFields: [{type: 'Point'}]},
          {geometryFields: [{type: 'Multi Point'}]},
        ],
      })
    ).toBe(true);
    expect(
      isPointOnlyOgrInfo({
        layers: [{geometryFields: [{type: '3D Point'}]}],
      })
    ).toBe(true);
  });

  it('rejects mixed or unknown geometry types', () => {
    expect(
      isPointOnlyOgrInfo({
        layers: [{geometryFields: [{type: 'Line String'}]}],
      })
    ).toBe(false);
    expect(
      isPointOnlyOgrInfo({
        layers: [{geometryFields: [{type: 'Geometry'}]}],
      })
    ).toBe(false);
    expect(
      isPointOnlyOgrInfo({
        layers: [
          {geometryFields: [{type: 'Point'}]},
          {geometryFields: [{type: 'Polygon'}]},
        ],
      })
    ).toBe(false);
  });

  it('rejects missing layer or geometry type info', () => {
    expect(isPointOnlyOgrInfo(undefined)).toBe(false);
    expect(isPointOnlyOgrInfo({layers: []})).toBe(false);
    expect(isPointOnlyOgrInfo({layers: [{}]})).toBe(false);
  });
});

describe('simplificationReducedSize', () => {
  it('requires at least 1% or 1 KB saved', () => {
    expect(simplificationReducedSize(10_000_000, 9_800_000)).toBe(true);
    expect(simplificationReducedSize(10_000_000, 9_950_000)).toBe(false);
    expect(simplificationReducedSize(2_000, 500)).toBe(true);
    expect(simplificationReducedSize(2_000, 1_500)).toBe(false);
  });

  it('treats equal or larger output as no improvement', () => {
    expect(simplificationReducedSize(5_000_000, 5_000_000)).toBe(false);
    expect(simplificationReducedSize(5_000_000, 5_100_000)).toBe(false);
  });
});
