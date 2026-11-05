// SPDX-License-Identifier: Apache-2.0
/**
 * Repeatable public satellite source for raster test fixtures.
 *
 * Element 84 Earth Search indexes Sentinel-2 L2A Cloud-Optimized GeoTIFFs
 * on the AWS Registry of Open Data. No auth. Pin a STAC item + srcwin so
 * suite runs pull the same ~50MB RGB window.
 *
 * Scene: S2B_56HLH_20240124_0_L2A (Sydney / MGRS 56HLH, 2024-01-24,
 * ~1.1% cloud). Visual TCI is 10 m uint8 RGB, native EPSG:32756.
 */
import {parseCrs} from './spatialTestFormats';

export const RASTER_STAC_API = 'https://earth-search.aws.element84.com/v1';
export const RASTER_STAC_COLLECTION = 'sentinel-2-l2a';
export const RASTER_STAC_ITEM_ID = 'S2B_56HLH_20240124_0_L2A';

/** Fallback if the STAC item fetch fails; same object the item advertises. */
export const RASTER_PINNED_VISUAL_HREF =
  'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/56/H/LH/2024/1/S2B_56HLH_20240124_0_L2A/TCI.tif';

export const RASTER_SOURCE_CRS = 'EPSG:32756';
export const RASTER_SOURCE_WIDTH = 10980;
export const RASTER_SOURCE_HEIGHT = 10980;
export const RASTER_SOURCE_BANDS = 3;

/**
 * Pixel origin of the window. (3450, 4804) sits over inner Sydney so the
 * crop is urban land, not ocean / nodata at the scene edge.
 */
export const RASTER_WINDOW_XOFF = 3450;
export const RASTER_WINDOW_YOFF = 4804;

export const DEFAULT_RASTER_SIZE_BYTES = 50 * 1024 * 1024;

export type RasterSourceWindow = {
  xoff: number;
  yoff: number;
  xsize: number;
  ysize: number;
};

export const rasterStacItemUrl = (): string =>
  `${RASTER_STAC_API}/collections/${RASTER_STAC_COLLECTION}/items/${RASTER_STAC_ITEM_ID}`;

/**
 * Side length (pixels) whose uncompressed RGB8 payload is ~`targetBytes`.
 * Clamped to the remaining source window from the pinned origin.
 */
export const rasterWindowForBytes = (
  targetBytes: number
): RasterSourceWindow => {
  const remainingX = RASTER_SOURCE_WIDTH - RASTER_WINDOW_XOFF;
  const remainingY = RASTER_SOURCE_HEIGHT - RASTER_WINDOW_YOFF;
  const raw = Math.floor(Math.sqrt(targetBytes / RASTER_SOURCE_BANDS));
  const side = Math.max(64, Math.min(remainingX, remainingY, raw));
  return {
    xoff: RASTER_WINDOW_XOFF,
    yoff: RASTER_WINDOW_YOFF,
    xsize: side,
    ysize: side,
  };
};

export const rasterCacheBasename = (
  window: RasterSourceWindow,
  targetBytes: number
): string =>
  `${RASTER_STAC_ITEM_ID}-${window.xoff}-${window.yoff}-${window.xsize}x${window.ysize}-${targetBytes}.tif`;

type StacAsset = {
  href?: unknown;
};

type StacItem = {
  assets?: Record<string, StacAsset | undefined>;
};

const visualHrefFromItem = (item: StacItem): string | undefined => {
  const visual = item.assets?.visual ?? item.assets?.tci;
  return typeof visual?.href === 'string' ? visual.href : undefined;
};

/** Resolve the visual COG href from STAC; fall back to the pinned URL. */
export const resolveRasterVisualHref = async (): Promise<{
  href: string;
  fromStac: boolean;
}> => {
  try {
    const response = await fetch(rasterStacItemUrl(), {
      headers: {Accept: 'application/geo+json, application/json'},
    });
    if (!response.ok) {
      throw new Error(`STAC item ${response.status}`);
    }
    const item = (await response.json()) as StacItem;
    const href = visualHrefFromItem(item);
    if (!href) {
      throw new Error('STAC item has no visual/tci asset');
    }
    return {href, fromStac: true};
  } catch {
    return {href: RASTER_PINNED_VISUAL_HREF, fromStac: false};
  }
};

export const rasterSourceMatchesCrs = (crs: string): boolean =>
  parseCrs(crs) === RASTER_SOURCE_CRS;
