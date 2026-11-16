// SPDX-License-Identifier: Apache-2.0

/** Stable URL values for `/map-layers/$assetId?tab=`. */
export const MAP_LAYER_TABS = [
  'details',
  'preview',
  'links',
  'actions',
] as const;

export type MapLayerTab = (typeof MAP_LAYER_TABS)[number];

/** Parse `?tab=` from the asset page search, defaulting to details. */
export function parseMapLayerTab(value: unknown): MapLayerTab {
  return MAP_LAYER_TABS.includes(value as MapLayerTab)
    ? (value as MapLayerTab)
    : 'details';
}
