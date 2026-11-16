// SPDX-License-Identifier: Apache-2.0
import {
  INPUT_LIMITS,
  MAP_ASSET_PRIMARY_FORMATS,
  MAP_ASSET_UPLOAD_ACCEPT,
  mapAssetGeoreferencedImageCompanionIssue,
  mapAssetUploadTooLargeMessage,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {MAP_LAYER_FILE_ACCEPT, mapLayerFilesSchema} from './map-layer-files';

const schema = mapLayerFilesSchema();

function file(name: string, size = 1) {
  return new File([new Uint8Array(size)], name, {
    type: 'application/octet-stream',
  });
}

function issue(files: File[]) {
  const parsed = schema.safeParse(files);
  expect(parsed.success).toBe(false);
  if (parsed.success) {
    throw new Error('expected schema failure');
  }
  return parsed.error.issues[0]?.message;
}

describe('map layer file schema', () => {
  it('reuses the shared accept list', () => {
    expect(MAP_LAYER_FILE_ACCEPT).toBe(MAP_ASSET_UPLOAD_ACCEPT);
  });

  it('requires a map file', () => {
    expect(issue([])).toBe('Choose a map file.');
  });

  it('caps the number of files', () => {
    const files = Array.from(
      {length: INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES + 1},
      (_, i) => file(`layer${i}.geojson`)
    );
    expect(issue(files)).toBe(
      `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`
    );
  });

  it('rejects an unsupported extension and a companion-only set', () => {
    expect(issue([file('notes.txt')])).toBe('Unsupported file type .txt.');
    expect(issue([file('plan.prj')])).toBe(
      `Include ${MAP_ASSET_PRIMARY_FORMATS}.`
    );
  });

  it('requires a world file and .prj beside a PNG', () => {
    expect(issue([file('plan.png')])).toBe(
      mapAssetGeoreferencedImageCompanionIssue(['.png'])
    );
    expect(
      schema.safeParse([file('plan.png'), file('plan.pgw'), file('plan.prj')])
        .success
    ).toBe(true);
  });

  it('accepts a GeoJSON primary', () => {
    expect(schema.safeParse([file('sites.geojson')]).success).toBe(true);
  });

  it('rejects a payload over the shared size cap', () => {
    const oversized = file('sites.geojson');
    Object.defineProperty(oversized, 'size', {
      value: INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES + 1,
    });
    expect(issue([oversized])).toBe(mapAssetUploadTooLargeMessage());
  });
});
