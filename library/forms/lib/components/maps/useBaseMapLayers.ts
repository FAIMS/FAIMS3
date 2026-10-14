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
  readBaseMapLayersState,
  writeBaseMapLayersState,
  type BaseMapLayerPatch,
  type BaseMapPanelLayer,
} from './baseMapLayers';

const SATELLITE_OFFLINE_HINT = 'Needs a network connection';

/**
 * Streets and satellite paint prefs, applied to the OpenLayers base layers.
 * Satellite stays listed while offline but cannot be shown.
 */
export function useBaseMapLayers(
  tileLayer: VectorTileLayer | TileLayer,
  satelliteLayer: TileLayer | undefined,
  isOnline: boolean
) {
  const [prefs, setPrefs] = useState(readBaseMapLayersState);

  const updateBaseLayer = useCallback(
    (id: string, patch: BaseMapLayerPatch) => {
      setPrefs(current => {
        const next = applyBaseMapLayerPatch(current, id, patch);
        writeBaseMapLayersState(next);
        return next;
      });
    },
    []
  );

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

  return {baseLayers, updateBaseLayer, vectorVisible, satelliteVisible};
}
