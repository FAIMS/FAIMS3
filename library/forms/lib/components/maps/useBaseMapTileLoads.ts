// SPDX-License-Identifier: Apache-2.0
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useEffect} from 'react';
import {tileLoadController} from './tileLoadControl';

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
    const onMoveStart = () => {
      for (const layer of layers) {
        tileLoadController(layer)?.gate.startInteraction();
      }
    };
    const onMoveEnd = () => {
      for (const layer of layers) {
        const loads = tileLoadController(layer);
        if (!loads?.gate.interacting) {
          continue;
        }
        loads.gate.endInteraction();
        loads.retry(layer);
      }
      map.render();
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
      map.un('movestart', onMoveStart);
      map.un('moveend', onMoveEnd);
    };
  }, [map, streetsLayer, satelliteLayer]);
}
