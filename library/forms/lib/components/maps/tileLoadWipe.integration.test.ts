// SPDX-License-Identifier: Apache-2.0
/**
 * Real-OpenLayers regression test: a fit-to-extent that does not move the
 * view leaves the programmatic-move flag pending, and the next user pan
 * used to settle with a cache wipe whose renderer caches were never
 * actually cleared (OpenLayers adopts a fresh source's first revision
 * without clearing). The layer stayed blank until a later move created
 * tiles at new coords.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import OlMap from 'ol/Map';
import View from 'ol/View';
import ViewHint from 'ol/ViewHint';
import {transformExtent} from 'ol/proj';
import {describe, expect, it, vi} from 'vitest';
import {createVectorTileLayer} from './contextualTileLayers';
import type {ContextualMapLayer} from './contextualMapLayers';
import {readBlobRange} from './pmtilesRange';
import {
  bindTileLoadPause,
  startProgrammaticCameraMove,
  stopTileLoads,
} from './tileLoadControl';

type Layer = Awaited<ReturnType<typeof createVectorTileLayer>>;

function spec(): ContextualMapLayer {
  const bytes = readFileSync(
    join(process.cwd(), 'lib/components/maps/fixtures/points.pmtiles')
  );
  const file = new Blob([bytes]);
  return {
    id: 'boundary',
    name: 'Boundary',
    kind: 'vector-tiles',
    url: 'blob:boundary',
    readTileBytes: (offset, length) => readBlobRange(file, offset, length),
    visible: true,
    opacity: 1,
    zIndex: 1,
    stroke: '#1565c0',
    fill: '#1565c040',
    lineWidth: 2,
    pointSize: 6,
    extent4326: [151.2, -33.85, 151.22, -33.83],
  };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** True once a source tile is LOADED with features and none are pending. */
function drawn(layer: Layer): boolean {
  const source = layer.getSource() as unknown as {
    sourceTiles_: Record<
      string,
      {getState: () => number; getFeatures: () => unknown[] | null}
    >;
  };
  const tiles = Object.values(source.sourceTiles_ ?? {});
  return (
    tiles.some(t => t.getState() === 2 && (t.getFeatures()?.length ?? 0) > 0) &&
    !tiles.some(t => t.getState() === 0 || t.getState() === 1)
  );
}

async function waitDrawn(layer: Layer): Promise<boolean> {
  for (let i = 0; i < 80; i++) {
    await sleep(50);
    if (drawn(layer)) {
      return true;
    }
  }
  return false;
}

/** jsdom has no canvas implementation; tile lifecycles still run for real. */
function stubCanvas() {
  vi.stubGlobal('createImageBitmap', async () => ({
    width: 1,
    height: 1,
    close: () => undefined,
  }));
  vi.stubGlobal(
    'CanvasPattern',
    class {
      setTransform() {}
    }
  );
  vi.stubGlobal(
    'CanvasGradient',
    class {
      addColorStop() {}
    }
  );
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    const store: Record<string, unknown> = {canvas: this};
    return new Proxy(store, {
      get(t, k) {
        if (k in t) return t[k as string];
        return () => ({width: 0, data: new Uint8ClampedArray(4)});
      },
      set(t, k, v) {
        t[k as string] = v;
        return true;
      },
    }) as never;
  } as never;
}

describe('fit wipe with a real map', () => {
  it('reloads after a no-op fit followed by a user pan', async () => {
    stubCanvas();
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new View({center: [0, 0], zoom: 2});
    const map = new OlMap({target, view, layers: []});
    map.setSize([512, 512]);

    const extent = transformExtent(
      [151.2, -33.85, 151.22, -33.83],
      'EPSG:4326',
      'EPSG:3857'
    );
    // Start already at the fitted view (initial fit, no programmatic flag).
    view.fit(extent, {padding: [24, 24, 24, 24], maxZoom: 16});

    let current = await createVectorTileLayer(spec());
    bindTileLoadPause(map as never, () => [current as never], {
      includeLayer: () => true,
    });
    map.addLayer(current);
    expect(await waitDrawn(current)).toBe(true);

    // Toggle the layer off and back on, as in the layers panel. This
    // recreates the layer and its renderer.
    stopTileLoads(current);
    map.removeLayer(current);
    current.dispose();
    await sleep(20);
    current = await createVectorTileLayer(spec());
    map.addLayer(current);
    expect(await waitDrawn(current)).toBe(true);

    // Fit-to-extent that does not move anything (already fitted).
    map.getView().fit(extent, {
      padding: [24, 24, 24, 24],
      duration: startProgrammaticCameraMove(map as never) as never,
      maxZoom: 16,
    });
    await sleep(600);
    expect(drawn(current)).toBe(true);

    // A user pan (interacting hint + centre move, then release).
    const center = view.getCenter()!;
    const resolution = view.getResolution()!;
    const setHint = (
      view as unknown as {setHint: (hint: number, delta: number) => void}
    ).setHint.bind(view);
    setHint(ViewHint.INTERACTING, 1);
    view.setCenter([center[0] + resolution * 120, center[1] + resolution * 40]);
    await sleep(120);
    setHint(ViewHint.INTERACTING, -1);
    map.render();
    await sleep(1200);
    expect(drawn(current)).toBe(true);
  }, 30000);
});
