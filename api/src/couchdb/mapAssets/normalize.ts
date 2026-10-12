// SPDX-License-Identifier: Apache-2.0
/**
 * Turns an uploaded map file set into one device-ready payload:
 * GeoJSON in EPSG:4326, or a PNG in EPSG:3857 no longer than
 * `options.maxRasterEdgePx` (4096 by default).
 */

import {mkdtemp, readFile, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import type {
  MapAssetKind,
  MapAssetNormalizeOptions,
  MapExtent,
} from '@faims3/data-model';
import {DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS} from '@faims3/data-model';
import {GdalCommandError, readGdalJson, runGdalCommand} from '../export/gdal';
import {
  assertUploadCompanions,
  extensionOf,
  isVectorUpload,
  primaryUploadFile,
  safeUploadFilename,
  type UploadedMapFile,
} from './uploadRules';

export {
  assertUploadCompanions,
  primaryUploadFile,
  safeUploadFilename,
  type UploadedMapFile,
} from './uploadRules';

/** Longest edge of a normalized raster, in pixels. */
export const MAX_RASTER_EDGE_PX =
  DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.maxRasterEdgePx;

export type NormalizedMapAsset = {
  kind: MapAssetKind;
  bytes: Buffer;
  mediaType: string;
  extent4326: MapExtent;
  extent3857?: MapExtent;
};

function wktFromInfo(info: unknown): string {
  if (!info || typeof info !== 'object') {
    return '';
  }
  const record = info as {
    coordinateSystem?: {wkt?: string};
    layers?: {
      geometryFields?: {coordinateSystem?: {wkt?: string}}[];
      srs?: string;
    }[];
  };
  const direct = record.coordinateSystem?.wkt;
  if (direct && direct.trim()) {
    return direct;
  }
  const layer = record.layers?.[0];
  const fromGeometry = layer?.geometryFields?.[0]?.coordinateSystem?.wkt;
  if (fromGeometry && fromGeometry.trim()) {
    return fromGeometry;
  }
  if (typeof layer?.srs === 'string') {
    return layer.srs;
  }
  return '';
}

function assertHasCrs(info: unknown, filename: string): void {
  const wkt = wktFromInfo(info);
  if (!wkt || /unknown/i.test(wkt)) {
    throw new Error(
      `${filename} has no coordinate reference system. GDAL could not read a CRS.`
    );
  }
}

function gdalSourcePath(filePath: string): string {
  return extensionOf(filePath) === '.zip' ? `/vsizip/${filePath}` : filePath;
}

async function inspectCrs(filePath: string, vector: boolean): Promise<void> {
  const source = gdalSourcePath(filePath);
  try {
    const info = vector
      ? await readGdalJson({
          command: 'ogrinfo',
          args: ['-json', '-so', '-al', source],
        })
      : await readGdalJson({
          command: 'gdalinfo',
          args: ['-json', source],
        });
    assertHasCrs(info, path.basename(filePath));
  } catch (error) {
    if (error instanceof GdalCommandError) {
      throw new Error(
        `GDAL could not read ${path.basename(filePath)}: ${error.stderr.trim() || error.message}`
      );
    }
    throw error;
  }
}

function extentFromRing(ring: number[][]): MapExtent {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pair of ring) {
    const x = pair[0];
    const y = pair[1];
    if (typeof x !== 'number' || typeof y !== 'number') {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    throw new Error('GDAL did not report an extent for the normalized file.');
  }
  return [minX, minY, maxX, maxY];
}

function extentFromGeoJson(parsed: {
  bbox?: number[];
  features?: {geometry?: {coordinates?: unknown}; bbox?: number[]}[];
}): MapExtent {
  if (
    parsed.bbox &&
    parsed.bbox.length >= 4 &&
    parsed.bbox.every(value => typeof value === 'number')
  ) {
    return [parsed.bbox[0], parsed.bbox[1], parsed.bbox[2], parsed.bbox[3]];
  }
  const points: number[][] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      points.push([value[0], value[1]]);
      return;
    }
    for (const child of value) {
      walk(child);
    }
  };
  for (const feature of parsed.features ?? []) {
    walk(feature.geometry?.coordinates);
  }
  return extentFromRing(points);
}

async function convertVector(
  sourcePath: string,
  workDir: string,
  options: MapAssetNormalizeOptions
): Promise<NormalizedMapAsset> {
  const outPath = path.join(workDir, 'normalized.geojson');
  const write = async (simplify?: number) => {
    const args = [
      '-f',
      'GeoJSON',
      '-t_srs',
      'EPSG:4326',
      '-lco',
      'RFC7946=YES',
    ];
    if (simplify !== undefined && simplify > 0) {
      args.push('-simplify', String(simplify));
    }
    args.push(outPath, gdalSourcePath(sourcePath));
    await runGdalCommand({command: 'ogr2ogr', args});
  };

  await write();
  let bytes = await readFile(outPath);
  if (bytes.length > options.vectorSimplifyBytes) {
    await write(options.vectorSimplifyTolerances[0]);
    bytes = await readFile(outPath);
  }
  if (bytes.length > options.vectorSimplifyBytes) {
    await write(options.vectorSimplifyTolerances[1]);
    bytes = await readFile(outPath);
  }

  const parsed = JSON.parse(bytes.toString('utf8')) as {
    bbox?: number[];
    features?: {geometry?: {coordinates?: unknown}; bbox?: number[]}[];
  };
  return {
    kind: 'geojson',
    bytes,
    mediaType: 'application/geo+json',
    extent4326: extentFromGeoJson(parsed),
  };
}

type GdalInfo = {
  size?: [number, number];
  cornerCoordinates?: {
    upperLeft?: [number, number];
    lowerRight?: [number, number];
  };
  wgs84Extent?: {coordinates?: number[][][]};
};

async function convertRaster(
  sourcePath: string,
  workDir: string,
  options: MapAssetNormalizeOptions
): Promise<NormalizedMapAsset> {
  const warped = path.join(workDir, 'warped.tif');
  const png = path.join(workDir, 'normalized.png');
  await runGdalCommand({
    command: 'gdalwarp',
    args: [
      '-t_srs',
      'EPSG:3857',
      '-r',
      'bilinear',
      '-of',
      'GTiff',
      gdalSourcePath(sourcePath),
      warped,
    ],
  });

  const info = (await readGdalJson({
    command: 'gdalinfo',
    args: ['-json', warped],
  })) as GdalInfo;
  const width = info.size?.[0] ?? 0;
  const height = info.size?.[1] ?? 0;
  const translateArgs = ['-of', 'PNG'];
  const longEdge = Math.max(width, height);
  if (longEdge > options.maxRasterEdgePx && width > 0 && height > 0) {
    if (width >= height) {
      translateArgs.push('-outsize', String(options.maxRasterEdgePx), '0');
    } else {
      translateArgs.push('-outsize', '0', String(options.maxRasterEdgePx));
    }
  }
  translateArgs.push(warped, png);
  await runGdalCommand({command: 'gdal_translate', args: translateArgs});

  const upperLeft = info.cornerCoordinates?.upperLeft;
  const lowerRight = info.cornerCoordinates?.lowerRight;
  if (!upperLeft || !lowerRight) {
    throw new Error('GDAL did not report a placement extent for the raster.');
  }
  const extent3857: MapExtent = [
    upperLeft[0],
    lowerRight[1],
    lowerRight[0],
    upperLeft[1],
  ];
  const ring = info.wgs84Extent?.coordinates?.[0] ?? [];
  return {
    kind: 'image',
    bytes: await readFile(png),
    mediaType: 'image/png',
    extent4326: extentFromRing(ring),
    extent3857,
  };
}

/**
 * Writes the upload set into a temp directory, requires a CRS, and returns
 * the normalized bytes. The temp directory is removed before this resolves.
 */
export async function normalizeMapUpload(
  files: UploadedMapFile[],
  options: MapAssetNormalizeOptions = DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS
): Promise<NormalizedMapAsset> {
  assertUploadCompanions(files);
  const primary = primaryUploadFile(files);
  const workDir = await mkdtemp(path.join(tmpdir(), 'faims-map-asset-'));
  try {
    for (const file of files) {
      const filename = safeUploadFilename(file.filename);
      await writeFile(path.join(workDir, filename), new Uint8Array(file.bytes));
    }
    const sourcePath = path.join(workDir, primary.filename);
    const vector = isVectorUpload(primary.filename);
    await inspectCrs(sourcePath, vector);
    return vector
      ? await convertVector(sourcePath, workDir, options)
      : await convertRaster(sourcePath, workDir, options);
  } finally {
    await rm(workDir, {recursive: true, force: true});
  }
}
