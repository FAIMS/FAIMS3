// SPDX-License-Identifier: Apache-2.0
/**
 * Download a pinned Sentinel-2 RGB window and write ingest-ready rasters
 * (GeoTIFF, JPEG+jgw+prj, PNG+pgw+prj, georeferenced PDF) in a target CRS.
 *
 * Uses local gdal_translate / gdalwarp / gdalsrsinfo. The native window is
 * cached so format × CRS cases share one /vsicurl fetch.
 */
import {spawn} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {randomUUID} from 'crypto';
import {
  RASTER_FORMAT_INFO,
  rasterCompanionFilenames,
  type RasterFormat,
} from './spatialRasterFormats';
import {
  rasterCacheBasename,
  rasterSourceMatchesCrs,
  rasterWindowForBytes,
  resolveRasterVisualHref,
  type RasterSourceWindow,
} from './spatialRasterSource';
import {parseCrs} from './spatialTestFormats';

const GDAL_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GDAL_PAM_ENABLED: 'NO',
  GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
  CPL_VSIL_CURL_USE_HEAD: 'NO',
  GDAL_HTTP_MULTIRANGE: 'YES',
};

const runGdal = (bin: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {env: GDAL_ENV});
    let stderr = '';
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${bin} failed (exit ${code ?? 'signal'}): ${stderr.trim() || 'no error output'}`
        )
      );
    });
  });

const runGdalStdout = (bin: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {env: GDAL_ENV});
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          `${bin} failed (exit ${code ?? 'signal'}): ${stderr.trim() || 'no error output'}`
        )
      );
    });
  });

const tempPath = (suffix: string): string =>
  path.join(os.tmpdir(), `faims-raster-${randomUUID()}${suffix}`);

type GdalInfo = {
  geoTransform?: number[];
};

const readGeoTransform = async (rasterPath: string): Promise<number[]> => {
  const raw = await runGdalStdout('gdalinfo', ['-json', rasterPath]);
  const info = JSON.parse(raw) as GdalInfo;
  if (!info.geoTransform || info.geoTransform.length < 6) {
    throw new Error(`gdalinfo had no geoTransform for ${rasterPath}`);
  }
  return info.geoTransform;
};

const writeWorldFile = async (
  worldPath: string,
  geoTransform: number[]
): Promise<void> => {
  const [ulx, xres, xrot, uly, yrot, yres] = geoTransform;
  const lines = [xres, yrot, xrot, yres, ulx + xres / 2, uly + yres / 2];
  await fs.promises.writeFile(
    worldPath,
    `${lines.map(value => Number(value).toString()).join('\n')}\n`,
    'utf8'
  );
};

const writePrjFile = async (prjPath: string, crs: string): Promise<void> => {
  const wkt = await runGdalStdout('gdalsrsinfo', [
    '-o',
    'wkt_esri',
    parseCrs(crs),
  ]);
  await fs.promises.writeFile(prjPath, `${wkt.trim()}\n`, 'utf8');
};

const vsicurl = (href: string): string =>
  href.startsWith('/vsicurl/') ? href : `/vsicurl/${href}`;

export const ensureNativeRasterWindow = async ({
  cacheDir,
  targetBytes,
}: {
  cacheDir: string;
  targetBytes: number;
}): Promise<{path: string; window: RasterSourceWindow; reused: boolean}> => {
  const window = rasterWindowForBytes(targetBytes);
  await fs.promises.mkdir(cacheDir, {recursive: true});
  const cachePath = path.join(
    cacheDir,
    rasterCacheBasename(window, targetBytes)
  );
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    return {path: cachePath, window, reused: true};
  }

  const {href} = await resolveRasterVisualHref();
  const tmp = `${cachePath}.part`;
  await fs.promises.rm(tmp, {force: true});
  await runGdal('gdal_translate', [
    '-of',
    'GTiff',
    '-srcwin',
    String(window.xoff),
    String(window.yoff),
    String(window.xsize),
    String(window.ysize),
    '-co',
    'TILED=YES',
    '-co',
    'COMPRESS=NONE',
    '-co',
    'PHOTOMETRIC=RGB',
    vsicurl(href),
    tmp,
  ]);
  await fs.promises.rename(tmp, cachePath);
  return {path: cachePath, window, reused: false};
};

const warpToCrs = async (input: string, crs: string): Promise<string> => {
  if (rasterSourceMatchesCrs(crs)) {
    return input;
  }
  const warped = tempPath('.tif');
  await runGdal('gdalwarp', [
    '-t_srs',
    parseCrs(crs),
    '-r',
    'bilinear',
    '-of',
    'GTiff',
    '-co',
    'TILED=YES',
    '-co',
    'COMPRESS=NONE',
    input,
    warped,
  ]);
  return warped;
};

const translatePrimary = async (
  input: string,
  output: string,
  format: RasterFormat
): Promise<void> => {
  const info = RASTER_FORMAT_INFO[format];
  const args = ['-of', info.gdalDriver, '-b', '1', '-b', '2', '-b', '3'];
  if (format === 'geotiff') {
    args.push(
      '-co',
      'TILED=YES',
      '-co',
      'COMPRESS=NONE',
      '-co',
      'PHOTOMETRIC=RGB'
    );
  }
  if (format === 'jpeg') {
    args.push('-co', 'QUALITY=90');
  }
  args.push(input, output);
  await runGdal('gdal_translate', args);
};

export type WriteRasterCaseResult = {
  bytes: number;
  companionFilenames: string[];
  window: RasterSourceWindow;
  reusedNative: boolean;
};

export const writeRasterTestCase = async ({
  cacheDir,
  outputDir,
  filename,
  format,
  crs,
  targetBytes,
}: {
  cacheDir: string;
  outputDir: string;
  filename: string;
  format: RasterFormat;
  crs: string;
  targetBytes: number;
}): Promise<WriteRasterCaseResult> => {
  const native = await ensureNativeRasterWindow({cacheDir, targetBytes});
  const output = path.join(outputDir, filename);
  await fs.promises.mkdir(outputDir, {recursive: true});
  await fs.promises.rm(output, {force: true});

  const warped = await warpToCrs(native.path, crs);
  let cleanup: string | undefined;
  if (warped !== native.path) {
    cleanup = warped;
  }

  try {
    await translatePrimary(warped, output, format);
    const companions = rasterCompanionFilenames(filename, format);
    if (companions.length > 0) {
      const geoTransform = await readGeoTransform(warped);
      for (const companion of companions) {
        const companionPath = path.join(outputDir, companion);
        if (companion.endsWith('.prj')) {
          await writePrjFile(companionPath, crs);
        } else {
          await writeWorldFile(companionPath, geoTransform);
        }
      }
    }
    const bytes = fs.statSync(output).size;
    return {
      bytes,
      companionFilenames: companions,
      window: native.window,
      reusedNative: native.reused,
    };
  } finally {
    if (cleanup) {
      await fs.promises.rm(cleanup, {force: true});
    }
  }
};
