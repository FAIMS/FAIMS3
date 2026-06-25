/**
 * GDAL / ogr2ogr helpers for GeoPackage export.
 *
 * FAIMS does not embed a GeoPackage writer; conversion is delegated to the
 * system `ogr2ogr` binary. Callers produce layered GeoJSON FeatureCollections
 * on disk, then this module assembles them into a single multi-layer `.gpkg`
 * file.
 *
 * GDAL must be on PATH (`gdal-bin` on Debian/Ubuntu, `gdal-tools` on Alpine,
 * `brew install gdal` on macOS). Docker images and the devcontainer install it
 * automatically.
 */

import {spawn} from 'child_process';
import {logError} from '../../logging';

/** Fallback layer name when converting a single undifferentiated GeoJSON file. */
const DEFAULT_LAYER_NAME = 'faims_export';

/** Thrown when GeoPackage export is requested but `ogr2ogr` is unavailable. */
export class GdalUnavailableError extends Error {
  constructor(
    message = 'GDAL ogr2ogr is not installed or not on PATH. GeoPackage export requires GDAL.'
  ) {
    super(message);
    this.name = 'GdalUnavailableError';
  }
}

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
 *
 * @throws Error when `ogr2ogr` cannot be executed
 */
export const assertGdalAvailable = async (): Promise<void> => {
  if (!(await isGdalAvailable())) {
    const error = new GdalUnavailableError();
    logError(error);
    throw error;
  }
};

/**
 * Converts one GeoJSON file to a GeoPackage layer using ogr2ogr.
 *
 * @param geojsonPath - Source FeatureCollection on disk
 * @param geopackagePath - Target `.gpkg` path (created or updated)
 * @param layerName - Table name inside the GeoPackage
 * @param append - When true, append as a new layer to an existing GeoPackage
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

/** One GeoJSON source file and its target layer name inside the GeoPackage. */
export interface GeoPackageLayerInput {
  layerName: string;
  geojsonPath: string;
}

/**
 * Converts one GeoJSON file per layer into a single multi-layer GeoPackage.
 *
 * The first layer creates the `.gpkg`; subsequent layers are appended. GDAL is
 * checked once at the start rather than per layer.
 *
 * @param layers - Non-empty list of layer inputs (caller should skip when empty)
 * @param geopackagePath - Output `.gpkg` path
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
