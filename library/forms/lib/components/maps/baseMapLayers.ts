// SPDX-License-Identifier: Apache-2.0

/**
 * Paint preferences for the vector and satellite base maps.
 * Stored in localStorage so every map on the device shares one stack.
 */

import {contextualLayerZIndex} from './layerStack';

export const BASE_MAP_VECTOR_ID = '__faims-basemap-vector';
export const BASE_MAP_SATELLITE_ID = '__faims-basemap-satellite';

export const BASE_MAP_VECTOR_NAME = 'Streets';
export const BASE_MAP_SATELLITE_NAME = 'Satellite';

const BASE_MAP_PREFS_KEY = 'map-base-layer-prefs';
/** Previous exclusive streets/satellite toggle. */
const LEGACY_LAYER_PREFERENCE_KEY = 'map-layer-preference';

export const DEFAULT_VECTOR_Z_INDEX = 0;
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

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function clampZIndex(value: number): number {
  return contextualLayerZIndex(value);
}

function layerState(
  value: Partial<BaseMapLayerState> | undefined,
  fallback: BaseMapLayerState
): BaseMapLayerState {
  return {
    visible:
      typeof value?.visible === 'boolean' ? value.visible : fallback.visible,
    opacity: clampOpacity(value?.opacity ?? fallback.opacity),
    zIndex: clampZIndex(value?.zIndex ?? fallback.zIndex),
  };
}

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

function readLegacySatellitePreference(): boolean {
  try {
    return localStorage.getItem(LEGACY_LAYER_PREFERENCE_KEY) === 'satellite';
  } catch {
    return false;
  }
}

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
  layer.setOpacity(clampOpacity(prefs.opacity));
  layer.setZIndex(clampZIndex(prefs.zIndex));
}
