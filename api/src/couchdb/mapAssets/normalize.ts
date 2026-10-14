// SPDX-License-Identifier: Apache-2.0
/**
 * Turns an uploaded map file set into one PMTiles archive.
 * Vectors are reprojected to EPSG:4326 (geometry only) and tiled with
 * tippecanoe. Rasters, including a georeferenced PDF opened at 150 DPI,
 * are warped to EPSG:3857, capped at `options.maxRasterEdgePx`, and
 * written as WebP tiles. Quality 100 does not shrink a raster that
 * already fits under the ceiling.
 */

import {
  copyFile,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import type {
  MapAssetKind,
  MapAssetNormalizeOptions,
  MapExtent,
} from '@faims3/data-model';
import {
  DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS,
  pdfRenderDpi,
  readGeoreferencedPdfRaster,
} from '@faims3/data-model';
import {GdalCommandError, readGdalJson, runGdalCommand} from '../export/gdal';
import {logMapAssetProcessing, withMapAssetProcessingWait} from '../../logging';
import {
  assertUploadCompanions,
  extensionOf,
  isVectorUpload,
  primaryUploadFile,
  safeUploadFilename,
  type UploadedMapFile,
} from './uploadRules';
import {resolveVectorGdalSource} from './zipSources';

/** Optional ids so GDAL wait lines can be correlated with the asset. */
export type MapAssetNormalizeLogContext = {
  assetId?: string;
};

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
  mediaType: string;
  extent4326: MapExtent;
  extent3857?: MapExtent;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  /** On-disk normalized payload. Prefer this over `bytes`. */
  filePath?: string;
  byteSize?: number;
  /** Small fixtures and tests. */
  bytes?: Buffer;
  /** Temp directory the caller must delete after streaming `filePath`. */
  cleanupDir?: string;
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

async function inspectCrs(
  filePath: string,
  vector: boolean,
  logContext?: MapAssetNormalizeLogContext
): Promise<unknown> {
  const source = vector
    ? await resolveVectorGdalSource(filePath)
    : gdalSourcePath(filePath);
  const command = vector ? 'ogrinfo' : 'gdalinfo';
  const filename = path.basename(filePath);
  const gdbZip =
    vector &&
    (/\.gdb(?:\/|$)/i.test(source) ||
      filename.toLowerCase().endsWith('.gdb.zip'));
  try {
    const info = await withMapAssetProcessingWait(
      {
        event: 'gdal.command',
        assetId: logContext?.assetId,
        command,
        filename,
        detail: gdbZip ? 'inspect CRS (File Geodatabase zip)' : 'inspect CRS',
      },
      () =>
        vector
          ? readGdalJson({
              command: 'ogrinfo',
              args: ['-json', '-so', '-al', source],
            })
          : readGdalJson({
              command: 'gdalinfo',
              args: ['-json', source],
            })
    );
    assertHasCrs(info, filename);
    return info;
  } catch (error) {
    if (error instanceof GdalCommandError) {
      throw new Error(
        `GDAL could not read ${filename}: ${error.stderr.trim() || error.message}`
      );
    }
    throw error;
  }
}

const PMTILES_TILE_SIZE = 256;
const RASTER_WEBP_QUALITY = 75;
const PMTILES_MEDIA_TYPE = 'application/vnd.pmtiles';

/**
 * Runs a tiling binary. `PMTILES_BIN` and `TIPPECANOE_BIN` override the
 * executable name. `pmtiles` falls back to `go-pmtiles`.
 */
async function runMapTool(
  command: string,
  args: string[],
  fallbacks: string[],
  missing: string
): Promise<void> {
  const names = [command, ...fallbacks];
  for (const name of names) {
    try {
      await runGdalCommand({command: name, args});
      return;
    } catch (error) {
      const absent =
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT';
      if (!absent) {
        throw error;
      }
    }
  }
  throw new Error(missing);
}

async function runTippecanoe(args: string[]): Promise<void> {
  await runMapTool(
    process.env.TIPPECANOE_BIN || 'tippecanoe',
    args,
    [],
    'tippecanoe is not installed or not on PATH. Map-layer ingest requires it.'
  );
}

async function runPmtiles(args: string[]): Promise<void> {
  const preferred = process.env.PMTILES_BIN;
  await runMapTool(
    preferred || 'pmtiles',
    args,
    preferred ? [] : ['go-pmtiles'],
    'pmtiles is not installed or not on PATH. Map-layer ingest requires the go-pmtiles CLI.'
  );
}

/**
 * PMTiles v3 header. Zoom is bytes 100–101. Bounds are int32 degrees × 1e7
 * starting at byte 102. Reading the header avoids scanning the GeoJSON.
 */
async function readPmtilesHeader(filePath: string): Promise<{
  minZoom: number;
  maxZoom: number;
  extent4326: MapExtent;
}> {
  const handle = await open(filePath, 'r');
  try {
    const header = new Uint8Array(127);
    const {bytesRead} = await handle.read(header, 0, header.length, 0);
    const magic = Buffer.from(header.subarray(0, 7)).toString('utf8');
    if (bytesRead < 118 || magic !== 'PMTiles') {
      throw new Error('Normalized file is not a PMTiles archive.');
    }
    if (header[7] !== 3) {
      throw new Error('Normalized file is not a PMTiles v3 archive.');
    }
    const view = new DataView(
      header.buffer,
      header.byteOffset,
      header.byteLength
    );
    const extent4326: MapExtent = [
      view.getInt32(102, true) / 1e7,
      view.getInt32(106, true) / 1e7,
      view.getInt32(110, true) / 1e7,
      view.getInt32(114, true) / 1e7,
    ];
    if (
      !extent4326.every(Number.isFinite) ||
      !(extent4326[2] > extent4326[0]) ||
      !(extent4326[3] > extent4326[1])
    ) {
      throw new Error('PMTiles archive has no geographic extent.');
    }
    return {minZoom: header[100], maxZoom: header[101], extent4326};
  } finally {
    await handle.close();
  }
}

/** Power-of-two overview factors from the MBTiles base zoom down to zoom 0. */
function overviewFactors(maxZoom: number): string[] {
  const factors: string[] = [];
  let factor = 2;
  while (maxZoom - Math.log2(factor) >= 0) {
    factors.push(String(factor));
    factor *= 2;
  }
  return factors;
}

function maxZoomFromMbtilesInfo(info: unknown): number {
  if (!info || typeof info !== 'object') {
    return 0;
  }
  const metadata = (info as {metadata?: Record<string, {maxzoom?: unknown}>})
    .metadata;
  if (!metadata) {
    return 0;
  }
  for (const domain of Object.values(metadata)) {
    const zoom = Number(domain?.maxzoom);
    if (Number.isInteger(zoom) && zoom >= 0 && zoom <= 30) {
      return zoom;
    }
  }
  return 0;
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

async function convertVector(
  sourcePath: string,
  workDir: string,
  logContext?: MapAssetNormalizeLogContext
): Promise<NormalizedMapAsset> {
  const geojsonPath = path.join(workDir, 'normalized.geojson');
  const pmtilesPath = path.join(workDir, 'normalized.pmtiles');
  const filename = path.basename(sourcePath);
  const gdalSource = await resolveVectorGdalSource(sourcePath);
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'ogr2ogr',
      filename,
      detail: 'GeoJSON EPSG:4326',
    },
    () =>
      runGdalCommand({
        command: 'ogr2ogr',
        args: [
          '-f',
          'GeoJSON',
          '-t_srs',
          'EPSG:4326',
          '-lco',
          'RFC7946=YES',
          // GeoJSON holds one layer. -nln appends every source layer
          // (KML folders, multi-layer GeoPackages) into that layer.
          '-nln',
          'features',
          // Devices draw geometry. Style lives on the asset.
          '-select',
          '',
          geojsonPath,
          gdalSource,
        ],
      })
  );
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'tippecanoe',
      filename,
      detail: 'vector PMTiles',
    },
    () =>
      runTippecanoe([
        '-o',
        pmtilesPath,
        '-zg',
        '--drop-densest-as-needed',
        '--extend-zooms-if-still-dropping',
        '--force',
        '--read-parallel',
        '-l',
        'features',
        geojsonPath,
      ])
  );
  await rm(geojsonPath, {force: true});
  const header = await readPmtilesHeader(pmtilesPath);
  return {
    kind: 'vector-tiles',
    mediaType: PMTILES_MEDIA_TYPE,
    filePath: pmtilesPath,
    byteSize: (await stat(pmtilesPath)).size,
    extent4326: header.extent4326,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    tileSize: PMTILES_TILE_SIZE,
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

/**
 * GDAL's PDF driver rasterizes at 150 DPI from the page size. Ask it for the
 * DPI that lands on the quality cap without enlarging the page past that.
 */
async function pdfDpiOpenOptions(
  sourcePath: string,
  maxRasterEdgePx: number,
  logContext?: MapAssetNormalizeLogContext
): Promise<string[]> {
  if (extensionOf(sourcePath) !== '.pdf') {
    return [];
  }
  try {
    const bytes = new Uint8Array(await readPdfHeadAndTail(sourcePath));
    const full = readGeoreferencedPdfRaster(bytes);
    if (!full) {
      logMapAssetProcessing({
        event: 'normalize.raster.pdf_dpi',
        outcome: 'skipped',
        assetId: logContext?.assetId,
        filename: path.basename(sourcePath),
        reason: 'PDF is not a georeferenced raster',
      });
      return [];
    }
    const dpi = pdfRenderDpi(full, maxRasterEdgePx);
    if (!Number.isFinite(dpi) || dpi <= 0) {
      logMapAssetProcessing({
        event: 'normalize.raster.pdf_dpi',
        outcome: 'skipped',
        assetId: logContext?.assetId,
        filename: path.basename(sourcePath),
        reason: 'could not derive a render DPI',
      });
      return [];
    }
    logMapAssetProcessing({
      event: 'normalize.raster.pdf_dpi',
      outcome: 'success',
      assetId: logContext?.assetId,
      filename: path.basename(sourcePath),
      detail: `DPI=${dpi.toFixed(2)}`,
    });
    return ['-oo', `DPI=${dpi.toFixed(2)}`];
  } catch (error) {
    logMapAssetProcessing({
      event: 'normalize.raster.pdf_dpi',
      outcome: 'skipped',
      assetId: logContext?.assetId,
      filename: path.basename(sourcePath),
      reason: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function convertRaster(
  sourcePath: string,
  workDir: string,
  options: MapAssetNormalizeOptions,
  logContext?: MapAssetNormalizeLogContext
): Promise<NormalizedMapAsset> {
  const warped = path.join(workDir, 'warped.tif');
  const sized = path.join(workDir, 'sized.tif');
  const mbtiles = path.join(workDir, 'normalized.mbtiles');
  const pmtilesPath = path.join(workDir, 'normalized.pmtiles');
  const filename = path.basename(sourcePath);
  const dpiOptions = await pdfDpiOpenOptions(
    sourcePath,
    options.maxRasterEdgePx,
    logContext
  );
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'gdalwarp',
      filename,
      detail: 'EPSG:3857 bilinear GeoTIFF',
    },
    () =>
      runGdalCommand({
        command: 'gdalwarp',
        args: [
          ...dpiOptions,
          '-t_srs',
          'EPSG:3857',
          '-r',
          'bilinear',
          '-of',
          'GTiff',
          gdalSourcePath(sourcePath),
          warped,
        ],
      })
  );

  const info = (await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'gdalinfo',
      filename: 'warped.tif',
      detail: 'read warped raster size',
    },
    () =>
      readGdalJson({
        command: 'gdalinfo',
        args: ['-json', warped],
      })
  )) as GdalInfo;
  const width = info.size?.[0] ?? 0;
  const height = info.size?.[1] ?? 0;
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
  const longEdge = Math.max(width, height);
  let tileSource = warped;
  if (longEdge > options.maxRasterEdgePx && width > 0 && height > 0) {
    const translateArgs = ['-of', 'GTiff'];
    if (width >= height) {
      translateArgs.push('-outsize', String(options.maxRasterEdgePx), '0');
    } else {
      translateArgs.push('-outsize', '0', String(options.maxRasterEdgePx));
    }
    translateArgs.push(warped, sized);
    await withMapAssetProcessingWait(
      {
        event: 'gdal.command',
        assetId: logContext?.assetId,
        command: 'gdal_translate',
        filename,
        detail: `long-edge ${options.maxRasterEdgePx}px`,
      },
      () => runGdalCommand({command: 'gdal_translate', args: translateArgs})
    );
    tileSource = sized;
  }
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'gdal_translate',
      filename,
      detail: 'MBTiles WebP',
    },
    () =>
      runGdalCommand({
        command: 'gdal_translate',
        args: [
          '-of',
          'MBTiles',
          '-co',
          'TILE_FORMAT=WEBP',
          '-co',
          `QUALITY=${RASTER_WEBP_QUALITY}`,
          '-co',
          'NAME=layer',
          tileSource,
          mbtiles,
        ],
      })
  );
  const mbtilesInfo = await readGdalJson({
    command: 'gdalinfo',
    args: ['-json', mbtiles],
  });
  const factors = overviewFactors(maxZoomFromMbtilesInfo(mbtilesInfo));
  if (factors.length > 0) {
    await withMapAssetProcessingWait(
      {
        event: 'gdal.command',
        assetId: logContext?.assetId,
        command: 'gdaladdo',
        filename,
        detail: `overviews ${factors.join(',')}`,
      },
      () =>
        runGdalCommand({
          command: 'gdaladdo',
          args: ['-r', 'average', mbtiles, ...factors],
        })
    );
  }
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'pmtiles',
      filename,
      detail: 'convert MBTiles',
    },
    () => runPmtiles(['convert', mbtiles, pmtilesPath])
  );
  await rm(mbtiles, {force: true});
  await rm(warped, {force: true});
  await rm(sized, {force: true});
  const zoom = await readPmtilesHeader(pmtilesPath);
  const ring = info.wgs84Extent?.coordinates?.[0] ?? [];
  return {
    kind: 'raster-tiles',
    mediaType: PMTILES_MEDIA_TYPE,
    filePath: pmtilesPath,
    byteSize: (await stat(pmtilesPath)).size,
    extent4326: extentFromRing(ring),
    extent3857,
    minZoom: zoom.minZoom,
    maxZoom: zoom.maxZoom,
    tileSize: PMTILES_TILE_SIZE,
  };
}

const PDF_MEDIA_BOX_SLICE_BYTES = 2 * 1024 * 1024;

/** MediaBox is usually in the header or trailer — do not load a huge PDF. */
async function readPdfHeadAndTail(filePath: string): Promise<Buffer> {
  const size = (await stat(filePath)).size;
  if (size <= PDF_MEDIA_BOX_SLICE_BYTES * 2) {
    return readFile(filePath);
  }
  const handle = await open(filePath, 'r');
  try {
    const head = new Uint8Array(PDF_MEDIA_BOX_SLICE_BYTES);
    const tail = new Uint8Array(PDF_MEDIA_BOX_SLICE_BYTES);
    await handle.read(head, 0, head.length, 0);
    await handle.read(tail, 0, tail.length, size - tail.length);
    return Buffer.concat([head, tail]);
  } finally {
    await handle.close();
  }
}

/**
 * Requires a CRS and writes a normalized file beside the upload (or in a
 * fresh temp dir). The caller deletes `workDir` after it has streamed the
 * output. Source files are copied only when they are not already on disk.
 */
export async function normalizeMapUpload(
  files: UploadedMapFile[],
  options: MapAssetNormalizeOptions = DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS,
  logContext?: MapAssetNormalizeLogContext
): Promise<NormalizedMapAsset> {
  assertUploadCompanions(files);
  const primary = primaryUploadFile(files);
  const existingDir = sharedDiskDirectory(files);
  const workDir =
    existingDir ?? (await mkdtemp(path.join(tmpdir(), 'faims-map-asset-')));
  const ownsWorkDir = existingDir === undefined;
  try {
    if (ownsWorkDir) {
      for (const file of files) {
        const filename = safeUploadFilename(file.filename);
        const dest = path.join(workDir, filename);
        if (file.diskPath) {
          await copyFile(file.diskPath, dest);
        } else if (file.bytes) {
          await writeFile(dest, new Uint8Array(file.bytes));
        } else {
          throw new Error(`Upload is missing data for ${filename}.`);
        }
      }
    }
    const sourcePath = path.join(workDir, safeUploadFilename(primary.filename));
    const vector = isVectorUpload(primary.filename);
    await inspectCrs(sourcePath, vector, logContext);
    const result = vector
      ? await convertVector(sourcePath, workDir, logContext)
      : await convertRaster(sourcePath, workDir, options, logContext);
    return ownsWorkDir ? {...result, cleanupDir: workDir} : result;
  } catch (error) {
    if (ownsWorkDir) {
      await rm(workDir, {recursive: true, force: true});
    }
    throw error;
  }
}

function sharedDiskDirectory(files: UploadedMapFile[]): string | undefined {
  const dirs = new Set(
    files
      .map(file => (file.diskPath ? path.dirname(file.diskPath) : undefined))
      .filter((dir): dir is string => Boolean(dir))
  );
  if (dirs.size !== 1 || files.some(file => !file.diskPath)) {
    return undefined;
  }
  return [...dirs][0];
}
