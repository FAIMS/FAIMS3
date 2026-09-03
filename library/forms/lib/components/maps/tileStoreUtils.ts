/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 *
 * Description:
 *
 * Shared types and helpers for the offline map tile store.
 */

// Types stored in the map tile database
// StoredTile is the raw tile cache, basically a URL and the blob
// returned when we request it.  The sets property records which
// tile-sets this belongs to so that when we're deleting sets
// we don't remove this stored tile if it belongs to another one as well
export interface StoredTile {
  url: string;
  data: Blob;
  sets: string[];
}

// StoreTileSet is a collection of stored tiles. We record the extent and the min/max
// zoom levels.  The size is calculated after download and cached for future reporting.
// the expected tile count is stored to be able to show the progress loading bar
// tileKeys references the individual StoredTile records.
export interface StoredTileSet {
  setName: string;
  extent: number[];
  minZoom: number;
  maxZoom: number;
  size: number;
  expectedTileCount: number;
  created: Date;
  tileKeys: IDBValidKey[];
  /** When set, this tile set is removed when the project is deactivated. */
  projectId?: string;
  /** Optional display label (defaults to setName in UI). */
  label?: string;
  /** Source offline map region this tile set was downloaded for. */
  offlineMapRegion?: import('@faims3/data-model').OfflineMapRegion;
}

export type InitTileDbResult = {
  // True if a failed migration caused the database to be wiped and reset.
  databaseReset: boolean;
};

/**
 * Create a unique id for a user-created offline map.
 *
 * This becomes StoredTileSet.setName internally. The editable user-visible
 * name is stored separately in StoredTileSet.label.
 */
export const OFFLINE_MAP_ID_PREFIX = 'offline-map-';
export function createOfflineMapId(): string {
  return `${OFFLINE_MAP_ID_PREFIX}${crypto.randomUUID()}`;
}
