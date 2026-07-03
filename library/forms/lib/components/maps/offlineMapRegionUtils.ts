import type {OfflineMapRegion} from '@faims3/data-model';
import {boundingExtent} from 'ol/extent';

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
