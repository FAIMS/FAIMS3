/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: map-controls.tsx
 * Description:
 *   React map control buttons (zoom, compass, centre on GPS, layer toggle,
 *   use-current-location). These operate directly on the OpenLayers map/view
 *   and are laid out by MapControlsOverlay - no `ol/control` involved.
 */

import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import {Box} from '@mui/material';
import Map from 'ol/Map';
import {unByKey} from 'ol/Observable';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {useEffect, useState} from 'react';
import layersIconSrc from '../icons/layers.svg';
import pinIconSrc from '../icons/pin.svg';
import targetIconSrc from '../icons/target.svg';
import {MapControlButton, MapControlGroup, MapControlIcon} from './primitives';

/** Duration of zoom/rotation animations in ms */
const ANIMATION_DURATION = 250;

/** Rotation below this (radians) is treated as north-up; compass hidden. */
const ROTATION_NEAR_ZERO_THRESHOLD = 1e-6;

/** localStorage key for persisting the user's layer preference */
const LAYER_PREFERENCE_KEY = 'map-layer-preference';

/**
 * Zoom in/out buttons. Zoom limits are enforced by the view's own
 * constraints, so no clamping is needed here.
 */
export const ZoomControl = ({map}: {map: Map}) => {
  const zoomBy = (delta: number) => {
    const view = map.getView();
    const zoom = view.getZoom();
    if (zoom === undefined) return;
    view.animate({zoom: zoom + delta, duration: ANIMATION_DURATION});
  };

  return (
    <MapControlGroup>
      <MapControlButton title="Zoom in" onClick={() => zoomBy(1)}>
        <AddIcon />
      </MapControlButton>
      <MapControlButton title="Zoom out" onClick={() => zoomBy(-1)}>
        <RemoveIcon />
      </MapControlButton>
    </MapControlGroup>
  );
};

/**
 * Compass button that resets the map rotation to north. Hidden while the
 * map is already north-up (Google Maps style); the needle tracks the
 * current rotation.
 */
export const CompassControl = ({map}: {map: Map}) => {
  const [rotation, setRotation] = useState(() => map.getView().getRotation());

  useEffect(() => {
    const view = map.getView();
    setRotation(view.getRotation());
    const key = view.on('change:rotation', () =>
      setRotation(view.getRotation())
    );
    return () => unByKey(key);
  }, [map]);

  if (Math.abs(rotation) < ROTATION_NEAR_ZERO_THRESHOLD) return null;

  return (
    <MapControlGroup>
      <MapControlButton
        title="Reset map to north"
        onClick={() =>
          map.getView().animate({rotation: 0, duration: ANIMATION_DURATION})
        }
      >
        <Box
          component="svg"
          viewBox="0 0 24 24"
          sx={{
            width: 21,
            height: 21,
            display: 'block',
            transform: `rotate(${rotation}rad)`,
          }}
        >
          <path fill="currentColor" d="M12 4 L8 14 L16 14 Z" />
          <path
            fill="currentColor"
            fillOpacity={0.4}
            d="M12 20 L10 16 L14 16 Z"
          />
        </Box>
      </MapControlButton>
    </MapControlGroup>
  );
};

/** Button that re-centres the map on the user's live GPS position. */
export const CenterOnLocationControl = ({
  onCenter,
  locationAvailable,
}: {
  onCenter: () => void;
  locationAvailable: boolean;
}) => (
  <MapControlGroup>
    <MapControlButton
      title="Centre on current location"
      onClick={onCenter}
      disabled={!locationAvailable}
    >
      <MapControlIcon src={targetIconSrc} alt="Centre on current location" />
    </MapControlButton>
  </MapControlGroup>
);

/**
 * Button that sets the field selection to the user's current location
 * (map picker only). Disabled until a GPS fix is available.
 */
export const UseCurrentLocationControl = ({
  onSetPoint,
  locationAvailable,
}: {
  onSetPoint: () => void;
  locationAvailable: boolean;
}) => (
  <MapControlGroup>
    <MapControlButton
      title="Use current location"
      onClick={onSetPoint}
      disabled={!locationAvailable}
    >
      <MapControlIcon src={pinIconSrc} alt="Use current location" />
    </MapControlButton>
  </MapControlGroup>
);

export interface ZoomRange {
  minZoom: number;
  maxZoom: number;
}

const getSavedLayerPreference = (): boolean => {
  try {
    return localStorage.getItem(LAYER_PREFERENCE_KEY) === 'satellite';
  } catch {
    return false;
  }
};

const saveLayerPreference = (isSatellite: boolean): void => {
  try {
    localStorage.setItem(
      LAYER_PREFERENCE_KEY,
      isSatellite ? 'satellite' : 'vector'
    );
  } catch {
    // localStorage unavailable (e.g. private browsing), silently ignore
  }
};

export interface LayerToggleControlProps {
  map: Map;
  /** The vector/raster base layer */
  vectorLayer: VectorTileLayer | TileLayer;
  /** The satellite imagery layer */
  satelliteLayer: TileLayer;
  /** Whether the application is currently online (satellite needs network) */
  isOnline: boolean;
  /** Valid zoom range for the vector layer */
  vectorZoomRange: ZoomRange;
  /** Valid zoom range for the satellite layer */
  satelliteZoomRange: ZoomRange;
  /** Callback fired when the active layer changes */
  onLayerChange?: (isSatellite: boolean) => void;
}

/**
 * Toggles between the vector base map and satellite imagery.
 *
 * - Persists the user's preference to localStorage
 * - Automatically falls back to vector while offline (without overwriting
 *   the saved preference, so satellite is restored when back online)
 * - Animates the zoom into the valid range for the newly active layer
 */
export const LayerToggleControl = ({
  map,
  vectorLayer,
  satelliteLayer,
  isOnline,
  vectorZoomRange,
  satelliteZoomRange,
  onLayerChange,
}: LayerToggleControlProps) => {
  const [prefersSatellite, setPrefersSatellite] = useState(() =>
    getSavedLayerPreference()
  );
  // Offline forces vector view regardless of preference
  const isSatellite = prefersSatellite && isOnline;

  useEffect(() => {
    vectorLayer.setVisible(!isSatellite);
    satelliteLayer.setVisible(isSatellite);
    onLayerChange?.(isSatellite);

    // Snap the zoom into the active layer's supported range
    const range = isSatellite ? satelliteZoomRange : vectorZoomRange;
    const view = map.getView();
    const currentZoom = view.getZoom();
    if (currentZoom !== undefined) {
      const clampedZoom = Math.max(
        range.minZoom,
        Math.min(range.maxZoom, currentZoom)
      );
      if (clampedZoom !== currentZoom) {
        view.animate({zoom: clampedZoom, duration: ANIMATION_DURATION});
      }
    }
  }, [
    isSatellite,
    map,
    vectorLayer,
    satelliteLayer,
    onLayerChange,
    vectorZoomRange.minZoom,
    vectorZoomRange.maxZoom,
    satelliteZoomRange.minZoom,
    satelliteZoomRange.maxZoom,
  ]);

  return (
    <MapControlGroup>
      <MapControlButton
        title="Toggle satellite view"
        active={isSatellite}
        disabled={!isOnline}
        onClick={() => {
          const next = !prefersSatellite;
          setPrefersSatellite(next);
          saveLayerPreference(next);
        }}
      >
        <MapControlIcon src={layersIconSrc} alt="Toggle satellite view" />
      </MapControlButton>
    </MapControlGroup>
  );
};
