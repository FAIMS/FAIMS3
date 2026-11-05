// SPDX-License-Identifier: Apache-2.0
/**
 * Shared extent helpers for static and interactive layer previews.
 */

import {Extent} from 'ol/extent';
import {transformExtent} from 'ol/proj';

const MAP_PROJECTION = 'EPSG:3857';

/** Pad an extent by 15% (or to a minimum span) so the preview is not edge-tight. */
export function bufferExtent(extent: Extent): Extent {
  const [minX, minY, maxX, maxY] = extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const minSpan = 800;
  const padX = Math.max(width * 0.15, (minSpan - width) / 2);
  const padY = Math.max(height * 0.15, (minSpan - height) / 2);
  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

/** Web-mercator extent for fitting; prefers a stored 3857 bbox. */
export function placementExtent(
  extent4326?: [number, number, number, number],
  extent3857?: [number, number, number, number]
): Extent | undefined {
  if (extent3857) {
    return [...extent3857];
  }
  if (extent4326) {
    return transformExtent(extent4326, 'EPSG:4326', MAP_PROJECTION);
  }
  return undefined;
}
