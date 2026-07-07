/**
 * Shared helpers for offline map region geometry, naming, and download status.
 *
 * Regions are stored as EPSG:4326 GeoJSON polygons; tile operations use
 * EPSG:3857 extents derived via OpenLayers transforms.
 */

import type {OfflineMapRegion} from '@faims3/data-model';
import {boundingExtent} from 'ol/extent';
import {transformExtent} from 'ol/proj';
import type {MapConfig} from './types';
import {VectorTileStore, type StoredTileSet} from './TileStore';

/** Download lifecycle state derived from a stored tile set record. */
export type TileSetDownloadStatus =
  | {state: 'not_downloaded'}
  | {state: 'downloading'; progress: number}
  | {state: 'downloaded'; sizeBytes: number};

/** Convert a stored offline map region polygon to an EPSG:4326 extent. */
export function offlineMapRegionToExtent4326(
  region: OfflineMapRegion
): number[] {
  const ring = region.coordinates[0];
  if (!ring?.length) {
    throw new Error('Offline map region has no coordinates');
  }
  return boundingExtent(ring);
}

/**
 * Project an offline map region into Web Mercator (EPSG:3857).
 *
 * Tile download and size estimation operate in map projection space; stored
 * regions are EPSG:4326 GeoJSON polygons.
 */
export function offlineMapRegionToExtent3857(
  region: OfflineMapRegion
): number[] {
  const extent4326 = offlineMapRegionToExtent4326(region);
  return transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
}

/** Build a rectangular offline map region from an EPSG:4326 extent. */
export function extent4326ToOfflineMapRegion(
  extent: number[]
): OfflineMapRegion {
  const [minX, minY, maxX, maxY] = extent;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
  };
}

/** Internal tile-set name for a project-associated offline map download. */
export function projectOfflineMapSetName(projectId: string): string {
  return `@project/${projectId}`;
}

/** Whether a tile set name was created by {@link projectOfflineMapSetName}. */
export function isProjectOfflineMapSetName(setName: string): boolean {
  return setName.startsWith('@project/');
}

/** User-visible label for a stored tile set. */
export function tileSetDisplayName(tileSet: {
  setName: string;
  label?: string;
}): string {
  return tileSet.label ?? tileSet.setName;
}

/** Round lon/lat to 9 decimal places so float noise does not break equality checks. */
function normalizeOfflineMapRegionCoordinates(
  region: OfflineMapRegion
): OfflineMapRegion {
  return {
    type: 'Polygon',
    coordinates: region.coordinates.map(ring =>
      ring.map(([lon, lat]) => [
        Math.round(lon * 1e9) / 1e9,
        Math.round(lat * 1e9) / 1e9,
      ])
    ),
  };
}

/** Compare two offline map regions for equality (coordinate order sensitive). */
export function offlineMapRegionsEqual(
  a: OfflineMapRegion | undefined,
  b: OfflineMapRegion | undefined
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    JSON.stringify(normalizeOfflineMapRegionCoordinates(a)) ===
    JSON.stringify(normalizeOfflineMapRegionCoordinates(b))
  );
}

/**
 * Fraction of expected tiles present for an in-progress download (0–1).
 *
 * Returns `null` when progress cannot be computed (download not started or
 * expected tile count unknown).
 */
export function tileSetDownloadProgress(tileSet: StoredTileSet): number | null {
  if (tileSet.expectedTileCount <= 0) {
    return null;
  }
  return tileSet.tileKeys.length / tileSet.expectedTileCount;
}

/** Whether a stored tile set record represents a completed download. */
export function isTileSetDownloadComplete(tileSet: StoredTileSet): boolean {
  return (
    tileSet.expectedTileCount > 0 &&
    tileSet.tileKeys.length >= tileSet.expectedTileCount
  );
}

/**
 * Derive download status from a stored tile set record (or absence thereof).
 *
 * Shared by project-level status queries and UI handlers that subscribe to
 * `offline-map-download` events carrying `StoredTileSet` snapshots.
 */
export function deriveTileSetDownloadStatus(
  tileSet: StoredTileSet | undefined | null
): TileSetDownloadStatus {
  if (!tileSet) {
    return {state: 'not_downloaded'};
  }

  if (isTileSetDownloadComplete(tileSet)) {
    return {state: 'downloaded', sizeBytes: tileSet.size};
  }

  const progress = tileSetDownloadProgress(tileSet);
  if (progress !== null) {
    return {state: 'downloading', progress};
  }

  return {state: 'not_downloaded'};
}

/** Estimated download size for an offline map region, in megabytes. */
export async function estimateOfflineMapRegionSizeMb(
  region: OfflineMapRegion,
  config: MapConfig
): Promise<number> {
  const tileStore = new VectorTileStore(config);
  const extent3857 = offlineMapRegionToExtent3857(region);
  return tileStore.estimateSizeForRegion(extent3857);
}

/** Format a size in megabytes for display. */
export function formatOfflineMapSizeMb(sizeMb: number): string {
  if (sizeMb > 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb.toFixed(2)} MB`;
}

/** Format a stored tile set size (bytes) for display. */
export function formatOfflineMapSizeBytes(sizeBytes: number): string {
  return formatOfflineMapSizeMb(sizeBytes / 1024 / 1024);
}
