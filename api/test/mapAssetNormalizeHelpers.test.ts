// SPDX-License-Identifier: Apache-2.0
import {mkdtemp, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {GdalCommandError} from '../src/couchdb/export/gdal';
import {
  assertHasCrs,
  extentFromRing,
  gdalSourcePath,
  maxZoomFromMbtilesInfo,
  normalizeMapUpload,
  overviewFactors,
  readPmtilesHeader,
  sharedDiskDirectory,
  wktFromInfo,
} from '../src/couchdb/mapAssets/normalize';

const readGdalJson = vi.hoisted(() => vi.fn());
const runGdalCommand = vi.hoisted(() => vi.fn());
const prepareVectorGdalSource = vi.hoisted(() => vi.fn());

vi.mock('../src/couchdb/export/gdal', async () => {
  const actual = await vi.importActual<
    typeof import('../src/couchdb/export/gdal')
  >('../src/couchdb/export/gdal');
  return {
    ...actual,
    readGdalJson,
    runGdalCommand,
  };
});

vi.mock('../src/couchdb/mapAssets/zipSources', () => ({
  prepareVectorGdalSource,
}));

function pmtilesHeaderBytes({
  magic = 'PMTiles',
  version = 3,
  minZoom = 0,
  maxZoom = 4,
  west = 0,
  south = 0,
  east = 1,
  north = 1,
  length = 127,
}: {
  magic?: string;
  version?: number;
  minZoom?: number;
  maxZoom?: number;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  length?: number;
} = {}): Buffer {
  const header = Buffer.alloc(length);
  header.write(magic, 0, Math.min(magic.length, 7), 'utf8');
  if (length > 7) {
    header[7] = version;
  }
  if (length > 101) {
    header[100] = minZoom;
    header[101] = maxZoom;
  }
  if (length >= 118) {
    header.writeInt32LE(Math.round(west * 1e7), 102);
    header.writeInt32LE(Math.round(south * 1e7), 106);
    header.writeInt32LE(Math.round(east * 1e7), 110);
    header.writeInt32LE(Math.round(north * 1e7), 114);
  }
  return header;
}

async function writeTempPmtiles(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'faims-pmtiles-'));
  const filePath = path.join(dir, 'normalized.pmtiles');
  await writeFile(filePath, bytes);
  return filePath;
}

describe('normalize CRS helpers', () => {
  it('reads WKT from coordinateSystem, geometry fields, then layer srs', () => {
    expect(wktFromInfo(null)).toBe('');
    expect(wktFromInfo('not-an-object')).toBe('');
    expect(wktFromInfo({})).toBe('');
    expect(wktFromInfo({coordinateSystem: {wkt: '  GEOGCS["WGS 84"]  '}})).toBe(
      '  GEOGCS["WGS 84"]  '
    );
    expect(
      wktFromInfo({
        layers: [
          {geometryFields: [{coordinateSystem: {wkt: 'PROJCS["utm"]'}}]},
        ],
      })
    ).toBe('PROJCS["utm"]');
    expect(wktFromInfo({layers: [{srs: 'EPSG:4326'}]})).toBe('EPSG:4326');
  });

  it('rejects missing or unknown CRS', () => {
    expect(() =>
      assertHasCrs(
        {coordinateSystem: {wkt: 'GEOGCS["WGS 84"]'}},
        'sites.geojson'
      )
    ).not.toThrow();
    expect(() => assertHasCrs({}, 'sites.geojson')).toThrow(
      /no coordinate reference system/
    );
    expect(() =>
      assertHasCrs({coordinateSystem: {wkt: 'unknown'}}, 'plan.tif')
    ).toThrow(/no coordinate reference system/);
  });

  it('opens zip rasters through /vsizip/', () => {
    expect(gdalSourcePath('/tmp/plan.tif')).toBe('/tmp/plan.tif');
    expect(gdalSourcePath('/tmp/survey.zip')).toBe('/vsizip//tmp/survey.zip');
  });
});

describe('normalize tiling helpers', () => {
  it('builds power-of-two overview factors down to zoom 0', () => {
    expect(overviewFactors(0)).toEqual([]);
    expect(overviewFactors(1)).toEqual(['2']);
    expect(overviewFactors(3)).toEqual(['2', '4', '8']);
  });

  it('reads the first valid MBTiles maxzoom', () => {
    expect(maxZoomFromMbtilesInfo(null)).toBe(0);
    expect(maxZoomFromMbtilesInfo({})).toBe(0);
    expect(maxZoomFromMbtilesInfo({metadata: {a: {maxzoom: 'nope'}}})).toBe(0);
    expect(maxZoomFromMbtilesInfo({metadata: {a: {maxzoom: 31}}})).toBe(0);
    expect(
      maxZoomFromMbtilesInfo({
        metadata: {skip: {maxzoom: 1.5}, keep: {maxzoom: 12}},
      })
    ).toBe(12);
  });

  it('computes an extent from a ring and skips bad pairs', () => {
    expect(
      extentFromRing([
        [1, 2],
        [3, 4],
        ['x' as unknown as number, 0],
      ])
    ).toEqual([1, 2, 3, 4]);
    expect(() => extentFromRing([])).toThrow(/did not report an extent/);
  });

  it('reuses a shared on-disk directory only when every file is there', () => {
    expect(sharedDiskDirectory([])).toBeUndefined();
    expect(
      sharedDiskDirectory([{filename: 'a.geojson', bytes: Buffer.from('x')}])
    ).toBeUndefined();
    expect(
      sharedDiskDirectory([
        {filename: 'a.geojson', diskPath: '/tmp/upload/a.geojson'},
        {filename: 'b.geojson', diskPath: '/tmp/other/b.geojson'},
      ])
    ).toBeUndefined();
    expect(
      sharedDiskDirectory([
        {filename: 'a.geojson', diskPath: '/tmp/upload/a.geojson'},
        {filename: 'notes.prj', bytes: Buffer.from('x')},
      ])
    ).toBeUndefined();
    expect(
      sharedDiskDirectory([
        {filename: 'a.geojson', diskPath: '/tmp/upload/a.geojson'},
        {filename: 'a.prj', diskPath: '/tmp/upload/a.prj'},
      ])
    ).toBe('/tmp/upload');
  });
});

describe('readPmtilesHeader', () => {
  const written: string[] = [];

  afterEach(async () => {
    await Promise.all(
      written
        .splice(0)
        .map(filePath =>
          rm(path.dirname(filePath), {recursive: true, force: true})
        )
    );
  });

  it('reads zoom and bounds from a v3 header', async () => {
    const filePath = await writeTempPmtiles(
      pmtilesHeaderBytes({
        minZoom: 2,
        maxZoom: 8,
        west: -10,
        south: -5,
        east: 10,
        north: 5,
      })
    );
    written.push(filePath);
    await expect(readPmtilesHeader(filePath)).resolves.toEqual({
      minZoom: 2,
      maxZoom: 8,
      extent4326: [-10, -5, 10, 5],
    });
  });

  it('rejects a short, non-PMTiles, or non-v3 header', async () => {
    const tooShort = await writeTempPmtiles(pmtilesHeaderBytes({length: 80}));
    written.push(tooShort);
    await expect(readPmtilesHeader(tooShort)).rejects.toThrow(
      /not a PMTiles archive/
    );

    const wrongMagic = await writeTempPmtiles(
      pmtilesHeaderBytes({magic: 'NOTILES'})
    );
    written.push(wrongMagic);
    await expect(readPmtilesHeader(wrongMagic)).rejects.toThrow(
      /not a PMTiles archive/
    );

    const v2 = await writeTempPmtiles(pmtilesHeaderBytes({version: 2}));
    written.push(v2);
    await expect(readPmtilesHeader(v2)).rejects.toThrow(
      /not a PMTiles v3 archive/
    );
  });

  it('rejects an inverted geographic extent', async () => {
    const inverted = await writeTempPmtiles(
      pmtilesHeaderBytes({west: 10, south: 5, east: 1, north: 0})
    );
    written.push(inverted);
    await expect(readPmtilesHeader(inverted)).rejects.toThrow(
      /no geographic extent/
    );
  });
});

describe('normalizeMapUpload', () => {
  afterEach(() => {
    readGdalJson.mockReset();
    runGdalCommand.mockReset();
    prepareVectorGdalSource.mockReset();
  });

  it('rejects an upload that has neither bytes nor a disk path', async () => {
    await expect(
      normalizeMapUpload([{filename: 'layer.geojson'}])
    ).rejects.toThrow(/missing data/);
  });

  it('deletes a copied work dir when CRS inspection fails', async () => {
    prepareVectorGdalSource.mockImplementation(async (sourcePath: string) => ({
      source: sourcePath,
    }));
    readGdalJson.mockResolvedValue({});
    await expect(
      normalizeMapUpload([
        {
          filename: 'layer.geojson',
          bytes: Buffer.from('{"type":"FeatureCollection","features":[]}'),
        },
      ])
    ).rejects.toThrow(/no coordinate reference system/);
  });

  it('wraps GDAL stderr when ogrinfo cannot read the file', async () => {
    prepareVectorGdalSource.mockImplementation(async (sourcePath: string) => ({
      source: sourcePath,
    }));
    readGdalJson.mockRejectedValue(
      new GdalCommandError('ogrinfo', ['-json'], 'not a recognised format', 1)
    );
    await expect(
      normalizeMapUpload([
        {filename: 'layer.geojson', bytes: Buffer.from('{}')},
      ])
    ).rejects.toThrow(
      /GDAL could not read layer.geojson: not a recognised format/
    );
  });

  it('forwards stages and writes vector PMTiles when tools succeed', async () => {
    prepareVectorGdalSource.mockImplementation(async (sourcePath: string) => ({
      source: sourcePath,
    }));
    readGdalJson.mockResolvedValue({
      coordinateSystem: {wkt: 'GEOGCS["WGS 84"]'},
    });
    runGdalCommand.mockImplementation(async ({command, args}) => {
      if (command === 'tippecanoe') {
        const output = args[args.indexOf('-o') + 1] as string;
        await writeFile(
          output,
          pmtilesHeaderBytes({
            minZoom: 0,
            maxZoom: 6,
            west: 1,
            south: 2,
            east: 3,
            north: 4,
          })
        );
      }
    });
    const stages: string[] = [];
    const result = await normalizeMapUpload(
      [
        {
          filename: 'layer.geojson',
          bytes: Buffer.from('{"type":"FeatureCollection","features":[]}'),
        },
      ],
      {onStage: stage => void stages.push(stage)}
    );
    expect(stages).toEqual([
      'interpreting-crs',
      'converting-geometries',
      'tiling-vectors',
    ]);
    expect(result.kind).toBe('vector-tiles');
    expect(result.cleanupDir).toBeTruthy();
    expect(result.extent4326).toEqual([1, 2, 3, 4]);
    expect(result.minZoom).toBe(0);
    expect(result.maxZoom).toBe(6);
    if (result.cleanupDir) {
      await rm(result.cleanupDir, {recursive: true, force: true});
    }
  });
});
