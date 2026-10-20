// SPDX-License-Identifier: Apache-2.0
/**
 * Inspect and, for File Geodatabases, extract a map-layer zip before GDAL.
 *
 * ## Why this file exists
 *
 * GDAL can open a zip through `/vsizip/file.zip`, which is enough for a
 * shapefile set at the zip root. An ESRI File Geodatabase is a *folder*
 * (`Name.gdb/`) and OpenFileGDB is unreliable through `/vsizip`, so those
 * archives are unzipped to scratch and ogr2ogr is pointed at the folder.
 *
 * Before `unzip` runs we list the central directory ourselves and refuse
 * anything we cannot fully inspect. That is how zip-slip, zip-bomb, and
 * symlink entries are rejected without trusting the archive or the unzip
 * binary to do it for us.
 *
 * Layout constants below are from PKWARE APPNOTE.TXT 6.3.10 (1 Nov 2022),
 * the official .ZIP specification. Multi-byte fields are little-endian
 * (APPNOTE 4.3.3 / 4.4.1.1). A parse failure returns no entries;
 * `assertZipExtractAllowed` then refuses the extract. We never unzip an
 * archive we could not list.
 *
 * Spec copies (same section numbers across recent 6.3.x):
 * - https://pkware.cachefly.net/webdocs/APPNOTE/APPNOTE-6.3.10.TXT
 * - https://pkwaredownloads.blob.core.windows.net/pem/APPNOTE.txt
 * - http://www.pkware.com/appnote (PKWARE's current pointer)
 * - Library of Congress archival 6.3.3 (2012):
 *   https://www.loc.gov/preservation/digital/formats/fdd/fdd000354.shtml
 *
 * Record map used here:
 * - 4.3.6  overall layout (local files, then CD, then ZIP64 EOCD, locator, EOCD)
 * - 4.3.12 central-directory file header (signature 0x02014b50, 46-byte prefix)
 * - 4.3.14 ZIP64 end of central directory (signature 0x06064b50)
 * - 4.3.15 ZIP64 EOCD locator (signature 0x07064b50, 20 bytes, immediately
 *   before the 32-bit EOCD — that is how we find the ZIP64 EOCD offset)
 * - 4.3.16 end of central directory (signature 0x06054b50, 22-byte prefix)
 * - 4.4.1.4 / 4.4.21–4.4.24  0xFFFF / 0xFFFFFFFF sentinels → ZIP64 fields
 * - 4.4.2.2  host OS in the high byte of "version made by" (3 = UNIX, 19 = OS X)
 * - 4.4.9    uncompressed size; 0xFFFFFFFF means see the ZIP64 extra field
 * - 4.4.15   external file attributes (host-system dependent)
 * - 4.4.25   .ZIP file comment length (uint16; EOCD comment ≤ 65535 bytes)
 * - 4.5.1    extra-field header (id uint16 + size uint16)
 * - 4.5.3    Zip64 Extended Information Extra Field (header id 0x0001)
 *
 * Unix symlink mode is *not* in APPNOTE. 4.4.15 only says the external
 * attributes are host-system dependent. Info-ZIP (the `unzip` we spawn)
 * treats the high 16 bits on UNIX/OS X hosts as a `mode_t`; `S_IFLNK` is
 * POSIX `<sys/stat.h>` (typically 0120000). See Info-ZIP `unix/unix.c`
 * (`S_ISLNK`) and
 * https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_stat.h.html
 */

import {INPUT_LIMITS, mapAssetExtractTooLargeMessage} from '@faims3/data-model';
import {spawn} from 'child_process';
import {type FileHandle, mkdir, open, readdir} from 'fs/promises';
import path from 'path';
import {extensionOf} from './uploadRules';

/** GDAL virtual filesystem prefix for reading inside a zip without extract. */
const GDAL_VSI_ZIP_PREFIX = '/vsizip/';

/**
 * ArcGIS "Export File Geodatabase" names the archive `Something.gdb.zip`.
 * That is enough to decide we must extract even if the central directory
 * used a layout `fileGdbFoldersInZip` does not recognise.
 */
const GDB_ZIP_SUFFIX = '.gdb.zip';

/** Info-ZIP flags: quiet, overwrite, destination directory. */
const UNZIP_ARGS = ['-q', '-o'] as const;
const UNZIP_DEST_FLAG = '-d';

// ---------------------------------------------------------------------------
// APPNOTE record sizes and signatures
// ---------------------------------------------------------------------------

/**
 * End of central directory (APPNOTE 4.3.16, field notes 4.4.20–4.4.26).
 * 22-byte prefix plus an optional comment of at most 65535 bytes
 * (4.4.25 is a uint16).
 */
const EOCD = {
  SIGNATURE: 0x06054b50,
  BYTES: 22,
  /** 4.4.22: uint16 total entry count (after the this-disk count at +8). */
  TOTAL_ENTRY_COUNT_OFFSET: 10,
  /** 4.4.23 */
  CD_SIZE_OFFSET: 12,
  /** 4.4.24 */
  CD_OFFSET_OFFSET: 16,
  /** 4.4.25 */
  COMMENT_LENGTH_OFFSET: 20,
} as const;

/**
 * ZIP64 EOCD locator (APPNOTE 4.3.15). Always 20 bytes; APPNOTE 4.3.6
 * places it immediately before the 32-bit EOCD so we can find the ZIP64
 * EOCD without scanning the whole file.
 */
const ZIP64_LOCATOR = {
  SIGNATURE: 0x07064b50,
  BYTES: 20,
  /** uint64 "relative offset of the zip64 end of central directory record". */
  EOCD_OFFSET: 8,
} as const;

/**
 * ZIP64 end of central directory (APPNOTE 4.3.14). The Version 1 fixed
 * prefix is 56 bytes (4.3.14.1: the "size" field is the rest of the
 * record, 44, and does not include the leading 12 bytes). We ignore the
 * variable extensible data sector after that.
 */
const ZIP64_EOCD = {
  SIGNATURE: 0x06064b50,
  MIN_BYTES: 56,
  /** 4.3.14: uint64 total number of entries in the central directory. */
  TOTAL_ENTRY_COUNT_OFFSET: 32,
  CD_SIZE_OFFSET: 40,
  CD_OFFSET_OFFSET: 48,
} as const;

/**
 * Central-directory file header (APPNOTE 4.3.12 "File header", field
 * notes 4.4.2–4.4.16). 46-byte prefix plus name, extra, and comment.
 * We never read local-file headers (4.3.7).
 */
const CD_HEADER = {
  SIGNATURE: 0x02014b50,
  BYTES: 46,
  /** 4.4.2 */
  VERSION_MADE_BY_OFFSET: 4,
  /** 4.4.9 */
  UNCOMPRESSED_SIZE_OFFSET: 24,
  /** 4.4.10 */
  NAME_LENGTH_OFFSET: 28,
  /** 4.4.11 */
  EXTRA_LENGTH_OFFSET: 30,
  /** 4.4.12 */
  COMMENT_LENGTH_OFFSET: 32,
  /** 4.4.15 */
  EXTERNAL_ATTR_OFFSET: 38,
} as const;

/**
 * Zip64 Extended Information Extra Field (APPNOTE 4.5.3, header id
 * 0x0001 from 4.5.2). Extra headers are id+size (4.5.1). When the
 * 32-bit uncompressed size is 0xFFFFFFFF (4.4.9), the extra payload
 * starts with an 8-byte original size.
 */
const ZIP64_EXTRA = {
  HEADER_ID: 0x0001,
  HEADER_BYTES: 4,
  UNCOMPRESSED_SIZE_BYTES: 8,
} as const;

/**
 * APPNOTE 4.4.1.4: a 16- or 32-bit field that cannot hold the value is
 * written as -1 (0xFFFF / 0xFFFFFFFF) and the ZIP64 record / extra is
 * created. Same sentinels in 4.4.9 and 4.4.21–4.4.24.
 */
const ZIP64_UINT16_SENTINEL = 0xffff;
const ZIP64_UINT32_SENTINEL = 0xffffffff;

/**
 * Cap on the central-directory blob we will load into RAM. APPNOTE does
 * not limit this; a 16 MiB directory is far above any legitimate map-layer
 * zip and stops a crafted archive from allocating the whole file.
 */
const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;

/** uint16 maximum for the EOCD comment length (APPNOTE 4.4.25). */
const MAX_EOCD_COMMENT_BYTES = ZIP64_UINT16_SENTINEL;

// ---------------------------------------------------------------------------
// Unix symlink mode in the central-directory external attributes
// ---------------------------------------------------------------------------

/**
 * Host OS in the high byte of "version made by" (APPNOTE 4.4.2.2).
 * 3 = UNIX, 19 = OS X (Darwin). Only those hosts are treated as storing
 * a `mode_t` in the high 16 bits of the external attributes (4.4.15 is
 * host-system dependent and does not define the bit layout; Info-ZIP
 * `unix/unix.c` does). DOS/Windows zips (host 0) leave those bits clear,
 * so ArcGIS-on-Windows archives are not false-positives.
 */
const ZIP_HOST_UNIX = 3;
const ZIP_HOST_OSX = 19;

/** High 16 bits of Unix external attributes are the `stat` mode. */
const UNIX_MODE_SHIFT = 16;
const UNIX_MODE_MASK = 0xffff;

/** `sys/stat.h`: file-type bits, and the value for a symbolic link. */
const UNIX_S_IFMT = 0o170000;
const UNIX_S_IFLNK = 0o120000;

export type ZipEntryInfo = {
  name: string;
  uncompressedSize: bigint;
  isUnixSymlink: boolean;
};

/** Convert a zip64 size to a JS number, or `undefined` if it would overflow. */
function bigintToSafeInt(value: bigint): number | undefined {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return undefined;
  }
  return Number(value);
}

/** Exact `length` bytes at `position`, or `undefined` on a short read. */
async function readSlice(
  handle: FileHandle,
  length: number,
  position: number
): Promise<Uint8Array | undefined> {
  if (length <= 0 || position < 0) {
    return undefined;
  }
  const buf = new Uint8Array(length);
  const {bytesRead} = await handle.read(buf, 0, length, position);
  if (bytesRead !== length) {
    return undefined;
  }
  return buf;
}

/** DataView over `bytes` without copying the underlying buffer. */
function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * True when the central-directory Unix mode marks the entry as a symlink.
 *
 * Info-ZIP `unzip` restores those as real links. The entry *name* can be
 * a safe relative path (`Sites.gdb/table`) while the *target* points at a
 * worker-local file. We reject every Unix symlink rather than trying to
 * validate targets: a File Geodatabase never needs them.
 */
export function zipEntryIsUnixSymlink(
  versionMadeBy: number,
  externalAttr: number
): boolean {
  const host = versionMadeBy >> 8;
  if (host !== ZIP_HOST_UNIX && host !== ZIP_HOST_OSX) {
    return false;
  }
  const mode = (externalAttr >>> UNIX_MODE_SHIFT) & UNIX_MODE_MASK;
  return (mode & UNIX_S_IFMT) === UNIX_S_IFLNK;
}

/**
 * True when the entry name would escape the extract directory, write to an
 * absolute path, or inject a NUL that C-based unzip could truncate on.
 *
 * This does not inspect symlink targets; {@link zipEntryIsUnixSymlink}
 * handles that class of entry.
 */
export function zipEntryPathIsUnsafe(name: string): boolean {
  if (name === '' || name.includes('\0')) {
    return true;
  }
  const unified = name.replace(/\\/g, '/');
  // Leading `/` or `C:` / `C:/` is absolute on POSIX and Windows.
  if (unified.startsWith('/') || /^[a-zA-Z]:/.test(unified)) {
    return true;
  }
  return unified.split('/').some(segment => segment === '..');
}

/**
 * ZIP64 uncompressed size from the extra field, or `undefined` when the
 * 32-bit field is the sentinel and the extra is missing or truncated.
 *
 * Callers treat `undefined` as "larger than the extract cap" so a crafted
 * archive cannot hide a zip bomb behind a missing extra field.
 */
function zip64UncompressedSize(
  extra: Uint8Array,
  uncompressed32: number
): bigint | undefined {
  if (uncompressed32 !== ZIP64_UINT32_SENTINEL) {
    return BigInt(uncompressed32);
  }
  const extraView = viewOf(extra);
  let offset = 0;
  while (offset + ZIP64_EXTRA.HEADER_BYTES <= extra.length) {
    const id = extraView.getUint16(offset, true);
    const size = extraView.getUint16(offset + 2, true);
    const dataStart = offset + ZIP64_EXTRA.HEADER_BYTES;
    if (dataStart + size > extra.length) {
      return undefined;
    }
    if (id === ZIP64_EXTRA.HEADER_ID) {
      if (size < ZIP64_EXTRA.UNCOMPRESSED_SIZE_BYTES) {
        return undefined;
      }
      return extraView.getBigUint64(dataStart, true);
    }
    offset = dataStart + size;
  }
  return undefined;
}

/**
 * Walk the central directory and collect entry names, sizes, and symlink
 * flags. A header we cannot size is treated as over the extract cap.
 */
function parseCentralDirectory(
  cd: Uint8Array,
  recordCount: number
): ZipEntryInfo[] {
  const cdView = viewOf(cd);
  const decoder = new TextDecoder();
  const entries: ZipEntryInfo[] = [];
  // Fail closed: a header we cannot size is treated as over the extract cap.
  const unknownSize =
    BigInt(INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES) + BigInt(1);
  let offset = 0;
  for (
    let n = 0;
    n < recordCount && offset + CD_HEADER.BYTES <= cd.length;
    n++
  ) {
    if (cdView.getUint32(offset, true) !== CD_HEADER.SIGNATURE) {
      break;
    }
    const versionMadeBy = cdView.getUint16(
      offset + CD_HEADER.VERSION_MADE_BY_OFFSET,
      true
    );
    const uncompressed32 = cdView.getUint32(
      offset + CD_HEADER.UNCOMPRESSED_SIZE_OFFSET,
      true
    );
    const nameLen = cdView.getUint16(
      offset + CD_HEADER.NAME_LENGTH_OFFSET,
      true
    );
    const extraLen = cdView.getUint16(
      offset + CD_HEADER.EXTRA_LENGTH_OFFSET,
      true
    );
    const commentLen = cdView.getUint16(
      offset + CD_HEADER.COMMENT_LENGTH_OFFSET,
      true
    );
    const externalAttr = cdView.getUint32(
      offset + CD_HEADER.EXTERNAL_ATTR_OFFSET,
      true
    );
    const nameStart = offset + CD_HEADER.BYTES;
    const nameEnd = nameStart + nameLen;
    const extraEnd = nameEnd + extraLen;
    if (extraEnd > cd.length) {
      break;
    }
    const name = decoder.decode(cd.subarray(nameStart, nameEnd));
    entries.push({
      name,
      uncompressedSize:
        zip64UncompressedSize(cd.subarray(nameEnd, extraEnd), uncompressed32) ??
        unknownSize,
      isUnixSymlink: zipEntryIsUnixSymlink(versionMadeBy, externalAttr),
    });
    offset = extraEnd + commentLen;
  }
  return entries;
}

/**
 * ZIP64 locator sits immediately before the 32-bit EOCD. From it we read
 * the ZIP64 EOCD offset, then the 64-bit entry count / CD size / CD offset.
 */
async function readZip64DirectoryLocation(
  handle: FileHandle,
  fileSize: number,
  eocdFileOffset: number
): Promise<
  {recordCount: number; cdSize: number; cdOffset: number} | undefined
> {
  if (eocdFileOffset < ZIP64_LOCATOR.BYTES) {
    return undefined;
  }
  const locator = await readSlice(
    handle,
    ZIP64_LOCATOR.BYTES,
    eocdFileOffset - ZIP64_LOCATOR.BYTES
  );
  if (
    !locator ||
    viewOf(locator).getUint32(0, true) !== ZIP64_LOCATOR.SIGNATURE
  ) {
    return undefined;
  }
  const zip64Offset = bigintToSafeInt(
    viewOf(locator).getBigUint64(ZIP64_LOCATOR.EOCD_OFFSET, true)
  );
  if (
    zip64Offset === undefined ||
    zip64Offset + ZIP64_EOCD.MIN_BYTES > fileSize
  ) {
    return undefined;
  }
  const zip64 = await readSlice(handle, ZIP64_EOCD.MIN_BYTES, zip64Offset);
  if (!zip64 || viewOf(zip64).getUint32(0, true) !== ZIP64_EOCD.SIGNATURE) {
    return undefined;
  }
  const zip64View = viewOf(zip64);
  const recordCount = bigintToSafeInt(
    zip64View.getBigUint64(ZIP64_EOCD.TOTAL_ENTRY_COUNT_OFFSET, true)
  );
  const cdSize = bigintToSafeInt(
    zip64View.getBigUint64(ZIP64_EOCD.CD_SIZE_OFFSET, true)
  );
  const cdOffset = bigintToSafeInt(
    zip64View.getBigUint64(ZIP64_EOCD.CD_OFFSET_OFFSET, true)
  );
  if (
    recordCount === undefined ||
    cdSize === undefined ||
    cdOffset === undefined
  ) {
    return undefined;
  }
  return {recordCount, cdSize, cdOffset};
}

/**
 * Central-directory entries. Empty when the zip is unreadable or the
 * directory is larger than {@link MAX_CENTRAL_DIRECTORY_BYTES}.
 *
 * Walks the file from the tail: last 22+comment bytes to find the EOCD
 * signature, then either the 32-bit CD pointer or the ZIP64 locator.
 */
export async function listZipEntries(
  filePath: string
): Promise<ZipEntryInfo[]> {
  const handle = await open(filePath, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size < EOCD.BYTES) {
      return [];
    }
    const tailLen = Math.min(size, EOCD.BYTES + MAX_EOCD_COMMENT_BYTES);
    const tail = await readSlice(handle, tailLen, size - tailLen);
    if (!tail) {
      return [];
    }
    const tailView = viewOf(tail);
    let eocd = -1;
    // Search backwards so a file that happens to contain the signature in
    // compressed data is not mistaken for the real EOCD. The comment-length
    // field must land exactly at the end of the file.
    for (let i = tail.length - EOCD.BYTES; i >= 0; i--) {
      if (tailView.getUint32(i, true) !== EOCD.SIGNATURE) {
        continue;
      }
      const commentLen = tailView.getUint16(
        i + EOCD.COMMENT_LENGTH_OFFSET,
        true
      );
      if (i + EOCD.BYTES + commentLen === tail.length) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) {
      return [];
    }
    let recordCount = tailView.getUint16(
      eocd + EOCD.TOTAL_ENTRY_COUNT_OFFSET,
      true
    );
    let cdSize = tailView.getUint32(eocd + EOCD.CD_SIZE_OFFSET, true);
    let cdOffset = tailView.getUint32(eocd + EOCD.CD_OFFSET_OFFSET, true);
    if (
      recordCount === ZIP64_UINT16_SENTINEL ||
      cdSize === ZIP64_UINT32_SENTINEL ||
      cdOffset === ZIP64_UINT32_SENTINEL
    ) {
      const zip64 = await readZip64DirectoryLocation(
        handle,
        size,
        size - tailLen + eocd
      );
      if (!zip64) {
        return [];
      }
      recordCount = zip64.recordCount;
      cdSize = zip64.cdSize;
      cdOffset = zip64.cdOffset;
    }
    if (
      recordCount === 0 ||
      cdSize > MAX_CENTRAL_DIRECTORY_BYTES ||
      cdOffset + cdSize > size
    ) {
      return [];
    }
    const cd = await readSlice(handle, cdSize, cdOffset);
    if (!cd) {
      return [];
    }
    return parseCentralDirectory(cd, recordCount);
  } finally {
    await handle.close();
  }
}

/** Entry names from the zip central directory. Empty when the zip is unreadable. */
export async function listZipEntryNames(filePath: string): Promise<string[]> {
  return (await listZipEntries(filePath)).map(entry => entry.name);
}

/**
 * Rejects path traversal, Unix symlinks, and an uncompressed payload above
 * {@link INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES}. An empty list means we
 * could not inspect the archive, so extract is refused.
 */
export function assertZipExtractAllowed(entries: ZipEntryInfo[]): void {
  if (entries.length === 0) {
    throw new Error('Could not read zip contents.');
  }
  let total = BigInt(0);
  for (const entry of entries) {
    if (zipEntryPathIsUnsafe(entry.name)) {
      throw new Error('Zip contains a path that is not allowed.');
    }
    if (entry.isUnixSymlink) {
      throw new Error('Zip contains a symbolic link that is not allowed.');
    }
    if (entry.uncompressedSize < BigInt(0)) {
      throw new Error('Zip entry size is invalid.');
    }
    total += entry.uncompressedSize;
    if (total > BigInt(INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES)) {
      throw new Error(mapAssetExtractTooLargeMessage());
    }
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

/** `/vsizip/` path, optionally into a `.gdb` folder inside the archive. */
function gdalVsiZipSource(filePath: string, gdbFolder?: string): string {
  return gdbFolder
    ? `${GDAL_VSI_ZIP_PREFIX}${filePath}/${gdbFolder}`
    : `${GDAL_VSI_ZIP_PREFIX}${filePath}`;
}

/**
 * Path GDAL should open. Non-zips are unchanged. A zip with one `.gdb`
 * folder is opened at that folder through `/vsizip`; anything else stays
 * at the zip root. This helper does not extract — see
 * {@link prepareVectorGdalSource} for the ogr2ogr path.
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
    return gdalVsiZipSource(filePath, folders[0]);
  }
  return gdalVsiZipSource(filePath);
}

export type PreparedVectorGdalSource = {
  source: string;
  extractedGdbDir?: string;
};

/**
 * `.gdb` directories under `root`. A found geodatabase is not walked
 * further. `Dirent.isDirectory()` is false for a symlink, so a link named
 * `foo.gdb` is not treated as a geodatabase.
 */
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

/**
 * Walk the extract tree without following links. Info-ZIP can still leave
 * a symlink if the central-directory mode was not Unix (or a future unzip
 * infers links another way). GDAL uses ordinary `open()`, so any leftover
 * link would be followed into worker-local files.
 */
export async function assertExtractContainsNoSymlinks(
  root: string
): Promise<void> {
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error('Zip contains a symbolic link that is not allowed.');
      }
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name));
      }
    }
  };
  await walk(root);
}

/** Spawn Info-ZIP `unzip` into `destDir`. */
function runUnzip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', [
      ...UNZIP_ARGS,
      zipPath,
      UNZIP_DEST_FLAG,
      destDir,
    ]);
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
 * Extract a zip and return the single `.gdb` folder. Refuses traversal,
 * Unix symlink entries, leftover links after unzip, and more than one
 * File Geodatabase. Returns undefined when none is found.
 */
export async function extractFileGdbZip(
  zipPath: string,
  destDir: string
): Promise<string | undefined> {
  assertZipExtractAllowed(await listZipEntries(zipPath));
  await mkdir(destDir, {recursive: true});
  await runUnzip(zipPath, destDir);
  await assertExtractContainsNoSymlinks(destDir);
  const found = await findGdbDirectories(destDir);
  if (found.length > 1) {
    throw new Error(
      `${path.basename(zipPath)} contains ${found.length} File Geodatabases. Zip one .gdb only.`
    );
  }
  return found[0];
}

/**
 * Resolve the path GDAL should open. File Geodatabase zips (a `.gdb`
 * folder inside, or a `*.gdb.zip` name) are unzipped to `extractDir` so
 * ogr2ogr does not read through `/vsizip`. Shapefile zips stay on
 * `/vsizip`. Extract errors are fatal when we already know it is a GDB.
 */
export async function prepareVectorGdalSource(
  filePath: string,
  extractDir: string,
  options?: {onExtracting?: () => void | Promise<void>}
): Promise<PreparedVectorGdalSource> {
  if (extensionOf(filePath) !== '.zip') {
    return {source: filePath};
  }
  const entries = await listZipEntries(filePath);
  const names = entries.map(entry => entry.name);
  const folders = fileGdbFoldersInZip(names);
  if (folders.length > 1) {
    throw new Error(
      `${path.basename(filePath)} contains ${folders.length} File Geodatabases. Zip one .gdb only.`
    );
  }
  const knownGdb =
    folders.length === 1 || filePath.toLowerCase().endsWith(GDB_ZIP_SUFFIX);
  if (!knownGdb) {
    return {source: gdalVsiZipSource(filePath)};
  }
  assertZipExtractAllowed(entries);
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
  return {source: gdalVsiZipSource(filePath)};
}
