// SPDX-License-Identifier: Apache-2.0
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useEffect} from 'react';
import {
  createTileLoadSettle,
  evictStaleTiles,
  retryRemainingErrors,
  shouldPauseTileLoads,
  tileLoadController,
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
    const settle = createTileLoadSettle(async cancelled => {
      const controllers = layers
        .map(layer => tileLoadController(layer))
        .filter((loads): loads is NonNullable<typeof loads> => loads !== undefined);
      await Promise.all(controllers.map(loads => loads.drain()));
      if (cancelled()) {
        return;
      }
      for (const layer of layers) {
        evictStaleTiles(layer, map);
      }
      if (cancelled()) {
        return;
      }
      for (const layer of layers) {
        const loads = tileLoadController(layer);
        if (!loads) {
          continue;
        }
        loads.gate.endInteraction();
        retryRemainingErrors(layer);
      }
      map.render();
    });
    const onMoveStart = () => {
      if (!shouldPauseTileLoads(map.getView())) {
        return;
      }
      settle.cancel();
      for (const layer of layers) {
        tileLoadController(layer)?.gate.startInteraction();
      }
    };
    const onMoveEnd = () => {
      if (layers.some(layer => tileLoadController(layer)?.gate.interacting)) {
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
  }, [map, streetsLayer, satelliteLayer]);
}
