import {Control} from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {CreateDomIcon} from './dom-icon';
import src from './layers.svg';

export interface LayerToggleOptions {
  vectorLayer: VectorTileLayer | TileLayer;
  satelliteLayer: TileLayer;
  isOnline: boolean;
  onLayerChange?: (isSatellite: boolean) => void;
}

/**
 * Creates a custom control button that toggles between vector and satellite layers.
 * Satellite is only available when online.
 *
 * @param {LayerToggleOptions} options - Configuration options
 * @returns {Control} - The custom control instance
 */
export const createLayerToggle = ({
  vectorLayer,
  satelliteLayer,
  isOnline,
  onLayerChange,
}: LayerToggleOptions): Control => {
  let currentlyOnline = isOnline;
  let isSatellite = false;

  const button = document.createElement('button');
  button.className = 'ol-custom-control-button ol-layer-toggle-button';

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

  const updateLayers = () => {
    vectorLayer.setVisible(!isSatellite);
    satelliteLayer.setVisible(isSatellite);
    updateButtonState();
    onLayerChange?.(isSatellite);
  };

  const handleClick = () => {
    console.log('Clicked');
    if (!currentlyOnline) {
      console.warn('Satellite view only available when online');
      return;
    }
    isSatellite = !isSatellite;
    updateLayers();
  };

  const handleOnlineChange = (event: CustomEvent<{isOnline: boolean}>) => {
    currentlyOnline = event.detail.isOnline;

    // Force back to vector if we go offline while viewing satellite
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

  // Set initial state
  updateButtonState();

  return new Control({
    element: element,
  });
};
