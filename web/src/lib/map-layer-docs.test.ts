// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  MAP_LAYER_FORMATS_DOC_FALLBACK,
  MAP_LAYER_FORMATS_DOC_PATH,
  mapLayerFormatsDocsUrl,
} from './map-layer-docs';

describe('mapLayerFormatsDocsUrl', () => {
  it('joins the deployment docs site with the formats page', () => {
    expect(mapLayerFormatsDocsUrl('https://docs.fieldmark.app')).toBe(
      `https://docs.fieldmark.app${MAP_LAYER_FORMATS_DOC_PATH}`
    );
    expect(mapLayerFormatsDocsUrl('https://docs.example.org/')).toBe(
      `https://docs.example.org${MAP_LAYER_FORMATS_DOC_PATH}`
    );
  });

  it('falls back to the repository page when no docs site is configured', () => {
    expect(mapLayerFormatsDocsUrl('')).toBe(MAP_LAYER_FORMATS_DOC_FALLBACK);
  });
});
