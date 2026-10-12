// SPDX-License-Identifier: Apache-2.0

/**
 * OpenLayers paint order for maps that mix reference data with user geometry.
 *
 * Contextual map layers stay in the low band. Pins, sketches, record markers,
 * the offline-region outline, and the GPS cursor use a reserved band above
 * that, so a fully opaque reference layer cannot cover geometry the user is
 * placing or editing.
 *
 * The map field also identifies stale pin layers by {@link USER_FEATURE_LAYER_Z_INDEX}.
 */

/** Offline region outline. Above contextual layers, under drawn geometry. */
export const OFFLINE_REGION_LAYER_Z_INDEX = 997;

/**
 * Pins, lines, polygons, in-progress sketches, and record markers.
 * The map field removes leftover pin layers by this value.
 */
export const USER_FEATURE_LAYER_Z_INDEX = 998;

/** Live GPS cursor. Stays visible above the geometry being edited. */
export const GPS_CURSOR_LAYER_Z_INDEX = 999;

/** Contextual reference layers never render at or above the user band. */
export const CONTEXTUAL_LAYER_Z_INDEX_MAX = OFFLINE_REGION_LAYER_Z_INDEX - 1;

/**
 * Map a stored contextual-layer stack value onto the reference band.
 * Relative order is kept for values inside the band. Anything above the band
 * is clamped so it cannot cover user geometry.
 */
export function contextualLayerZIndex(zIndex: number): number {
  if (!Number.isFinite(zIndex)) {
    return 0;
  }
  return Math.min(Math.max(zIndex, 0), CONTEXTUAL_LAYER_Z_INDEX_MAX);
}
