// SPDX-License-Identifier: Apache-2.0
import {INPUT_LIMITS, mapAssetExtractTooLargeMessage} from '@faims3/data-model';
import {spawn} from 'child_process';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {
  isGdalAvailable,
  readGdalJson,
  runGdalCommand,
} from '../src/couchdb/export/gdal';
import {
  assertExtractContainsNoSymlinks,
  assertZipExtractAllowed,
  fileGdbFoldersInZip,
  listZipEntries,
  listZipEntryNames,
  prepareVectorGdalSource,
  resolveVectorGdalSource,
  zipEntryIsUnixSymlink,
  zipEntryPathIsUnsafe,
} from '../src/couchdb/mapAssets/zipSources';
import {
  ogr2ogrGeometryArgs,
  vectorIntermediatePlan,
} from '../src/spatial/gdalPerformance';

function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

type ZipTestFile = {
  name: string;
  data?: Uint8Array;
  uncompressedSize?: bigint;
  omitZip64Extra?: boolean;
  unixMode?: number;
};

function zip64Extra(uncompressedSize: bigint): Uint8Array {
  const extra = new Uint8Array(12);
  const extraView = viewOf(extra);
  extraView.setUint16(0, 0x0001, true);
  extraView.setUint16(2, 8, true);
  extraView.setBigUint64(4, uncompressedSize, true);
  return extra;
}

/** Uncompressed zip for resolver tests. */
function buildZip(
  files: ZipTestFile[],
  options?: {zip64Eocd?: boolean}
): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const file of files) {
    const data = file.data ?? new Uint8Array(0);
    const name = encoder.encode(file.name);
    const crc = crc32(data);
    const claimed = file.uncompressedSize ?? BigInt(data.length);
    const useZip64Size = claimed >= BigInt(0xffffffff) && !file.omitZip64Extra;
    const extra = useZip64Size ? zip64Extra(claimed) : new Uint8Array(0);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = viewOf(local);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, useZip64Size ? 45 : 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const zipVersion = useZip64Size ? 45 : 20;
    const versionMadeBy =
      file.unixMode === undefined ? zipVersion : (3 << 8) | zipVersion;
    const central = new Uint8Array(46 + name.length + extra.length);
    const centralView = viewOf(central);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, versionMadeBy, true);
    centralView.setUint16(6, zipVersion, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(
      24,
      useZip64Size || file.omitZip64Extra ? 0xffffffff : Number(claimed),
      true
    );
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, extra.length, true);
    if (file.unixMode !== undefined) {
      centralView.setUint32(38, (file.unixMode & 0xffff) << 16, true);
    }
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    central.set(extra, 46 + name.length);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cd = concatBytes(centrals);
  if (!options?.zip64Eocd) {
    const eocd = new Uint8Array(22);
    const eocdView = viewOf(eocd);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cd.length, true);
    eocdView.setUint32(16, offset, true);
    return concatBytes([...locals, cd, eocd]);
  }
  const zip64Eocd = new Uint8Array(56);
  const zip64View = viewOf(zip64Eocd);
  zip64View.setUint32(0, 0x06064b50, true);
  zip64View.setBigUint64(4, BigInt(44), true);
  zip64View.setUint16(12, 45, true);
  zip64View.setUint16(14, 45, true);
  zip64View.setBigUint64(24, BigInt(files.length), true);
  zip64View.setBigUint64(32, BigInt(files.length), true);
  zip64View.setBigUint64(40, BigInt(cd.length), true);
  zip64View.setBigUint64(48, BigInt(offset), true);
  const locator = new Uint8Array(20);
  const locatorView = viewOf(locator);
  locatorView.setUint32(0, 0x07064b50, true);
  locatorView.setBigUint64(8, BigInt(offset + cd.length), true);
  locatorView.setUint32(16, 1, true);
  const eocd = new Uint8Array(22);
  const eocdView = viewOf(eocd);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, 0xffff, true);
  eocdView.setUint16(10, 0xffff, true);
  eocdView.setUint32(12, 0xffffffff, true);
  eocdView.setUint32(16, 0xffffffff, true);
  return concatBytes([...locals, cd, zip64Eocd, locator, eocd]);
}

async function writeZip(
  dir: string,
  filename: string,
  files: ZipTestFile[],
  options?: {zip64Eocd?: boolean}
): Promise<string> {
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buildZip(files, options));
  return filePath;
}

describe('fileGdbFoldersInZip', () => {
  it('finds a .gdb folder including nested and Windows paths', () => {
    expect(
      fileGdbFoldersInZip(['Sites.gdb/', 'Sites.gdb/a00000001.gdbtable'])
    ).toEqual(['Sites.gdb']);
    expect(
      fileGdbFoldersInZip(['export\\Bores.gdb\\a00000001.gdbtable'])
    ).toEqual(['export/Bores.gdb']);
  });

  it('returns every distinct .gdb folder', () => {
    expect(
      fileGdbFoldersInZip(['one.gdb/a.gdbtable', 'two.gdb/b.gdbtable'])
    ).toEqual(['one.gdb', 'two.gdb']);
  });
});

describe('resolveVectorGdalSource', () => {
  it('leaves a non-zip path unchanged', async () => {
    expect(await resolveVectorGdalSource('/tmp/layer.geojson')).toBe(
      '/tmp/layer.geojson'
    );
  });

  it('opens a zip with one .gdb folder at that folder', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-gdb-zip-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {name: 'Sites.gdb/'},
        {name: 'Sites.gdb/a00000001.gdbtable', data: new Uint8Array([0x78])},
      ]);
      expect(await listZipEntryNames(zipPath)).toEqual([
        'Sites.gdb/',
        'Sites.gdb/a00000001.gdbtable',
      ]);
      expect(await resolveVectorGdalSource(zipPath)).toBe(
        `/vsizip/${zipPath}/Sites.gdb`
      );
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('keeps a shapefile zip at the zip root', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-shp-zip-'));
    try {
      const zipPath = await writeZip(dir, 'plots.zip', [
        {name: 'plots.shp', data: new Uint8Array([0x78])},
        {name: 'plots.shx', data: new Uint8Array([0x78])},
        {name: 'plots.dbf', data: new Uint8Array([0x78])},
        {name: 'plots.prj', data: new Uint8Array([0x78])},
      ]);
      expect(await resolveVectorGdalSource(zipPath)).toBe(`/vsizip/${zipPath}`);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('rejects a zip that contains two File Geodatabases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-two-gdb-'));
    try {
      const zipPath = await writeZip(dir, 'both.gdb.zip', [
        {name: 'one.gdb/a.gdbtable', data: new Uint8Array([0x78])},
        {name: 'two.gdb/b.gdbtable', data: new Uint8Array([0x78])},
      ]);
      await expect(resolveVectorGdalSource(zipPath)).rejects.toThrow(
        /2 File Geodatabases/
      );
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });
});

function unzipAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('unzip', [], {stdio: 'ignore'});
    proc.on('error', () => resolve(false));
    proc.on('close', () => resolve(true));
  });
}

describe('prepareVectorGdalSource', () => {
  it('extracts a File Geodatabase zip to a real folder', async () => {
    if (!(await unzipAvailable())) {
      return;
    }
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-gdb-extract-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {name: 'Sites.gdb/'},
        {name: 'Sites.gdb/a00000001.gdbtable', data: new Uint8Array([0x78])},
      ]);
      const extractDir = path.join(dir, 'extracted');
      const prepared = await prepareVectorGdalSource(zipPath, extractDir);
      expect(prepared.source).toBe(path.join(extractDir, 'Sites.gdb'));
      expect(prepared.extractedGdbDir).toBe(path.join(extractDir, 'Sites.gdb'));
      expect(await readdir(prepared.source)).toContain('a00000001.gdbtable');
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('leaves a shapefile zip on /vsizip', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-shp-prepare-'));
    try {
      const zipPath = await writeZip(dir, 'plots.zip', [
        {name: 'plots.shp', data: new Uint8Array([0x78])},
      ]);
      const prepared = await prepareVectorGdalSource(
        zipPath,
        path.join(dir, 'extracted')
      );
      expect(prepared.source).toBe(`/vsizip/${zipPath}`);
      expect(prepared.extractedGdbDir).toBeUndefined();
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('extracts a ZIP64 File Geodatabase zip', async () => {
    if (!(await unzipAvailable())) {
      return;
    }
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-gdb-zip64-'));
    try {
      const zipPath = await writeZip(
        dir,
        'Sites.gdb.zip',
        [
          {name: 'Sites.gdb/'},
          {name: 'Sites.gdb/a00000001.gdbtable', data: new Uint8Array([0x78])},
        ],
        {zip64Eocd: true}
      );
      const extractDir = path.join(dir, 'extracted');
      const prepared = await prepareVectorGdalSource(zipPath, extractDir);
      expect(prepared.source).toBe(path.join(extractDir, 'Sites.gdb'));
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('refuses a zip whose entries escape the extract directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-zip-slip-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {name: '../Sites.gdb/a00000001.gdbtable', data: new Uint8Array([0x78])},
      ]);
      await expect(
        prepareVectorGdalSource(zipPath, path.join(dir, 'extracted'))
      ).rejects.toThrow(/path that is not allowed/);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('refuses a zip that claims more uncompressed bytes than the extract cap', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-zip-bomb-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {
          name: 'Sites.gdb/a00000001.gdbtable',
          data: new Uint8Array([0x78]),
          uncompressedSize:
            BigInt(INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES) + BigInt(1),
        },
      ]);
      await expect(
        prepareVectorGdalSource(zipPath, path.join(dir, 'extracted'))
      ).rejects.toThrow(mapAssetExtractTooLargeMessage());
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });
});

describe('zip extract safety', () => {
  it('rejects parent, absolute, and NUL entry names', () => {
    expect(zipEntryPathIsUnsafe('../Sites.gdb/a')).toBe(true);
    expect(zipEntryPathIsUnsafe('Sites.gdb/foo/../../../etc/passwd')).toBe(
      true
    );
    expect(zipEntryPathIsUnsafe('/tmp/Sites.gdb/a')).toBe(true);
    expect(zipEntryPathIsUnsafe('C:/Sites.gdb/a')).toBe(true);
    expect(zipEntryPathIsUnsafe('Sites.gdb/a\0.gdbtable')).toBe(true);
    expect(zipEntryPathIsUnsafe('Sites.gdb/a00000001.gdbtable')).toBe(false);
  });

  it('detects Unix and OS X symlink modes, not DOS attributes', () => {
    expect(zipEntryIsUnixSymlink(0x0314, 0o120777 << 16)).toBe(true);
    expect(zipEntryIsUnixSymlink(0x1314, 0o120644 << 16)).toBe(true);
    expect(zipEntryIsUnixSymlink(0x0314, 0o100644 << 16)).toBe(false);
    expect(zipEntryIsUnixSymlink(20, 0o120777 << 16)).toBe(false);
  });

  it('refuses a zip whose entries are Unix symbolic links', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-zip-symlink-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {name: 'Sites.gdb/'},
        {
          name: 'Sites.gdb/a00000001.gdbtable',
          data: new TextEncoder().encode('outside-the-extract-dir'),
          unixMode: 0o120777,
        },
      ]);
      const entries = await listZipEntries(zipPath);
      expect(entries[1]?.isUnixSymlink).toBe(true);
      await expect(
        prepareVectorGdalSource(zipPath, path.join(dir, 'extracted'))
      ).rejects.toThrow(/symbolic link that is not allowed/);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('refuses an extract tree that still contains a symbolic link', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-extract-symlink-'));
    try {
      const gdbDir = path.join(dir, 'Sites.gdb');
      await mkdir(gdbDir, {recursive: true});
      await writeFile(path.join(gdbDir, 'gdb'), 'x');
      await symlink('gdb', path.join(gdbDir, 'a00000001.gdbtable'));
      await expect(assertExtractContainsNoSymlinks(dir)).rejects.toThrow(
        /symbolic link that is not allowed/
      );
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('lists ZIP64 central directories and uncompressed sizes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-zip64-list-'));
    try {
      const zipPath = await writeZip(
        dir,
        'Sites.gdb.zip',
        [
          {name: 'Sites.gdb/'},
          {
            name: 'Sites.gdb/a00000001.gdbtable',
            data: new Uint8Array([0x78]),
            uncompressedSize:
              BigInt(5) * BigInt(1024) * BigInt(1024) * BigInt(1024),
          },
        ],
        {zip64Eocd: true}
      );
      const entries = await listZipEntries(zipPath);
      expect(entries.map(entry => entry.name)).toEqual([
        'Sites.gdb/',
        'Sites.gdb/a00000001.gdbtable',
      ]);
      expect(entries[1]?.uncompressedSize).toBe(
        BigInt(5) * BigInt(1024) * BigInt(1024) * BigInt(1024)
      );
      expect(() => assertZipExtractAllowed(entries)).not.toThrow();
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('fails closed when ZIP64 uncompressed size is missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-zip64-missing-'));
    try {
      const zipPath = await writeZip(dir, 'Sites.gdb.zip', [
        {
          name: 'Sites.gdb/a00000001.gdbtable',
          data: new Uint8Array([0x78]),
          uncompressedSize: BigInt(0xffffffff),
          omitZip64Extra: true,
        },
      ]);
      await expect(
        prepareVectorGdalSource(zipPath, path.join(dir, 'extracted'))
      ).rejects.toThrow(mapAssetExtractTooLargeMessage());
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });
});

describe('OpenFileGDB zip', () => {
  it('lets GDAL read a zipped File Geodatabase at the resolved path', async () => {
    if (!(await isGdalAvailable())) {
      return;
    }
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-openfilegdb-'));
    try {
      const geojson = path.join(dir, 'in.geojson');
      const gdbDir = path.join(dir, 'Bores.gdb');
      const zipPath = path.join(dir, 'Bores.gdb.zip');
      await writeFile(
        geojson,
        JSON.stringify({
          type: 'FeatureCollection',
          crs: {type: 'name', properties: {name: 'EPSG:4326'}},
          features: [
            {
              type: 'Feature',
              properties: {name: 'bore'},
              geometry: {type: 'Point', coordinates: [151.2, -33.8]},
            },
          ],
        })
      );
      await runGdalCommand({
        command: 'ogr2ogr',
        args: ['-f', 'OpenFileGDB', gdbDir, geojson],
      });
      const entries: {name: string; data?: Uint8Array}[] = [
        {name: 'Bores.gdb/'},
      ];
      for (const name of await readdir(gdbDir)) {
        entries.push({
          name: `Bores.gdb/${name}`,
          data: new Uint8Array(await readFile(path.join(gdbDir, name))),
        });
      }
      await writeFile(zipPath, buildZip(entries));
      const source = await resolveVectorGdalSource(zipPath);
      expect(source).toBe(`/vsizip/${zipPath}/Bores.gdb`);
      const info = (await readGdalJson({
        command: 'ogrinfo',
        args: ['-json', '-so', '-al', source],
      })) as {
        layers?: {geometryFields?: {type?: string}[]}[];
      };
      expect(info.layers?.[0]?.geometryFields?.[0]?.type).toBe('Point');
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it('writes a MultiPolygon source to FlatGeobuf with the ingest args', async () => {
    if (!(await isGdalAvailable())) {
      return;
    }
    const dir = await mkdtemp(path.join(tmpdir(), 'faims-ogr-multi-'));
    try {
      const input = path.join(dir, 'in.geojson');
      const output = path.join(dir, 'out.fgb');
      await writeFile(
        input,
        JSON.stringify({
          type: 'FeatureCollection',
          crs: {type: 'name', properties: {name: 'EPSG:4326'}},
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'MultiPolygon',
                coordinates: [
                  [
                    [
                      [148.0, -35.0],
                      [148.1, -35.0],
                      [148.1, -34.9],
                      [148.0, -34.9],
                      [148.0, -35.0],
                    ],
                  ],
                  [
                    [
                      [148.2, -35.0],
                      [148.3, -35.0],
                      [148.3, -34.9],
                      [148.2, -34.9],
                      [148.2, -35.0],
                    ],
                  ],
                ],
              },
            },
          ],
        })
      );
      const plan = vectorIntermediatePlan({
        layers: [{geometryFields: [{type: 'MultiPolygon'}]}],
      });
      await runGdalCommand({
        command: 'ogr2ogr',
        args: ogr2ogrGeometryArgs(output, input, plan),
      });
      const info = (await readGdalJson({
        command: 'ogrinfo',
        args: ['-json', '-so', '-al', output],
      })) as {
        layers?: {featureCount?: number; geometryFields?: {type?: string}[]}[];
      };
      expect(info.layers?.[0]?.geometryFields?.[0]?.type).toBe('MultiPolygon');
      expect(info.layers?.[0]?.featureCount).toBe(1);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });
});
