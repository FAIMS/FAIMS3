import {Control} from 'ol/control';
import {Coordinate} from 'ol/coordinate';
import {View} from 'ol';
import {CenterControlIcon} from './center-control-icon';

/**
 * Creates a custom control button that centers the map view to a specified coordinate.
 *
 * @param {View} view - The map view instance to be controlled.
 * @param {Coordinate} center - The coordinate to which the map view should be centered.
 * @returns {Control} - The custom control instance.
 */
export const createCenterControl = (
  view: View,
  center: Coordinate
): Control => {
  const button = document.createElement('button');
  button.className = 'ol-center-button';

  button.appendChild(CenterControlIcon());

  const handleClick = () => {
    view.setCenter(center);
  };

  button.addEventListener('click', handleClick);

  const element = document.createElement('div');
  element.className = 'ol-center-box';
  element.appendChild(button);

  return new Control({
    element: element,
  });
};
