// SPDX-License-Identifier: Apache-2.0
import {mkdtemp, readFile, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {afterEach, describe, expect, it} from 'vitest';
import {
  flattenNestedFeatureCollections,
  isGeoJsonPath,
} from '../src/spatial/flattenGeoJson';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map(dir => rm(dir, {recursive: true, force: true}))
  );
});

async function flatten(source: unknown): Promise<{
  count: number;
  collection: {
    type: string;
    features: {type: string; geometry: {type: string; coordinates: unknown}}[];
  };
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
  dirs.push(dir);
  const input = path.join(dir, 'in.geojson');
  const output = path.join(dir, 'out.geojson');
  await writeFile(input, JSON.stringify(source));
  const count = await flattenNestedFeatureCollections(input, output);
  return {count, collection: JSON.parse(await readFile(output, 'utf8'))};
}

describe('flattenNestedFeatureCollections', () => {
  it('recognises GeoJSON upload paths', () => {
    expect(isGeoJsonPath('layer.geojson')).toBe(true);
    expect(isGeoJsonPath('/tmp/nested.JSON')).toBe(true);
    expect(isGeoJsonPath('parcels.gdb')).toBe(false);
    expect(isGeoJsonPath('sites.gpkg')).toBe(false);
  });

  it('walks FeatureCollection-in-FeatureCollection down to leaf Features', async () => {
    const {count, collection} = await flatten({
      type: 'FeatureCollection',
      name: 'nested-depth3-z',
      features: [
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [134.43, -11.29, 412.1],
                  },
                  properties: {name: 'a'},
                },
                {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [134.4, -11.3, 10],
                      [134.5, -11.2, 11],
                    ],
                  },
                  properties: {},
                },
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [134.4, -11.3, 1],
                        [134.5, -11.3, 1],
                        [134.5, -11.2, 1],
                        [134.4, -11.2, 1],
                        [134.4, -11.3, 1],
                      ],
                    ],
                  },
                  properties: {z: true},
                },
              ],
            },
          ],
        },
      ],
    });
    expect(count).toBe(3);
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features.map(feature => feature.geometry.type)).toEqual([
      'Point',
      'LineString',
      'Polygon',
    ]);
    expect(collection.features[0].geometry.coordinates).toEqual([
      134.43, -11.29, 412.1,
    ]);
  });

  it('copies a root legacy crs member onto the flattened collection', async () => {
    const crs = {
      type: 'name',
      properties: {name: 'urn:ogc:def:crs:EPSG::28356'},
    };
    const {collection} = await flatten({
      type: 'FeatureCollection',
      crs,
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [334000, 6244000]},
          properties: {},
        },
      ],
    });
    expect((collection as {crs?: unknown}).crs).toEqual(crs);
    expect(collection.features).toHaveLength(1);
  });

  it('keeps root crs when the key appears after features', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
    dirs.push(dir);
    const input = path.join(dir, 'in.geojson');
    const output = path.join(dir, 'out.geojson');
    await writeFile(
      input,
      '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]},"properties":{}}],"crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::3857"}}}'
    );
    await flattenNestedFeatureCollections(input, output);
    const collection = JSON.parse(await readFile(output, 'utf8')) as {
      crs?: {properties?: {name?: string}};
      features: unknown[];
    };
    expect(collection.crs?.properties?.name).toBe('urn:ogc:def:crs:EPSG::3857');
    expect(collection.features).toHaveLength(1);
  });

  it('does not promote a nested collection crs to the root', async () => {
    const {collection} = await flatten({
      type: 'FeatureCollection',
      features: [
        {
          type: 'FeatureCollection',
          crs: {
            type: 'name',
            properties: {name: 'urn:ogc:def:crs:EPSG::28356'},
          },
          features: [
            {
              type: 'Feature',
              geometry: {type: 'Point', coordinates: [1, 2]},
              properties: {},
            },
          ],
        },
      ],
    });
    expect((collection as {crs?: unknown}).crs).toBeUndefined();
  });

  it('keeps an already-flat FeatureCollection as Features', async () => {
    const {count, collection} = await flatten({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [1, 2]},
          properties: {},
        },
      ],
    });
    expect(count).toBe(1);
    expect(collection.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [1, 2],
    });
  });

  it('reads features when the features key appears before type', async () => {
    const {count, collection} = await flatten({
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [10, -20]},
          properties: {},
        },
      ],
      type: 'FeatureCollection',
    });
    expect(count).toBe(1);
    expect(collection.features[0].geometry.coordinates).toEqual([10, -20]);
  });

  it('wraps a root geometry and skips null-geometry Features', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
    dirs.push(dir);
    const input = path.join(dir, 'in.geojson');
    const output = path.join(dir, 'out.geojson');
    await writeFile(
      input,
      JSON.stringify({type: 'Point', coordinates: [150.0, -33.8]})
    );
    expect(await flattenNestedFeatureCollections(input, output)).toBe(1);
    const {count} = await flatten({
      type: 'FeatureCollection',
      features: [
        {type: 'Feature', geometry: null, properties: {}},
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [0, 0]},
          properties: {},
        },
      ],
    });
    expect(count).toBe(1);
  });

  it('reports rising byte percent to onProgress', async () => {
    const percents: number[] = [];
    const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
    dirs.push(dir);
    const input = path.join(dir, 'in.geojson');
    const output = path.join(dir, 'out.geojson');
    await writeFile(
      input,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [1, 2]},
                properties: {},
              },
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [3, 4]},
                properties: {},
              },
            ],
          },
        ],
      })
    );
    await flattenNestedFeatureCollections(input, output, update => {
      percents.push(update.percent);
    });
    expect(percents[0]).toBeGreaterThanOrEqual(0);
    expect(percents[percents.length - 1]).toBe(100);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
  });

  it('ticks percent while scanning a large geometry', async () => {
    const percents: number[] = [];
    const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
    dirs.push(dir);
    const input = path.join(dir, 'in.geojson');
    const output = path.join(dir, 'out.geojson');
    const coordinates = Array.from({length: 12_000}, (_, i) => [
      i * 0.0001,
      -i * 0.0001,
    ]);
    await writeFile(
      input,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {type: 'MultiPoint', coordinates},
            properties: {},
          },
        ],
      })
    );
    await flattenNestedFeatureCollections(input, output, update => {
      percents.push(update.percent);
    });
    expect(percents[0]).toBeGreaterThanOrEqual(0);
    expect(percents[percents.length - 1]).toBe(100);
    expect(percents.some(percent => percent > 0 && percent < 100)).toBe(true);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
  });

  it('keeps ticking when nested features appear before type', async () => {
    const percents: number[] = [];
    const dir = await mkdtemp(path.join(tmpdir(), 'flatten-geojson-'));
    dirs.push(dir);
    const input = path.join(dir, 'in.geojson');
    const output = path.join(dir, 'out.geojson');
    const leaf = (i: number) => ({
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [i, -i]},
      properties: {i},
    });
    const first = Array.from({length: 4_000}, (_, i) => leaf(i));
    const second = Array.from({length: 4_000}, (_, i) => leaf(i + 4_000));
    await writeFile(
      input,
      JSON.stringify({
        features: [
          {features: first, type: 'FeatureCollection'},
          {features: second, type: 'FeatureCollection'},
        ],
        type: 'FeatureCollection',
      })
    );
    const count = await flattenNestedFeatureCollections(
      input,
      output,
      update => {
        percents.push(update.percent);
      }
    );
    expect(count).toBe(8_000);
    expect(percents[percents.length - 1]).toBe(100);
    expect(percents.some(percent => percent > 10 && percent < 90)).toBe(true);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    const collection = JSON.parse(await readFile(output, 'utf8')) as {
      features: unknown[];
    };
    expect(collection.features).toHaveLength(8_000);
  });
});
