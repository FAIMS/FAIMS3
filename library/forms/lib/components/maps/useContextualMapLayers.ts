// SPDX-License-Identifier: Apache-2.0
import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useContext, useEffect, useRef} from 'react';
import {
  CONTEXTUAL_TILE_LOAD_GATE,
  createRasterTileLayer,
  createVectorTileLayer,
  type ContextualTileLoadGate,
} from './contextualTileLayers';
import {contextualVectorStyle} from './contextualVectorStyle';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from './contextualMapLayers';
import {contextualLayerZIndex} from './layerStack';

type ManagedLayer = BaseLayer;

/** Show the overlay and apply opacity / clamped stack order. */
function applyCommon(layer: ManagedLayer, spec: ContextualMapLayer) {
  layer.setVisible(true);
  layer.setOpacity(spec.opacity);
  // Stored order can grow without a ceiling. Keep reference data under pins.
  layer.setZIndex(contextualLayerZIndex(spec.zIndex));
}

/** Apply vector stroke/fill/label style when the layer is a VectorTileLayer. */
function paintVector(layer: ManagedLayer, spec: ContextualMapLayer) {
  if (layer instanceof VectorTileLayer) {
    layer.setStyle(contextualVectorStyle(spec));
  }
}

/** Remove and dispose a managed overlay. */
function dropLayer(map: OlMap, layer: ManagedLayer) {
  map.removeLayer(layer);
  layer.dispose();
}

/** Abort tile reads for one overlay while the map is moving. */
function tileLoadGate(layer: ManagedLayer): ContextualTileLoadGate | undefined {
  return layer.get(CONTEXTUAL_TILE_LOAD_GATE) as
    | ContextualTileLoadGate
    | undefined;
}

/** Reload the viewport after a pan so aborted tiles can fill in. */
function refreshLayerSource(layer: ManagedLayer) {
  if (layer instanceof TileLayer || layer instanceof VectorTileLayer) {
    layer.getSource()?.refresh();
  }
}

/** One contextual overlay. Tile archives are read by range, not as one file. */
export async function createContextualMapLayer(
  spec: ContextualMapLayer
): Promise<ManagedLayer> {
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
 */
export function useContextualMapLayers(map: OlMap | undefined) {
  const {layers} = useContext(ContextualMapLayersContext);
  const managed = useRef(new globalThis.Map<string, ManagedLayer>());

  useEffect(() => {
    if (!map) {
      return;
    }
    let cancelled = false;
    const nextIds = new Set(layers.map(layer => layer.id));
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
          managed.current.set(spec.id, layer);
          map.addLayer(layer);
        })
        .catch(error => {
          console.error(error);
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
    const onMoveStart = () => {
      for (const layer of managed.current.values()) {
        tileLoadGate(layer)?.startInteraction();
      }
    };
    const onMoveEnd = () => {
      for (const layer of managed.current.values()) {
        const gate = tileLoadGate(layer);
        if (!gate?.interacting) {
          continue;
        }
        gate.endInteraction();
        refreshLayerSource(layer);
      }
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
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
}
