// SPDX-License-Identifier: Apache-2.0

/** Published user-guide path for map-layer formats and CRS. */
export const MAP_LAYER_FORMATS_DOC_PATH = '/admin/map-layer-formats.html';

/** Used when this Control Centre build has no docs site URL. */
export const MAP_LAYER_FORMATS_DOC_FALLBACK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/user/admin/map-layer-formats.md';

/**
 * Absolute URL for the GIS-facing formats page. Pass `config.docsUrl`
 * from the Control Centre so this helper stays free of env parsing.
 */
export function mapLayerFormatsDocsUrl(docsUrl: string): string {
  if (docsUrl) {
    return `${docsUrl.replace(/\/$/, '')}${MAP_LAYER_FORMATS_DOC_PATH}`;
  }
  return MAP_LAYER_FORMATS_DOC_FALLBACK;
}
