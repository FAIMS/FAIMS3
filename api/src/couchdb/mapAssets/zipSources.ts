// SPDX-License-Identifier: Apache-2.0
/**
 * Peek inside a map-layer zip so GDAL opens a File Geodatabase at
 * `/vsizip/file.zip/Name.gdb` instead of hoping the zip root is enough.
 * File Geodatabase zips are extracted to scratch before ogr2ogr. Shapefile
 * zips still use the zip root. ZIP64 archives that do not name a `.gdb`
 * are extracted and searched; otherwise they fall back to `/vsizip`.
 */

import {spawn} from 'child_process';
import {mkdir, open, readdir} from 'fs/promises';
import path from 'path';
import {extensionOf} from './uploadRules';

const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;
const MAX_COMMENT_BYTES = 65535;
const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;

/** Entry names from the zip central directory. Empty when the zip is unreadable or ZIP64. */
export async function listZipEntryNames(filePath: string): Promise<string[]> {
  const handle = await open(filePath, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size < 22) {
      return [];
    }
    const tailLen = Math.min(size, 22 + MAX_COMMENT_BYTES);
    const tail = new Uint8Array(tailLen);
    await handle.read(tail, 0, tailLen, size - tailLen);
    const tailView = new DataView(
      tail.buffer,
      tail.byteOffset,
      tail.byteLength
    );
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) !== EOCD_SIGNATURE) {
        continue;
      }
      const commentLen = tailView.getUint16(i + 20, true);
      if (i + 22 + commentLen === tail.length) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) {
      return [];
    }
    const recordCount = tailView.getUint16(eocd + 10, true);
    const cdSize = tailView.getUint32(eocd + 12, true);
    const cdOffset = tailView.getUint32(eocd + 16, true);
    if (
      recordCount === 0xffff ||
      cdSize === 0xffffffff ||
      cdOffset === 0xffffffff ||
      cdSize > MAX_CENTRAL_DIRECTORY_BYTES ||
      cdOffset + cdSize > size
    ) {
      return [];
    }
    const cd = new Uint8Array(cdSize);
    await handle.read(cd, 0, cdSize, cdOffset);
    const cdView = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const names: string[] = [];
    let offset = 0;
    const decoder = new TextDecoder();
    for (let n = 0; n < recordCount && offset + 46 <= cd.length; n++) {
      if (cdView.getUint32(offset, true) !== CD_SIGNATURE) {
        break;
      }
      const nameLen = cdView.getUint16(offset + 28, true);
      const extraLen = cdView.getUint16(offset + 30, true);
      const commentLen = cdView.getUint16(offset + 32, true);
      const nameStart = offset + 46;
      const nameEnd = nameStart + nameLen;
      if (nameEnd > cd.length) {
        break;
      }
      names.push(decoder.decode(cd.subarray(nameStart, nameEnd)));
      offset = nameEnd + extraLen + commentLen;
    }
    return names;
  } finally {
    await handle.close();
  }
}

/** `.gdb` folders inside the zip, as posix paths (e.g. `export/Sites.gdb`). */
export function fileGdbFoldersInZip(entries: string[]): string[] {
  const folders = new Set<string>();
  for (const entry of entries) {
    const name = entry.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = name.split('/').filter(Boolean);
    const gdbAt = segments.findIndex(segment => /\.gdb$/i.test(segment));
    if (gdbAt >= 0) {
      folders.add(segments.slice(0, gdbAt + 1).join('/'));
    }
  }
  return [...folders];
}

/**
 * Path GDAL should open. Non-zips are unchanged. A zip with one `.gdb`
 * folder is opened at that folder; anything else stays `/vsizip/file`.
 */
export async function resolveVectorGdalSource(
  filePath: string
): Promise<string> {
  if (extensionOf(filePath) !== '.zip') {
    return filePath;
  }
  const folders = fileGdbFoldersInZip(await listZipEntryNames(filePath));
  if (folders.length > 1) {
    throw new Error(
      `${path.basename(filePath)} contains ${folders.length} File Geodatabases. Zip one .gdb only.`
    );
  }
  if (folders.length === 1) {
    return `/vsizip/${filePath}/${folders[0]}`;
  }
  return `/vsizip/${filePath}`;
}

export type PreparedVectorGdalSource = {
  source: string;
  extractedGdbDir?: string;
};

/** `.gdb` directories under `root`, not descending into a found geodatabase. */
export async function findGdbDirectories(root: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (/\.gdb$/i.test(entry.name)) {
        found.push(full);
        continue;
      }
      await walk(full);
    }
  };
  await walk(root);
  return found;
}

function runUnzip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-q', '-o', zipPath, '-d', destDir]);
    let stderr = '';
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    proc.on('error', error => {
      const absent =
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT';
      if (absent) {
        reject(
          new Error(
            'unzip is not installed or not on PATH. Map-layer File Geodatabase zips require it.'
          )
        );
        return;
      }
      reject(error);
    });
    proc.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `unzip failed (exit ${code}): ${stderr.trim() || path.basename(zipPath)}`
        )
      );
    });
  });
}

/**
 * Extract a zip and return the single `.gdb` folder. Rejects when the zip
 * contains more than one File Geodatabase. Returns undefined when none.
 */
export async function extractFileGdbZip(
  zipPath: string,
  destDir: string
): Promise<string | undefined> {
  await mkdir(destDir, {recursive: true});
  await runUnzip(zipPath, destDir);
  const found = await findGdbDirectories(destDir);
  if (found.length > 1) {
    throw new Error(
      `${path.basename(zipPath)} contains ${found.length} File Geodatabases. Zip one .gdb only.`
    );
  }
  return found[0];
}

/**
 * Resolve the path GDAL should open. File Geodatabase zips are unzipped to
 * `extractDir` so ogr2ogr does not read through `/vsizip`.
 */
export async function prepareVectorGdalSource(
  filePath: string,
  extractDir: string,
  options?: {onExtracting?: () => void | Promise<void>}
): Promise<PreparedVectorGdalSource> {
  if (extensionOf(filePath) !== '.zip') {
    return {source: filePath};
  }
  const names = await listZipEntryNames(filePath);
  const folders = fileGdbFoldersInZip(names);
  if (folders.length > 1) {
    throw new Error(
      `${path.basename(filePath)} contains ${folders.length} File Geodatabases. Zip one .gdb only.`
    );
  }
  const knownGdb =
    folders.length === 1 || filePath.toLowerCase().endsWith('.gdb.zip');
  const maybeZip64Gdb = folders.length === 0 && names.length === 0;
  if (!knownGdb && !maybeZip64Gdb) {
    return {source: `/vsizip/${filePath}`};
  }
  await options?.onExtracting?.();
  try {
    const extractedGdbDir = await extractFileGdbZip(filePath, extractDir);
    if (extractedGdbDir) {
      return {source: extractedGdbDir, extractedGdbDir};
    }
  } catch (error) {
    if (knownGdb) {
      throw error;
    }
  }
  return {source: `/vsizip/${filePath}`};
}
