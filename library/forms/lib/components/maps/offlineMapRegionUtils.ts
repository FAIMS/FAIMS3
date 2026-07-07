import type {OfflineMapRegion} from '@faims3/data-model';
import {boundingExtent} from 'ol/extent';
import {transformExtent} from 'ol/proj';
import type {MapConfig} from './types';
import {VectorTileStore} from './TileStore';

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

/** Estimated download size for an offline map region, in megabytes. */
export async function estimateOfflineMapRegionSizeMb(
  region: OfflineMapRegion,
  config: MapConfig
): Promise<number> {
  const tileStore = new VectorTileStore(config);
  const extent4326 = offlineMapRegionToExtent4326(region);
  const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  return tileStore.estimateSizeForRegion(extent3857);
}

/** Format a size in megabytes for display. */
export function formatOfflineMapSizeMb(sizeMb: number): string {
  if (sizeMb > 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb.toFixed(2)} MB`;
}
