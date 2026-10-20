// SPDX-License-Identifier: Apache-2.0
/**
 * On-disk staging for a map-layer upload. The API streams these files to
 * object storage after the HTTP response. The spatial worker downloads
 * them again and runs GDAL; this directory is not shared with the worker.
 */

import {
  copyFile,
  mkdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {withMapAssetProcessingWait} from '../../logging';
import {safeUploadFilename, type UploadedMapFile} from './uploadRules';

/** Per-asset temp directory under the OS tmpdir. */
export function mapAssetStagingDir(assetId: string): string {
  return path.join(tmpdir(), 'faims-map-uploads', assetId);
}

/**
 * Move multer files (or write in-memory bytes) into the asset staging
 * directory and drop the leftover multer folder.
 */
export async function stageUploadFiles(
  assetId: string,
  files: UploadedMapFile[]
): Promise<UploadedMapFile[]> {
  return withMapAssetProcessingWait(
    {
      event: 'asset.stage',
      assetId,
      fileCount: files.length,
      filenames: files.map(file => file.filename),
      byteSize: files.reduce(
        (sum, file) => sum + (file.size ?? file.bytes?.length ?? 0),
        0
      ),
    },
    async () => {
      const dest = mapAssetStagingDir(assetId);
      await mkdir(dest, {recursive: true});
      const leftoverDirs = new Set<string>();
      const staged: UploadedMapFile[] = [];
      for (const file of files) {
        const filename = safeUploadFilename(file.filename);
        const destPath = path.join(dest, filename);
        if (file.diskPath) {
          leftoverDirs.add(path.dirname(file.diskPath));
          await moveOrCopy(file.diskPath, destPath);
        } else if (file.bytes) {
          await writeFile(destPath, new Uint8Array(file.bytes));
        } else {
          throw new Error(`Upload is missing data for ${filename}.`);
        }
        const size = file.size ?? (await stat(destPath)).size;
        staged.push({filename, diskPath: destPath, size});
      }
      for (const dir of leftoverDirs) {
        if (path.resolve(dir) !== path.resolve(dest)) {
          await rm(dir, {recursive: true, force: true}).catch(() => undefined);
        }
      }
      return staged;
    }
  );
}

/** Create the staging directory and return disk paths for each filename. */
export async function ensureStagingPaths(
  assetId: string,
  filenames: string[]
): Promise<UploadedMapFile[]> {
  const dest = mapAssetStagingDir(assetId);
  await mkdir(dest, {recursive: true});
  return filenames.map(filename => {
    const safe = safeUploadFilename(filename);
    return {filename: safe, diskPath: path.join(dest, safe)};
  });
}

/**
 * Existing staged files for `filenames`, or `undefined` if any path is
 * missing (the worker should download from object storage instead).
 */
export async function readStagedFiles(
  assetId: string,
  filenames: string[]
): Promise<UploadedMapFile[] | undefined> {
  const dir = mapAssetStagingDir(assetId);
  const files: UploadedMapFile[] = [];
  for (const filename of filenames) {
    const safe = safeUploadFilename(filename);
    const diskPath = path.join(dir, safe);
    try {
      const info = await stat(diskPath);
      files.push({filename: safe, diskPath, size: info.size});
    } catch {
      return undefined;
    }
  }
  return files.length > 0 ? files : undefined;
}

/** Recursively delete the asset staging directory. */
export async function cleanupStaging(assetId: string): Promise<void> {
  await rm(mapAssetStagingDir(assetId), {recursive: true, force: true});
}

/** Rename when possible; copy+unlink when the paths cross filesystems. */
async function moveOrCopy(from: string, to: string): Promise<void> {
  if (path.resolve(from) === path.resolve(to)) {
    return;
  }
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await unlink(from);
  }
}
