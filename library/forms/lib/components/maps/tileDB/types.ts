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
 * Versioned schemas and types for the offline map tile database.
 */

import {OfflineMapRegion} from '@faims3/data-model';
import {z} from 'zod';

// =============
// V1 Definition
// =============

// Validate the fields required from stored tile records during migration.
//
// Types stored in the map tile database
// StoredTile is the raw tile cache, basically a URL and the blob
// returned when we request it.  The sets property records which
// tile-sets this belongs to so that when we're deleting sets
// we don't remove this stored tile if it belongs to another one as well
export const TileV1Schema = z.object({
  url: z.string(),
  data: z.custom<Blob>(),
  sets: z.array(z.string()),
});
export type TileV1 = z.infer<typeof TileV1Schema>;

// Validate the fields required from stored tile-set records during migration.
//
// StoreTileSet is a collection of stored tiles. We record the extent and the min/max
// zoom levels.  The size is calculated after download and cached for future reporting.
// the expected tile count is stored to be able to show the progress loading bar
// tileKeys references the individual StoredTile records.
export const TileSetV1Schema = z.object({
  setName: z.string(),
  /* Extent contains at least four coordinate values. */
  extent: z.array(z.number()).min(4),
  minZoom: z.number(),
  maxZoom: z.number(),
  size: z.number(),
  expectedTileCount: z.number(),
  created: z.date(),
  tileKeys: z.array(z.custom<IDBValidKey>()),
  /** When set, this tile set is removed when the project is deactivated. */
  projectId: z.string().optional(),
  /** Optional display label (defaults to setName in UI). */
  label: z.string().optional(),
  /** Source offline map region this tile set was downloaded for. */
  offlineMapRegion: z.custom<OfflineMapRegion>().optional(),
});
export type TileSetV1 = z.infer<typeof TileSetV1Schema>;

// =============
// V2 Definition
// =============

// V2 keeps the same stored record shapes as V1.
// The v2 migration changes the data invariant rather than the schema:
// legacy @project/... IDs are replaced with generated offline-map IDs.
export const TileV2Schema = TileV1Schema;
export type TileV2 = z.infer<typeof TileV2Schema>;

export const TileSetV2Schema = TileSetV1Schema;
export type TileSetV2 = z.infer<typeof TileSetV2Schema>;

// ===============
// CURRENT EXPORTS
// ===============

// Current stored tile schema and type.
export const StoredTileSchema = TileV2Schema;
export type StoredTile = TileV2;

// Current stored tile-set schema and type.
export const StoredTileSetSchema = TileSetV2Schema;
export type StoredTileSet = TileSetV2;
