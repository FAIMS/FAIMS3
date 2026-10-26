// SPDX-License-Identifier: Apache-2.0
import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  createRasterTileLayer,
  createVectorTileLayer,
} from './contextualTileLayers';
import {
  applySettledTileLoads,
  createTileLoadSettle,
  isZoomChange,
  shouldPauseTileLoads,
  stopTileLoads,
  tileLoadController,
} from './tileLoadControl';
import {contextualVectorStyle} from './contextualVectorStyle';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from './contextualMapLayers';
import {contextualLayerZIndex} from './layerStack';

type ManagedLayer = TileLayer | VectorTileLayer;

/** Show the overlay and apply opacity / clamped stack order. */
function applyCommon(layer: ManagedLayer, spec: ContextualMapLayer) {
  layer.setVisible(true);
  layer.setOpacity(spec.opacity);
  // Stored order can grow without a ceiling. Keep reference data under pins.
  layer.setZIndex(contextualLayerZIndex(spec.zIndex));
}

/** Apply vector stroke/fill style when the layer is a VectorTileLayer. */
function paintVector(layer: ManagedLayer, spec: ContextualMapLayer) {
  if (layer instanceof VectorTileLayer) {
    layer.setStyle(contextualVectorStyle(spec));
  }
}

/** Message shown when a PMTiles overlay cannot be created. */
export function contextualLayerCreateErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not draw this layer.';
}

/** Drop keys that are no longer in the notebook overlay list. */
function pruneLayerErrors(
  current: Record<string, string>,
  nextIds: Set<string>
): Record<string, string> {
  let changed = false;
  const next = {...current};
  for (const id of Object.keys(next)) {
    if (!nextIds.has(id)) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : current;
}

/** Set or clear one overlay create error without extra renders. */
function writeLayerError(
  current: Record<string, string>,
  id: string,
  message: string | undefined
): Record<string, string> {
  if (message === undefined) {
    if (!(id in current)) {
      return current;
    }
    const next = {...current};
    delete next[id];
    return next;
  }
  if (current[id] === message) {
    return current;
  }
  return {...current, [id]: message};
}

/** Remove and dispose a managed overlay. */
function dropLayer(map: OlMap, layer: ManagedLayer) {
  stopTileLoads(layer);
  map.removeLayer(layer);
  layer.dispose();
}

/** One contextual overlay. Tile archives are read by range, not as one file. */
export async function createContextualMapLayer(
  spec: ContextualMapLayer
): Promise<BaseLayer> {
  if (spec.kind === 'raster-tiles') {
    const layer = await createRasterTileLayer(spec);
    layer.set('sourceUrl', spec.url);
    applyCommon(layer, spec);
    return layer;
  }
  const layer = await createVectorTileLayer(spec);
  layer.set('sourceUrl', spec.url);
  applyCommon(layer, spec);
  return layer;
}

/**
 * Adds, updates, and removes contextual OpenLayers layers for the current
 * notebook. A hidden overlay leaves the map so its tile cache can drop.
 * Create failures are returned so the layers sheet can show them.
 */
export function useContextualMapLayers(map: OlMap | undefined): {
  layerErrors: Record<string, string>;
} {
  const {layers} = useContext(ContextualMapLayersContext);
  const managed = useRef(new globalThis.Map<string, ManagedLayer>());
  const [layerErrors, setLayerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!map) {
      return;
    }
    let cancelled = false;
    const nextIds = new Set(layers.map(layer => layer.id));
    setLayerErrors(current => pruneLayerErrors(current, nextIds));
    for (const [id, layer] of managed.current) {
      if (!nextIds.has(id)) {
        dropLayer(map, layer);
        managed.current.delete(id);
      }
    }

    for (const spec of layers) {
      const existing = managed.current.get(spec.id);
      if (!spec.visible) {
        if (existing) {
          dropLayer(map, existing);
          managed.current.delete(spec.id);
        }
        setLayerErrors(current => writeLayerError(current, spec.id, undefined));
        continue;
      }
      if (existing && existing.get('sourceUrl') === spec.url) {
        applyCommon(existing, spec);
        paintVector(existing, spec);
        continue;
      }
      if (existing) {
        dropLayer(map, existing);
        managed.current.delete(spec.id);
      }
      setLayerErrors(current => writeLayerError(current, spec.id, undefined));
      void createContextualMapLayer(spec)
        .then(layer => {
          if (cancelled) {
            layer.dispose();
            return;
          }
          const previous = managed.current.get(spec.id);
          if (previous) {
            dropLayer(map, previous);
          }
          managed.current.set(spec.id, layer as ManagedLayer);
          map.addLayer(layer);
          setLayerErrors(current =>
            writeLayerError(current, spec.id, undefined)
          );
        })
        .catch(error => {
          console.error(error);
          if (cancelled) {
            return;
          }
          setLayerErrors(current =>
            writeLayerError(
              current,
              spec.id,
              contextualLayerCreateErrorMessage(error)
            )
          );
        });
    }

    return () => {
      cancelled = true;
    };
  }, [map, layers]);

  useEffect(() => {
    if (!map) {
      return;
    }
    let startResolution: number | undefined;
    const settle = createTileLoadSettle(async cancelled => {
      await applySettledTileLoads({
        layers: [...managed.current.values()],
        map,
        cancelled,
        zoomChanged: isZoomChange(
          startResolution,
          map.getView().getResolution()
        ),
      });
    });
    const onMoveStart = () => {
      if (!shouldPauseTileLoads(map.getView())) {
        return;
      }
      startResolution = map.getView().getResolution();
      settle.cancel();
      for (const layer of managed.current.values()) {
        tileLoadController(layer)?.gate.startInteraction();
      }
    };
    const onMoveEnd = () => {
      let shouldSettle = false;
      for (const layer of managed.current.values()) {
        if (tileLoadController(layer)?.gate.interacting) {
          shouldSettle = true;
          break;
        }
      }
      if (shouldSettle) {
        settle.arm();
      }
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
      settle.cancel();
      map.un('movestart', onMoveStart);
      map.un('moveend', onMoveEnd);
    };
  }, [map]);

  useEffect(() => {
    return () => {
      if (!map) {
        return;
      }
      for (const layer of managed.current.values()) {
        dropLayer(map, layer);
      }
      managed.current.clear();
    };
  }, [map]);

  return {layerErrors};
}
