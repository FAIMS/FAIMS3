import {View} from 'ol';
import {Control} from 'ol/control';
import src from '../icons/target.svg';
import {CreateDomIcon} from '../dom-icon';

/**
 * Creates a custom control button that centers the map view to a specified coordinate.
 *
 * @param {View} view - The map view instance to be controlled.
 * @param {() => void} center - Callback to center the map view.
 * @returns {Control} - The custom control instance.
 */
export const createCenterControl = (
  view: View,
  centerMap: () => void
): Control => {
  const button = document.createElement('button');
  button.className = 'ol-custom-control-button';

  button.appendChild(
    CreateDomIcon({
      src,
      width: 24,
      height: 24,
      alt: 'Center map',
    })
  );

  const handleClick = () => {
    centerMap();
  };

  button.addEventListener('click', handleClick);

  const element = document.createElement('div');
  element.className = 'ol-custom-control ol-center-box';
  element.appendChild(button);

  return new Control({
    element: element,
  });
};
