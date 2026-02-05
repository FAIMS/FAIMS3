import {Control} from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import Map from 'ol/Map';
import {CreateDomIcon} from '../dom-icon';
import src from '../icons/layers.svg';

/**
 * localStorage key for persisting the user's layer preference
 */
const STORAGE_KEY = 'map-layer-preference';

/**
 * Zoom range configuration for a map layer
 */
export interface ZoomRange {
  minZoom: number;
  maxZoom: number;
}

/**
 * Configuration options for the LayerToggle control
 */
export interface LayerToggleOptions {
  /** The vector/raster base layer */
  vectorLayer: VectorTileLayer | TileLayer;
  /** The satellite imagery layer */
  satelliteLayer: TileLayer;
  /** Whether the application is currently online */
  isOnline: boolean;
  /** Valid zoom range for the vector layer */
  vectorZoomRange: ZoomRange;
  /** Valid zoom range for the satellite layer */
  satelliteZoomRange: ZoomRange;
  /** Callback fired when the active layer changes */
  onLayerChange?: (isSatellite: boolean) => void;
}

/**
 * Retrieves the user's saved layer preference from localStorage.
 *
 * @returns true if the user prefers satellite view, false otherwise
 */
const getSavedPreference = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'satellite';
  } catch {
    return false;
  }
};

/**
 * Persists the user's layer preference to localStorage.
 *
 * @param isSatellite - Whether satellite view is active
 */
const savePreference = (isSatellite: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, isSatellite ? 'satellite' : 'vector');
  } catch {
    // localStorage unavailable (e.g., private browsing), silently ignore
  }
};

/**
 * Creates a map control that toggles between vector and satellite layers.
 *
 * Features:
 * - Persists user preference to localStorage
 * - Automatically switches to vector when offline
 * - Animates zoom to valid range when switching layers
 * - Restores satellite preference when back online
 *
 * @param options - Configuration options
 * @returns OpenLayers Control instance
 */
export const createLayerToggle = ({
  vectorLayer,
  satelliteLayer,
  isOnline,
  vectorZoomRange,
  satelliteZoomRange,
  onLayerChange,
}: LayerToggleOptions): Control => {
  // State
  let currentlyOnline = isOnline;
  let isSatellite = currentlyOnline && getSavedPreference();
  let map: Map | null = null;

  // Create button element
  const button = document.createElement('button');
  button.className = 'ol-custom-control-button ol-layer-toggle-button';
  button.setAttribute('type', 'button');
  button.title = 'Toggle satellite view';
  button.appendChild(
    CreateDomIcon({
      src,
      width: 24,
      height: 24,
      alt: 'Toggle satellite view',
    })
  );

  /**
   * Updates the button's visual state to reflect current conditions
   */
  const updateButtonState = (): void => {
    button.disabled = !currentlyOnline;
    button.classList.toggle('active', isSatellite);
  };

  /**
   * Animates the map zoom to fit within the specified range if necessary
   */
  const snapZoomToRange = (range: ZoomRange): void => {
    if (!map) return;

    const view = map.getView();
    const currentZoom = view.getZoom();
    if (currentZoom === undefined) return;

    const clampedZoom = Math.max(
      range.minZoom,
      Math.min(range.maxZoom, currentZoom)
    );

    if (clampedZoom !== currentZoom) {
      view.animate({
        zoom: clampedZoom,
        duration: 250,
      });
    }
  };

  /**
   * Applies the current layer state to the map
   */
  const applyLayerState = (): void => {
    vectorLayer.setVisible(!isSatellite);
    satelliteLayer.setVisible(isSatellite);

    snapZoomToRange(isSatellite ? satelliteZoomRange : vectorZoomRange);
    updateButtonState();
    onLayerChange?.(isSatellite);
  };

  /**
   * Handles toggle button clicks
   */
  const handleClick = (): void => {
    if (!currentlyOnline) {
      console.warn('Satellite view is only available when online');
      return;
    }

    isSatellite = !isSatellite;
    savePreference(isSatellite);
    applyLayerState();
  };

  /**
   * Handles online/offline status changes.
   * Automatically switches to vector when offline, preserving the user's
   * satellite preference for when connectivity is restored.
   */
  const handleOnlineStatusChange = (
    event: CustomEvent<{isOnline: boolean}>
  ): void => {
    currentlyOnline = event.detail.isOnline;

    if (!currentlyOnline && isSatellite) {
      isSatellite = false;
      applyLayerState();
      // Preference is intentionally not saved here to preserve the user's
      // satellite preference for when they're back online
    }

    updateButtonState();
  };

  // Set up event listeners
  button.addEventListener('click', handleClick);
  window.addEventListener(
    'map-online-status-change',
    handleOnlineStatusChange as EventListener
  );

  // Create container element
  const element = document.createElement('div');
  element.className = 'ol-custom-control ol-layer-toggle-box';
  element.appendChild(button);

  // Apply initial state
  updateButtonState();
  vectorLayer.setVisible(!isSatellite);
  satelliteLayer.setVisible(isSatellite);
  onLayerChange?.(isSatellite);

  // Create control
  const control = new Control({element});

  // Override setMap to capture map reference for zoom operations
  control.setMap = function (newMap: Map | null): void {
    map = newMap;
    Control.prototype.setMap.call(this, newMap);

    // Apply zoom constraints if starting in satellite mode
    if (isSatellite && map) {
      snapZoomToRange(satelliteZoomRange);
    }
  };

  return control;
};
