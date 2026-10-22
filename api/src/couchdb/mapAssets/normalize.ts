// SPDX-License-Identifier: Apache-2.0
/**
 * Turns an uploaded map file set into one PMTiles archive.
 * Vectors are reprojected to EPSG:4326 (geometry only) and tiled with
 * tippecanoe. Rasters, including a georeferenced PDF at GDAL's default
 * 150 DPI, are warped to EPSG:3857 and written as WebP tiles. Zoom
 * overviews and feature dropping happen in that tiling step.
 */

import {existsSync} from 'fs';
import {copyFile, mkdtemp, open, rm, stat, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {
  type MapAssetKind,
  type MapAssetProcessingProgress,
  type MapAssetProcessingStage,
  type MapExtent,
} from '@faims3/data-model';
import {config} from '../../buildconfig';
import {withMapAssetProcessingWait} from '../../logging';
import {
  flattenNestedFeatureCollections,
  isGeoJsonPath,
} from '../../spatial/flattenGeoJson';
import {
  gdalConfigArgs,
  gdalWarpPerformanceArgs,
  ogr2ogrGeometryArgs,
  spatialToolProcessEnv,
  tippecanoeVectorArgs,
  vectorIntermediatePlan,
  type SpatialToolPerformance,
} from '../../spatial/gdalPerformance';
import {attachGdalProgress} from '../../spatial/gdalProgress';
import {consumeTippecanoeProgress} from '../../spatial/tippecanoeProgress';
import {GdalCommandError, readGdalJson, runGdalCommand} from '../export/gdal';
import {
  assertUploadCompanions,
  extensionOf,
  isVectorUpload,
  primaryUploadFile,
  safeUploadFilename,
  type UploadedMapFile,
} from './uploadRules';
import {prepareVectorGdalSource} from './zipSources';

/** Optional ids so GDAL wait lines can be correlated with the asset. */
export type MapAssetNormalizeLogContext = {
  assetId?: string;
  /** Persist the current pipeline step onto the map-asset document. */
  onStage?: (stage: MapAssetProcessingStage) => void | Promise<void>;
  /** Live flatten / tippecanoe / GDAL phase + percent. */
  onProgress?: (progress: MapAssetProcessingProgress) => void | Promise<void>;
};

/** Persist the current pipeline stage when the caller supplied `onStage`. */
async function emitStage(
  logContext: MapAssetNormalizeLogContext | undefined,
  stage: MapAssetProcessingStage
): Promise<void> {
  await logContext?.onStage?.(stage);
}

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

/** GDAL JSON CRS WKT, or empty when GDAL did not report one. */
export function wktFromInfo(info: unknown): string {
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

/**
 * Throw when GDAL's JSON info has no usable CRS WKT (missing or "unknown").
 * Vector and raster ingest both require a CRS before reprojection.
 */
export function assertHasCrs(info: unknown, filename: string): void {
  const wkt = wktFromInfo(info);
  if (!wkt || /unknown/i.test(wkt)) {
    throw new Error(
      `${filename} has no coordinate reference system. GDAL could not read a CRS.`
    );
  }
}

/** `/vsizip/` prefix for zips so GDAL opens the archive without unzipping. */
export function gdalSourcePath(filePath: string): string {
  return extensionOf(filePath) === '.zip' ? `/vsizip/${filePath}` : filePath;
}

/**
 * Sibling `.prj` next to a raster (PNG/JPEG carry CRS there, not in the
 * image). GDAL's PNG/JPEG drivers read the world file for placement and
 * ignore `.prj` unless we assign it.
 */
export function siblingProjectionPath(sourcePath: string): string | undefined {
  const ext = path.extname(sourcePath);
  if (!ext) {
    return undefined;
  }
  const prjPath = `${sourcePath.slice(0, -ext.length)}.prj`;
  return existsSync(prjPath) ? prjPath : undefined;
}

/**
 * Build a VRT that copies the raster and sets `-a_srs` from a sibling
 * `.prj`. Returns the original path when no `.prj` is present.
 */
export async function assignSiblingRasterPrj(
  sourcePath: string,
  workDir: string,
  logContext?: MapAssetNormalizeLogContext
): Promise<string> {
  const prjPath = siblingProjectionPath(sourcePath);
  if (!prjPath) {
    return sourcePath;
  }
  const assigned = path.join(
    workDir,
    `${path.parse(sourcePath).name}-assigned.vrt`
  );
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'gdal_translate',
      filename: path.basename(sourcePath),
      detail: 'assign CRS from .prj',
    },
    () =>
      runGdalCommand({
        command: 'gdal_translate',
        args: ['-of', 'VRT', '-a_srs', prjPath, sourcePath, assigned],
        env: spatialCommandEnv(),
      })
  );
  return assigned;
}

/**
 * Run ogrinfo/gdalinfo JSON and require a CRS. File Geodatabase zips get a
 * distinct audit detail so ingest logs can tell them apart from shapefile zips.
 */
async function inspectCrs(
  source: string,
  filename: string,
  vector: boolean,
  logContext?: MapAssetNormalizeLogContext
): Promise<unknown> {
  const command = vector ? 'ogrinfo' : 'gdalinfo';
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
              env: spatialCommandEnv(),
            })
          : readGdalJson({
              command: 'gdalinfo',
              args: ['-json', source],
              env: spatialCommandEnv(),
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
function spatialToolPerformance(): SpatialToolPerformance {
  return {
    gdalNumThreads: config.gdalNumThreads,
    gdalCacheMaxMb: config.gdalCacheMaxMb,
    gdalWarpMemoryMb: config.gdalWarpMemoryMb,
    gdalWarpMulti: config.gdalWarpMulti,
    tippecanoeMaxThreads: config.tippecanoeMaxThreads,
  };
}

/** GDAL/tippecanoe process env from the current API thread/cache config. */
function spatialCommandEnv(): NodeJS.ProcessEnv {
  return spatialToolProcessEnv(spatialToolPerformance());
}

/**
 * Run `command`, then each fallback name, until one is on PATH.
 * Throws `missing` only when every name is ENOENT.
 */
async function runMapTool(
  command: string,
  args: string[],
  fallbacks: string[],
  missing: string,
  onStderr?: (chunk: string) => void
): Promise<void> {
  const names = [command, ...fallbacks];
  const env = spatialCommandEnv();
  for (const name of names) {
    try {
      await runGdalCommand({command: name, args, env, onStderr});
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

/** Run tippecanoe, honouring `TIPPECANOE_BIN` when set. */
async function runTippecanoe(
  args: string[],
  onStderr?: (chunk: string) => void
): Promise<void> {
  await runMapTool(
    process.env.TIPPECANOE_BIN || 'tippecanoe',
    args,
    [],
    'tippecanoe is not installed or not on PATH. Map-layer ingest requires it.',
    onStderr
  );
}

/** Run the go-pmtiles CLI (`PMTILES_BIN`, else `pmtiles`, else `go-pmtiles`). */
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
export async function readPmtilesHeader(filePath: string): Promise<{
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
export function overviewFactors(maxZoom: number): string[] {
  const factors: string[] = [];
  let factor = 2;
  while (maxZoom - Math.log2(factor) >= 0) {
    factors.push(String(factor));
    factor *= 2;
  }
  return factors;
}

/**
 * Highest `maxzoom` in gdalinfo MBTiles metadata domains.
 * Returns 0 when GDAL did not report a usable zoom.
 */
export function maxZoomFromMbtilesInfo(info: unknown): number {
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

/** Axis-aligned bbox of a GeoJSON ring; used for GDAL WGS84 extent rings. */
export function extentFromRing(ring: number[][]): MapExtent {
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

/**
 * Reproject the vector source to EPSG:4326, tile with tippecanoe, and
 * return a PMTiles path plus header zoom/extent.
 */
async function convertVector(
  gdalSource: string,
  filename: string,
  workDir: string,
  logContext?: MapAssetNormalizeLogContext,
  extractedGdbDir?: string,
  ogrInfo?: unknown
): Promise<NormalizedMapAsset> {
  const perf = spatialToolPerformance();
  const env = spatialToolProcessEnv(perf);
  const plan = vectorIntermediatePlan(ogrInfo);
  const intermediatePath = path.join(workDir, plan.filename);
  const pmtilesPath = path.join(workDir, 'normalized.pmtiles');
  await emitStage(logContext, 'converting-geometries');
  await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'ogr2ogr',
      filename,
      detail: `${plan.format} EPSG:4326`,
    },
    () =>
      runGdalCommand({
        command: 'ogr2ogr',
        args: ogr2ogrGeometryArgs(intermediatePath, gdalSource, plan),
        env,
      })
  );
  if (extractedGdbDir) {
    await rm(path.join(workDir, 'extracted'), {recursive: true, force: true});
  }
  await emitStage(logContext, 'tiling-vectors');
  let leftover = '';
  let progressWait = Promise.resolve();
  const onStderr = (chunk: string) => {
    const consumed = consumeTippecanoeProgress(leftover + chunk);
    leftover = consumed.leftover;
    for (const update of consumed.updates) {
      const reported = update;
      progressWait = progressWait.then(() =>
        Promise.resolve(logContext?.onProgress?.(reported))
      );
    }
  };
  try {
    await withMapAssetProcessingWait(
      {
        event: 'gdal.command',
        assetId: logContext?.assetId,
        command: 'tippecanoe',
        filename,
        detail: 'vector PMTiles',
      },
      () =>
        runTippecanoe(
          tippecanoeVectorArgs(pmtilesPath, intermediatePath, plan),
          onStderr
        )
    );
    const flushed = consumeTippecanoeProgress(`${leftover}\n`);
    for (const update of flushed.updates) {
      await logContext?.onProgress?.(update);
    }
    await progressWait;
  } catch (error) {
    await progressWait.catch(() => undefined);
    throw error;
  }
  await rm(intermediatePath, {force: true});
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
  cornerCoordinates?: {
    upperLeft?: [number, number];
    lowerRight?: [number, number];
  };
  wgs84Extent?: {coordinates?: number[][][]};
};

/**
 * Run a GDAL CLI with stdout percent progress forwarded to `onProgress`.
 * Always finishes the progress tracker so a crash still closes the last tick.
 */
async function runRasterGdal({
  command,
  args,
  filename,
  detail,
  phase,
  env,
  logContext,
}: {
  command: string;
  args: string[];
  filename: string;
  detail: string;
  phase: string;
  env: NodeJS.ProcessEnv;
  logContext?: MapAssetNormalizeLogContext;
}): Promise<void> {
  const progress = attachGdalProgress(logContext?.onProgress, phase);
  try {
    await withMapAssetProcessingWait(
      {
        event: 'gdal.command',
        assetId: logContext?.assetId,
        command,
        filename,
        detail,
      },
      () =>
        runGdalCommand({
          command,
          args,
          env,
          onStdout: progress.onChunk,
        })
    );
    await progress.finish();
  } catch (error) {
    await progress.finish().catch(() => undefined);
    throw error;
  }
}

/**
 * Warp the raster to EPSG:3857, build WebP MBTiles, convert to PMTiles,
 * and read zoom/extent from the archive header.
 */
async function convertRaster(
  sourcePath: string,
  workDir: string,
  logContext?: MapAssetNormalizeLogContext
): Promise<NormalizedMapAsset> {
  const warped = path.join(workDir, 'warped.tif');
  const mbtiles = path.join(workDir, 'normalized.mbtiles');
  const pmtilesPath = path.join(workDir, 'normalized.pmtiles');
  const filename = path.basename(sourcePath);
  const perf = spatialToolPerformance();
  const env = spatialToolProcessEnv(perf);
  await emitStage(logContext, 'warping-raster');
  await runRasterGdal({
    command: 'gdalwarp',
    args: [
      ...gdalWarpPerformanceArgs(perf),
      '-t_srs',
      'EPSG:3857',
      '-r',
      'bilinear',
      '-of',
      'GTiff',
      gdalSourcePath(sourcePath),
      warped,
    ],
    filename,
    detail: 'EPSG:3857 bilinear GeoTIFF',
    phase: 'Warping',
    env,
    logContext,
  });

  const info = (await withMapAssetProcessingWait(
    {
      event: 'gdal.command',
      assetId: logContext?.assetId,
      command: 'gdalinfo',
      filename: 'warped.tif',
      detail: 'read warped raster extent',
    },
    () =>
      readGdalJson({
        command: 'gdalinfo',
        args: ['-json', warped],
        env,
      })
  )) as GdalInfo;
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
  await emitStage(logContext, 'building-tiles');
  await runRasterGdal({
    command: 'gdal_translate',
    args: [
      ...gdalConfigArgs(perf),
      '-of',
      'MBTiles',
      '-co',
      'TILE_FORMAT=WEBP',
      '-co',
      `QUALITY=${RASTER_WEBP_QUALITY}`,
      '-co',
      'NAME=layer',
      warped,
      mbtiles,
    ],
    filename,
    detail: 'MBTiles WebP',
    phase: 'Tiling',
    env,
    logContext,
  });
  const mbtilesInfo = await readGdalJson({
    command: 'gdalinfo',
    args: ['-json', mbtiles],
    env,
  });
  const factors = overviewFactors(maxZoomFromMbtilesInfo(mbtilesInfo));
  if (factors.length > 0) {
    await emitStage(logContext, 'building-overviews');
    await runRasterGdal({
      command: 'gdaladdo',
      args: [...gdalConfigArgs(perf), '-r', 'average', mbtiles, ...factors],
      filename,
      detail: `overviews ${factors.join(',')}`,
      phase: 'Overviews',
      env,
      logContext,
    });
  }
  await emitStage(logContext, 'converting-tiles');
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

/**
 * Requires a CRS and writes a normalized file beside the upload (or in a
 * fresh temp dir). The caller deletes `workDir` after it has streamed the
 * output. Source files are copied only when they are not already on disk.
 */
export async function normalizeMapUpload(
  files: UploadedMapFile[],
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
    const filename = path.basename(sourcePath);
    let gdalSource = vector ? sourcePath : gdalSourcePath(sourcePath);
    let rasterSource = sourcePath;
    let extractedGdbDir: string | undefined;
    if (vector) {
      const prepared = await prepareVectorGdalSource(
        sourcePath,
        path.join(workDir, 'extracted'),
        {
          onExtracting: () => emitStage(logContext, 'extracting-archive'),
        }
      );
      gdalSource = prepared.source;
      extractedGdbDir = prepared.extractedGdbDir;
    }
    if (vector && isGeoJsonPath(gdalSource)) {
      const flattenedPath = path.join(workDir, 'flattened.geojson');
      await emitStage(logContext, 'flattening-geojson');
      let progressWait = Promise.resolve();
      await withMapAssetProcessingWait(
        {
          event: 'gdal.command',
          assetId: logContext?.assetId,
          command: 'flatten-geojson',
          filename,
          detail: 'nested FeatureCollections',
        },
        async () => {
          await flattenNestedFeatureCollections(
            gdalSource,
            flattenedPath,
            update => {
              progressWait = progressWait.then(() =>
                Promise.resolve(
                  logContext?.onProgress?.({
                    phase: 'Flattening',
                    percent: update.percent,
                  })
                )
              );
            }
          );
          await progressWait;
        }
      );
      gdalSource = flattenedPath;
    }
    await emitStage(logContext, 'interpreting-crs');
    if (!vector) {
      rasterSource = await assignSiblingRasterPrj(
        sourcePath,
        workDir,
        logContext
      );
      gdalSource = gdalSourcePath(rasterSource);
    }
    const ogrInfo = await inspectCrs(gdalSource, filename, vector, logContext);
    const result = vector
      ? await convertVector(
          gdalSource,
          filename,
          workDir,
          logContext,
          extractedGdbDir,
          ogrInfo
        )
      : await convertRaster(rasterSource, workDir, logContext);
    return ownsWorkDir ? {...result, cleanupDir: workDir} : result;
  } catch (error) {
    if (ownsWorkDir) {
      await rm(workDir, {recursive: true, force: true});
    }
    throw error;
  }
}

/**
 * Common parent directory when every file is already on disk in the same
 * folder (the worker can skip a copy). `undefined` when files are split
 * or any entry is in-memory only.
 */
export function sharedDiskDirectory(
  files: UploadedMapFile[]
): string | undefined {
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
