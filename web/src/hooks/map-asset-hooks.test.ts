// SPDX-License-Identifier: Apache-2.0
import {
  DEFAULT_MAP_ASSET_STYLE,
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  type ExistingMapAsset,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  formatAssetStatus,
  mapAssetClientErrorMessage,
  messageFromBody,
} from './map-asset-hooks';

function asset(overrides: Partial<ExistingMapAsset> = {}): ExistingMapAsset {
  return {
    _id: 'asset-1',
    _rev: '1',
    docType: 'asset',
    name: 'Sites',
    description: '',
    createdBy: 'u',
    originalFilename: 'sites.geojson',
    byteSize: 12,
    status: 'ready',
    kind: 'vector-tiles',
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as ExistingMapAsset;
}

describe('mapAssetClientErrorMessage', () => {
  it('maps HTTP 503 to the shared busy message', () => {
    expect(
      mapAssetClientErrorMessage({
        status: 503,
        body: {error: {message: 'ignored'}},
        statusText: 'Service Unavailable',
      })
    ).toBe(MAP_ASSET_UPLOAD_BUSY_MESSAGE);
  });

  it('prefers JSON error.message for other statuses', () => {
    expect(
      mapAssetClientErrorMessage({
        status: 400,
        body: {error: {message: 'File too large.'}},
        statusText: 'Bad Request',
      })
    ).toBe('File too large.');
  });

  it('reads the first Zod issue from an array body', () => {
    expect(
      messageFromBody(
        [{errors: {issues: [{message: 'Choose a map file.'}]}}],
        'Bad Request'
      )
    ).toBe('Choose a map file.');
  });

  it('falls back to statusText when the body has no message', () => {
    expect(messageFromBody({}, 'Not Found')).toBe('Not Found');
    expect(
      mapAssetClientErrorMessage({
        status: 404,
        body: undefined,
        statusText: 'Not Found',
      })
    ).toBe('Not Found');
  });
});

describe('formatAssetStatus', () => {
  it('returns the failure reason, or Failed', () => {
    expect(
      formatAssetStatus(asset({status: 'failed', failureReason: 'Invalid CRS'}))
    ).toBe('Invalid CRS');
    expect(formatAssetStatus(asset({status: 'failed'}))).toBe('Failed');
  });

  it('uses processing copy while the job is in progress', () => {
    expect(formatAssetStatus(asset({status: 'pending'}))).toBe('Pending');
    expect(formatAssetStatus(asset({status: 'processing'}))).toBe('Processing');
    expect(
      formatAssetStatus(
        asset({
          status: 'processing',
          processingStage: 'tiling-vectors',
          processingProgress: {phase: 'Reordering geometry', percent: 45.2},
        })
      )
    ).toBe('Building vector tiles — Reordering geometry 45%');
  });

  it('labels a ready layer by kind', () => {
    expect(formatAssetStatus(asset({kind: 'vector-tiles'}))).toBe(
      'Vector tiles'
    );
    expect(formatAssetStatus(asset({kind: 'raster-tiles'}))).toBe(
      'Image tiles'
    );
    expect(formatAssetStatus(asset({kind: undefined}))).toBe('Vector');
  });
});
