import {Control} from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import Map from 'ol/Map';
import {CreateDomIcon} from './dom-icon';
import src from './layers.svg';

export interface LayerToggleOptions {
  vectorLayer: VectorTileLayer | TileLayer;
  satelliteLayer: TileLayer;
  isOnline: boolean;
  vectorZoomRange: {minZoom: number; maxZoom: number};
  satelliteZoomRange: {minZoom: number; maxZoom: number};
  onLayerChange?: (isSatellite: boolean) => void;
}

/**
 * Creates a custom control button that toggles between vector and satellite layers.
 * Satellite is only available when online.
 * Snaps zoom level to valid range when switching layers.
 */
export const createLayerToggle = ({
  vectorLayer,
  satelliteLayer,
  isOnline,
  vectorZoomRange,
  satelliteZoomRange,
  onLayerChange,
}: LayerToggleOptions): Control => {
  let currentlyOnline = isOnline;
  let isSatellite = false;
  let map: Map | null = null;

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

  const updateButtonState = () => {
    button.disabled = !currentlyOnline;
    button.classList.toggle('active', isSatellite);
  };

  /**
   * Clamp zoom level to the given range and apply if needed
   */
  const snapZoomToRange = (range: {minZoom: number; maxZoom: number}) => {
    if (!map) return;

    const view = map.getView();
    const currentZoom = view.getZoom();
    if (currentZoom === undefined) return;

    let newZoom = currentZoom;
    if (currentZoom < range.minZoom) {
      newZoom = range.minZoom;
    } else if (currentZoom > range.maxZoom) {
      newZoom = range.maxZoom;
    }

    if (newZoom !== currentZoom) {
      view.animate({
        zoom: newZoom,
        duration: 250,
      });
    }
  };

  const updateLayers = () => {
    vectorLayer.setVisible(!isSatellite);
    satelliteLayer.setVisible(isSatellite);

    // Snap zoom to valid range for the new layer
    const range = isSatellite ? satelliteZoomRange : vectorZoomRange;
    snapZoomToRange(range);

    updateButtonState();
    onLayerChange?.(isSatellite);
  };

  const handleClick = () => {
    if (!currentlyOnline) {
      console.warn('Satellite view only available when online');
      return;
    }
    isSatellite = !isSatellite;
    updateLayers();
  };

  const handleOnlineChange = (event: CustomEvent<{isOnline: boolean}>) => {
    currentlyOnline = event.detail.isOnline;

    if (!currentlyOnline && isSatellite) {
      isSatellite = false;
      updateLayers();
    }

    updateButtonState();
  };

  button.addEventListener('click', handleClick);
  window.addEventListener(
    'map-online-status-change',
    handleOnlineChange as EventListener
  );

  const element = document.createElement('div');
  element.className = 'ol-custom-control ol-layer-toggle-box';
  element.appendChild(button);

  updateButtonState();

  const control = new Control({
    element: element,
  });

  // Capture map reference when control is added
  control.setMap = function (newMap) {
    map = newMap;
    Control.prototype.setMap.call(this, newMap);
  };

  return control;
};
