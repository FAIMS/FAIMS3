// SPDX-License-Identifier: Apache-2.0

/**
 * Paint preferences for the vector and satellite base maps.
 * Stored in localStorage so every map on the device shares one stack.
 */

import {clampLayerOpacity, contextualLayerZIndex} from './layerStack';

/** Stable id for the streets base layer in prefs and the layers panel. */
export const BASE_MAP_VECTOR_ID = '__faims-basemap-vector';
/** Stable id for the satellite base layer in prefs and the layers panel. */
export const BASE_MAP_SATELLITE_ID = '__faims-basemap-satellite';

/** Panel label for the streets base layer. */
export const BASE_MAP_VECTOR_NAME = 'Streets';
/** Panel label for the satellite base layer. */
export const BASE_MAP_SATELLITE_NAME = 'Satellite';

const BASE_MAP_PREFS_KEY = 'map-base-layer-prefs';
/** Previous exclusive streets/satellite toggle. */
const LEGACY_LAYER_PREFERENCE_KEY = 'map-layer-preference';

/** Default stack value for streets (under satellite). */
export const DEFAULT_VECTOR_Z_INDEX = 0;
/** Default stack value for satellite (above streets). */
export const DEFAULT_SATELLITE_Z_INDEX = 1;

export type BaseMapLayerState = {
  visible: boolean;
  opacity: number;
  zIndex: number;
};

export type BaseMapLayersState = {
  vector: BaseMapLayerState;
  satellite: BaseMapLayerState;
};

export type BaseMapPanelLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  /** False while satellite tiles cannot be fetched (offline). */
  available?: boolean;
  unavailableHint?: string;
};

export type BaseMapLayerPatch = Partial<
  Pick<BaseMapPanelLayer, 'visible' | 'opacity' | 'zIndex'>
>;

/** Merge a partial stored state onto defaults with clamped opacity/zIndex. */
function layerState(
  value: Partial<BaseMapLayerState> | undefined,
  fallback: BaseMapLayerState
): BaseMapLayerState {
  return {
    visible:
      typeof value?.visible === 'boolean' ? value.visible : fallback.visible,
    opacity: clampLayerOpacity(value?.opacity ?? fallback.opacity),
    zIndex: contextualLayerZIndex(value?.zIndex ?? fallback.zIndex),
  };
}

/** Streets visible unless `preferSatellite` is set (legacy toggle). */
export function defaultBaseMapLayersState(
  preferSatellite = false
): BaseMapLayersState {
  return {
    vector: {
      visible: !preferSatellite,
      opacity: 1,
      zIndex: DEFAULT_VECTOR_Z_INDEX,
    },
    satellite: {
      visible: preferSatellite,
      opacity: 1,
      zIndex: DEFAULT_SATELLITE_Z_INDEX,
    },
  };
}

/** Clamp a stored prefs object to a complete streets/satellite state. */
export function normalizeBaseMapLayersState(
  value: unknown
): BaseMapLayersState {
  const defaults = defaultBaseMapLayersState();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const record = value as Partial<BaseMapLayersState>;
  return {
    vector: layerState(record.vector, defaults.vector),
    satellite: layerState(record.satellite, defaults.satellite),
  };
}

/** True when the old exclusive toggle preferred satellite. */
function readLegacySatellitePreference(): boolean {
  try {
    return localStorage.getItem(LEGACY_LAYER_PREFERENCE_KEY) === 'satellite';
  } catch {
    return false;
  }
}

/** Read device-wide base-map prefs, falling back to the legacy toggle. */
export function readBaseMapLayersState(): BaseMapLayersState {
  try {
    const stored = localStorage.getItem(BASE_MAP_PREFS_KEY);
    if (stored) {
      return normalizeBaseMapLayersState(JSON.parse(stored));
    }
  } catch {
    // Missing or malformed JSON falls through to the legacy toggle.
  }
  return defaultBaseMapLayersState(readLegacySatellitePreference());
}

/** Persist device-wide base-map prefs. */
export function writeBaseMapLayersState(state: BaseMapLayersState): void {
  try {
    localStorage.setItem(
      BASE_MAP_PREFS_KEY,
      JSON.stringify(normalizeBaseMapLayersState(state))
    );
  } catch {
    // Private browsing / quota. In-memory prefs still apply for this session.
  }
}

/** Apply a visibility, opacity, or stack patch to one base layer. */
export function applyBaseMapLayerPatch(
  state: BaseMapLayersState,
  id: string,
  patch: BaseMapLayerPatch
): BaseMapLayersState {
  const key = id === BASE_MAP_SATELLITE_ID ? 'satellite' : 'vector';
  if (id !== BASE_MAP_VECTOR_ID && id !== BASE_MAP_SATELLITE_ID) {
    return state;
  }
  return {
    ...state,
    [key]: layerState({...state[key], ...patch}, state[key]),
  };
}

/** Push stored prefs onto an OpenLayers base layer. */
export function applyBaseMapLayerPaint(
  layer: {
    setVisible: (visible: boolean) => void;
    setOpacity: (opacity: number) => void;
    setZIndex: (zIndex: number) => void;
  },
  prefs: BaseMapLayerState,
  visible: boolean
): void {
  layer.setVisible(visible);
  layer.setOpacity(clampLayerOpacity(prefs.opacity));
  layer.setZIndex(contextualLayerZIndex(prefs.zIndex));
}
