// SPDX-License-Identifier: Apache-2.0
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useEffect} from 'react';
import {
  bindTileLoadPause,
  stopAllTileLoads,
  stopTileLoads,
  syncTileLoadsToVisibility,
} from './tileLoadControl';

type BaseMapLayer = TileLayer | VectorTileLayer;

/** Pause streets and satellite fetches while the view is moving. */
export function useBaseMapTileLoads(
  map: OlMap | undefined,
  streetsLayer: VectorTileLayer | TileLayer,
  satelliteLayer: TileLayer | undefined
) {
  useEffect(() => {
    if (!map) {
      return;
    }
    const layers = [streetsLayer, satelliteLayer].filter(
      (layer): layer is BaseMapLayer => layer !== undefined
    );
    const unlistenVisible = layers.map(layer => {
      const onVisible = () => {
        syncTileLoadsToVisibility(layer);
      };
      syncTileLoadsToVisibility(layer);
      layer.on('change:visible', onVisible);
      return () => layer.un('change:visible', onVisible);
    });
    const unbindPause = bindTileLoadPause(map, () => layers);
    return () => {
      unbindPause();
      for (const unlisten of unlistenVisible) {
        unlisten();
      }
      for (const layer of layers) {
        stopTileLoads(layer);
      }
      stopAllTileLoads(map);
    };
  }, [map, streetsLayer, satelliteLayer]);
}
