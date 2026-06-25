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
  append = false,
}: {
  geojsonPath: string;
  geopackagePath: string;
  layerName?: string;
  append?: boolean;
}): Promise<void> =>
  new Promise((resolve, reject) => {
    const args = [
      '-f',
      'GPKG',
      ...(append ? ['-update', '-append'] : []),
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

export interface GeoPackageLayerInput {
  layerName: string;
  geojsonPath: string;
}

/**
 * Converts one GeoJSON file per layer into a multi-layer GeoPackage.
 */
export const convertLayeredGeoJsonToGeoPackage = async ({
  layers,
  geopackagePath,
}: {
  layers: GeoPackageLayerInput[];
  geopackagePath: string;
}): Promise<void> => {
  if (layers.length === 0) {
    return;
  }

  await assertGdalAvailable();

  for (let i = 0; i < layers.length; i++) {
    const {layerName, geojsonPath} = layers[i];
    await convertGeoJsonFileToGeoPackage({
      geojsonPath,
      geopackagePath,
      layerName,
      append: i > 0,
    });
  }
};
