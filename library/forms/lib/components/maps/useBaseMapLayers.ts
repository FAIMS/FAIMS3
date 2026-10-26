// SPDX-License-Identifier: Apache-2.0
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  applyBaseMapLayerPaint,
  applyBaseMapLayerPatch,
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_SATELLITE_NAME,
  BASE_MAP_VECTOR_ID,
  BASE_MAP_VECTOR_NAME,
  defaultBaseMapLayersState,
  readBaseMapLayersState,
  writeBaseMapLayersState,
  type BaseMapLayerPatch,
  type BaseMapPanelLayer,
} from './baseMapLayers';

const SATELLITE_OFFLINE_HINT = 'Needs a network connection';

/**
 * Streets and satellite paint prefs, applied to the OpenLayers base layers.
 * Satellite stays listed while offline but cannot be shown.
 *
 * Field maps persist prefs (`persist` defaults true). Preview hosts can pass
 * `persist: false` so paint stays in memory for this map only.
 */
export function useBaseMapLayers(
  tileLayer: VectorTileLayer | TileLayer,
  satelliteLayer: TileLayer | undefined,
  isOnline: boolean,
  options?: {persist?: boolean}
) {
  const persist = options?.persist ?? true;
  const [prefs, setPrefs] = useState(() =>
    persist ? readBaseMapLayersState() : defaultBaseMapLayersState()
  );

  const updateBaseLayer = useCallback(
    (id: string, patch: BaseMapLayerPatch) => {
      setPrefs(current => {
        const next = applyBaseMapLayerPatch(current, id, patch);
        if (persist) {
          writeBaseMapLayersState(next);
        }
        return next;
      });
    },
    [persist]
  );

  const resetBaseLayers = useCallback(() => {
    const next = defaultBaseMapLayersState();
    if (persist) {
      writeBaseMapLayersState(next);
    }
    setPrefs(next);
  }, [persist]);

  const vectorVisible = prefs.vector.visible;
  const satelliteVisible = Boolean(
    satelliteLayer && prefs.satellite.visible && isOnline
  );

  useEffect(() => {
    applyBaseMapLayerPaint(tileLayer, prefs.vector, vectorVisible);
    if (satelliteLayer) {
      applyBaseMapLayerPaint(satelliteLayer, prefs.satellite, satelliteVisible);
    }
  }, [tileLayer, satelliteLayer, prefs, vectorVisible, satelliteVisible]);

  const baseLayers = useMemo((): BaseMapPanelLayer[] => {
    const layers: BaseMapPanelLayer[] = [
      {
        id: BASE_MAP_VECTOR_ID,
        name: BASE_MAP_VECTOR_NAME,
        visible: prefs.vector.visible,
        opacity: prefs.vector.opacity,
        zIndex: prefs.vector.zIndex,
      },
    ];
    if (!satelliteLayer) {
      return layers;
    }
    layers.push({
      id: BASE_MAP_SATELLITE_ID,
      name: BASE_MAP_SATELLITE_NAME,
      visible: satelliteVisible,
      opacity: prefs.satellite.opacity,
      zIndex: prefs.satellite.zIndex,
      available: isOnline,
      unavailableHint: isOnline ? undefined : SATELLITE_OFFLINE_HINT,
    });
    return layers;
  }, [prefs, satelliteLayer, isOnline, satelliteVisible]);

  return {
    baseLayers,
    updateBaseLayer,
    resetBaseLayers,
    vectorVisible,
    satelliteVisible,
  };
}
