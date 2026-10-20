// SPDX-License-Identifier: Apache-2.0
/**
 * Filename and companion checks for a map-layer upload, before GDAL runs.
 * `.zip` covers a shapefile set or an ESRI File Geodatabase (`.gdb.zip`).
 */

import {
  INPUT_LIMITS,
  MAP_ASSET_PRIMARY_FORMATS,
  isMapAssetPrimaryExtension,
  isMapAssetVectorExtension,
  mapAssetFileExtension,
  mapAssetGeoreferencedImageCompanionIssue,
} from '@faims3/data-model';
import path from 'path';

export type UploadedMapFile = {
  filename: string;
  /** Present for tests and tiny fixtures. Prefer `diskPath` for real uploads. */
  bytes?: Buffer;
  /** On-disk path of a streamed upload. */
  diskPath?: string;
  size?: number;
};

/** Declared `size`, else in-memory byte length, else zero. */
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

/** Lowercased basename extension including the leading dot. */
export function extensionOf(filename: string): string {
  return mapAssetFileExtension(filename);
}

/** True when GDAL should treat this filename as a vector primary. */
export function isVectorUpload(filename: string): boolean {
  return isMapAssetVectorExtension(extensionOf(filename));
}

/**
 * The file GDAL should open. A zipped shapefile, zipped File Geodatabase,
 * and a world-file image all count; companion `.prj` / world files are not
 * primaries.
 */
export function primaryUploadFile(files: UploadedMapFile[]): UploadedMapFile {
  const named = files.map(file => ({
    ...file,
    filename: safeUploadFilename(file.filename),
  }));
  const primary = named.find(file =>
    isMapAssetPrimaryExtension(extensionOf(file.filename))
  );
  if (!primary) {
    throw new Error(`Upload needs ${MAP_ASSET_PRIMARY_FORMATS}.`);
  }
  return primary;
}

/**
 * PNG and JPEG must arrive with a world file and a `.prj`. Other formats
 * carry their CRS inside the file, which GDAL checks later.
 */
export function assertUploadCompanions(files: UploadedMapFile[]): void {
  primaryUploadFile(files);
  const extensions = files.map(file =>
    extensionOf(safeUploadFilename(file.filename))
  );
  const issue = mapAssetGeoreferencedImageCompanionIssue(extensions);
  if (issue) {
    throw new Error(issue);
  }
}
