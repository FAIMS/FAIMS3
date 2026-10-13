// SPDX-License-Identifier: Apache-2.0
/**
 * Filename and companion checks for a map-layer upload, before GDAL runs.
 */

import {INPUT_LIMITS} from '@faims3/data-model';
import path from 'path';

const VECTOR_EXTENSIONS = new Set([
  '.geojson',
  '.json',
  '.gpkg',
  '.kml',
  '.zip',
]);
const RASTER_EXTENSIONS = new Set([
  '.tif',
  '.tiff',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
]);
const WORLD_FILE_EXTENSIONS = new Set([
  '.pgw',
  '.gfw',
  '.jgw',
  '.wld',
  '.tfw',
  '.j2w',
]);

export type UploadedMapFile = {
  filename: string;
  /** Present for tests and tiny fixtures. Prefer `diskPath` for real uploads. */
  bytes?: Buffer;
  /** On-disk path of a streamed upload. */
  diskPath?: string;
  size?: number;
};

export function uploadedFileSize(file: UploadedMapFile): number {
  if (typeof file.size === 'number') {
    return file.size;
  }
  return file.bytes?.length ?? 0;
}

/** Basename safe to write into a temp directory. */
export function safeUploadFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base === '.' || base === '..') {
    throw new Error('Upload is missing a filename.');
  }
  if (base.length > INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH) {
    throw new Error(
      `Filename must be at most ${INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH} characters.`
    );
  }
  return base;
}

export function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isVectorUpload(filename: string): boolean {
  return VECTOR_EXTENSIONS.has(extensionOf(filename));
}

/**
 * The file GDAL should open. A zipped shapefile and a world-file image both
 * count; companion `.prj` / world files are not primaries.
 */
export function primaryUploadFile(files: UploadedMapFile[]): UploadedMapFile {
  const named = files.map(file => ({
    ...file,
    filename: safeUploadFilename(file.filename),
  }));
  const primary = named.find(file => {
    const ext = extensionOf(file.filename);
    return VECTOR_EXTENSIONS.has(ext) || RASTER_EXTENSIONS.has(ext);
  });
  if (!primary) {
    throw new Error(
      'Upload needs a GeoJSON, GeoPackage, zipped shapefile, KML, GeoTIFF, georeferenced PDF, or a PNG/JPEG.'
    );
  }
  return primary;
}

/**
 * PNG and JPEG must arrive with a world file and a `.prj`. Other formats
 * carry their CRS inside the file, which GDAL checks later.
 */
export function assertUploadCompanions(files: UploadedMapFile[]): void {
  const primary = primaryUploadFile(files);
  const ext = extensionOf(primary.filename);
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
    return;
  }
  const extensions = new Set(
    files.map(file => extensionOf(safeUploadFilename(file.filename)))
  );
  const hasWorld = [...extensions].some(item =>
    WORLD_FILE_EXTENSIONS.has(item)
  );
  if (!hasWorld || !extensions.has('.prj')) {
    throw new Error(
      'PNG and JPEG uploads need a world file and a .prj that names the coordinate reference system.'
    );
  }
}
