// SPDX-License-Identifier: Apache-2.0
/**
 * Fixtures were built from GDAL MBTiles (WebP) plus `pmtiles convert`, and
 * from tippecanoe `-z 14 --drop-densest-as-needed` (older fixtures used `-zg`)
 * on a 4,000-point GeoJSON. The low zoom tile is far smaller than that file.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {get as getProjection} from 'ol/proj';
import TileState from 'ol/TileState';
import {describe, expect, it, vi} from 'vitest';
import {PMTiles, ResolvedValueCache, TileType} from 'pmtiles';
import {
  createContextualTileLoadGate,
  createRasterTileLayer,
  createVectorTileLayer,
  resetErrorTiles,
  CONTEXTUAL_TILE_LOAD_GATE,
} from './contextualTileLayers';
import type {ContextualMapLayer} from './contextualMapLayers';
import {resolveMapPerformanceProfile} from './mapPerformance';
import {readBlobRange} from './pmtilesRange';

function fixture(name: string): Blob {
  const bytes = readFileSync(
    join(process.cwd(), 'lib/components/maps/fixtures', name)
  );
  return new Blob([bytes]);
}

function layer(
  kind: 'raster-tiles' | 'vector-tiles',
  file: Blob
): ContextualMapLayer {
  const reads: number[] = [];
  return {
    id: kind,
    name: kind,
    kind,
    url: kind,
    visible: true,
    opacity: 1,
    zIndex: 1,
    stroke: '#1565c0',
    fill: '#1565c040',
    lineWidth: 2,
    pointSize: 6,
    extent4326: [151.2, -33.85, 151.22, -33.83],
    readTileBytes: async (offset, length) => {
      reads.push(length);
      return readBlobRange(file, offset, length);
    },
    reads,
  } as ContextualMapLayer & {reads: number[]};
}

describe('local PMTiles layers', () => {
  it('reads a raster archive header without loading a world of tiles', async () => {
    const file = fixture('raster.pmtiles');
    const spec = layer('raster-tiles', file);
    const archive = new PMTiles({
      getKey: () => 'raster',
      getBytes: async (offset, length) => ({
        data: await spec.readTileBytes!(offset, length),
      }),
    });
    const header = await archive.getHeader();
    expect(header.tileType).toBe(TileType.Webp);
    expect(header.minZoom).toBe(11);
    expect(header.maxZoom).toBe(12);
    expect(header.maxZoom).toBeGreaterThanOrEqual(header.minZoom);

    const olLayer = await createRasterTileLayer(spec);
    expect(olLayer.get('preload')).toBe(0);
    expect(olLayer.get('cacheSize')).toBe(
      resolveMapPerformanceProfile().tileCacheSize
    );
    expect(olLayer.get(CONTEXTUAL_TILE_LOAD_GATE)).toBeDefined();
    const reads = (spec as ContextualMapLayer & {reads: number[]}).reads;
    expect(reads.every(length => length < file.size || file.size < 16384)).toBe(
      true
    );
    expect(Math.max(...reads)).toBeLessThanOrEqual(16384);
  });

  it('keeps a low-zoom vector tile smaller than the source point file', async () => {
    const file = fixture('points.pmtiles');
    const spec = layer('vector-tiles', file);
    const olLayer = await createVectorTileLayer(spec);
    expect(olLayer.get('preload')).toBe(0);
    expect(olLayer.get('cacheSize')).toBe(
      resolveMapPerformanceProfile().tileCacheSize
    );
    expect(olLayer.getRenderBuffer()).toBe(
      resolveMapPerformanceProfile().renderBuffer
    );
    expect(olLayer.getUpdateWhileInteracting()).toBe(false);
    expect(olLayer.getUpdateWhileAnimating()).toBe(false);
    const archive = new PMTiles({
      getKey: () => 'vector',
      getBytes: async (offset, length) => ({
        data: await spec.readTileBytes!(offset, length),
      }),
    });
    const header = await archive.getHeader();
    expect(header.tileType).toBe(TileType.Mvt);
    expect(header.minZoom).toBe(0);
    expect(header.maxZoom).toBe(11);
    const lowZoom = await archive.getZxy(header.minZoom, 0, 0);
    expect(lowZoom).toBeDefined();
    // The source GeoJSON for these 4,000 points is 566,475 bytes.
    expect(lowZoom!.data.byteLength).toBeLessThan(10_000);
    expect(file.size).toBeLessThan(566_475);

    const projection = getProjection('EPSG:3857');
    expect(projection).toBeTruthy();
    const renderTile = olLayer.getSource()!.getTile(0, 0, 0, 1, projection!);
    expect(renderTile.getState()).not.toBe(TileState.EMPTY);
    renderTile.load();
    await vi.waitFor(() => {
      expect(renderTile.getState()).toBe(TileState.LOADED);
    });
    const features = renderTile.sourceTiles.flatMap(tile => tile.getFeatures());
    expect(features.length).toBeGreaterThan(0);
    expect(
      features.every(feature => feature.getGeometry()?.getType() === 'Point')
    ).toBe(true);
    expect(olLayer.get(CONTEXTUAL_TILE_LOAD_GATE)).toBeDefined();
  });

  it('retries a failed archive read instead of keeping the rejection', async () => {
    const file = fixture('points.pmtiles');
    let extraReads = 0;
    const archive = new PMTiles(
      {
        getKey: () => 'retry-dir',
        getBytes: async (offset, length) => {
          if (offset > 0) {
            extraReads += 1;
            if (extraReads === 1) {
              throw new Error('transient range');
            }
          }
          return {data: await readBlobRange(file, offset, length)};
        },
      },
      new ResolvedValueCache()
    );
    await archive.getHeader();
    await expect(archive.getZxy(0, 0, 0)).rejects.toThrow('transient range');
    const tile = await archive.getZxy(0, 0, 0);
    expect(tile).toBeDefined();
    expect(tile!.data.byteLength).toBeGreaterThan(0);
  });

  it('lets in-flight reads finish and skips new ones while panning', () => {
    const gate = createContextualTileLoadGate();
    const {signal, done} = gate.branch();
    expect(signal.aborted).toBe(false);
    gate.startInteraction();
    expect(signal.aborted).toBe(false);
    expect(gate.interacting).toBe(true);
    const skipped = gate.branch();
    expect(skipped.signal.aborted).toBe(true);
    gate.endInteraction();
    expect(gate.interacting).toBe(false);
    done();
  });

  it('retries aborted tiles without dropping ones that already drew', () => {
    const loaded = {
      getState: () => TileState.LOADED,
      setState: vi.fn(),
    };
    const aborted = {
      getState: () => TileState.ERROR,
      setState: vi.fn(),
    };
    resetErrorTiles({
      forEach: fn => {
        fn(loaded as never);
        fn(aborted as never);
      },
    });
    expect(loaded.setState).not.toHaveBeenCalled();
    expect(aborted.setState).toHaveBeenCalledWith(TileState.IDLE);
  });
});
