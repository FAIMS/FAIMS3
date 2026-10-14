// SPDX-License-Identifier: Apache-2.0
import {mkdtemp, readdir, readFile, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {
  isGdalAvailable,
  readGdalJson,
  runGdalCommand,
} from '../src/couchdb/export/gdal';
import {
  fileGdbFoldersInZip,
  listZipEntryNames,
  resolveVectorGdalSource,
} from '../src/couchdb/mapAssets/zipSources';

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

/** Uncompressed zip for resolver tests. */
function buildZip(files: {name: string; data?: Uint8Array}[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const file of files) {
    const data = file.data ?? new Uint8Array(0);
    const name = encoder.encode(file.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = viewOf(local);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const centralView = viewOf(central);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cd = concatBytes(centrals);
  const eocd = new Uint8Array(22);
  const eocdView = viewOf(eocd);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cd.length, true);
  eocdView.setUint32(16, offset, true);
  return concatBytes([...locals, cd, eocd]);
}

async function writeZip(
  dir: string,
  filename: string,
  files: {name: string; data?: Uint8Array}[]
): Promise<string> {
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buildZip(files));
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
});
