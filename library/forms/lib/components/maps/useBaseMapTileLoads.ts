// SPDX-License-Identifier: Apache-2.0
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import OlMap from 'ol/Map';
import {useEffect} from 'react';
import {
  applySettledTileLoads,
  createTileLoadSettle,
  isZoomChange,
  shouldPauseTileLoads,
  stopAllTileLoads,
  stopTileLoads,
  syncTileLoadsToVisibility,
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
    const unlistenVisible = layers.map(layer => {
      const onVisible = () => {
        syncTileLoadsToVisibility(layer);
      };
      syncTileLoadsToVisibility(layer);
      layer.on('change:visible', onVisible);
      return () => layer.un('change:visible', onVisible);
    });
    let startResolution: number | undefined;
    const settle = createTileLoadSettle(async cancelled => {
      await applySettledTileLoads({
        layers,
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
      for (const layer of layers) {
        if (layer.getVisible()) {
          tileLoadController(layer)?.gate.startInteraction();
        }
      }
    };
    const onMoveEnd = () => {
      if (
        layers.some(
          layer =>
            layer.getVisible() && tileLoadController(layer)?.gate.interacting
        )
      ) {
        settle.arm();
      }
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
      settle.cancel();
      map.un('movestart', onMoveStart);
      map.un('moveend', onMoveEnd);
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
