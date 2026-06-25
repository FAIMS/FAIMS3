/**
 * GDAL / ogr2ogr helpers for GeoPackage export.
 *
 * GeoPackage files are produced by writing GeoJSON to a temp file and converting
 * with the system `ogr2ogr` binary.
 */

import {spawn} from 'child_process';

const DEFAULT_LAYER_NAME = 'faims_export';

/**
 * Returns true when `ogr2ogr` is available on PATH.
 */
export const isGdalAvailable = (): Promise<boolean> =>
  new Promise(resolve => {
    const proc = spawn('ogr2ogr', ['--version']);
    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));
  });

/**
 * Ensures GDAL is available, throwing a clear error if not.
 */
export const assertGdalAvailable = async (): Promise<void> => {
  if (!(await isGdalAvailable())) {
    throw new Error(
      'GDAL ogr2ogr is not installed or not on PATH. GeoPackage export requires GDAL.'
    );
  }
};

/**
 * Converts a GeoJSON file to GeoPackage using ogr2ogr.
 */
export const convertGeoJsonFileToGeoPackage = async ({
  geojsonPath,
  geopackagePath,
  layerName = DEFAULT_LAYER_NAME,
}: {
  geojsonPath: string;
  geopackagePath: string;
  layerName?: string;
}): Promise<void> => {
  await assertGdalAvailable();

  return new Promise((resolve, reject) => {
    const args = [
      '-f',
      'GPKG',
      geopackagePath,
      geojsonPath,
      '-nln',
      layerName,
      '-a_srs',
      'EPSG:4326',
      '-lco',
      'SPATIAL_INDEX=YES',
    ];

    const proc = spawn('ogr2ogr', args);
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
      reject(new Error(`ogr2ogr failed (exit ${code}): ${stderr.trim()}`));
    });
  });
};
