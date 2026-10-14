// SPDX-License-Identifier: Apache-2.0
/**
 * Peek inside a map-layer zip so GDAL opens a File Geodatabase at
 * `/vsizip/file.zip/Name.gdb` instead of hoping the zip root is enough.
 * Shapefile zips and zips of gdb tables (no `.gdb` folder) still use the
 * zip root. ZIP64 archives fall back to the root and let GDAL decide.
 */

import {open} from 'fs/promises';
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
