import {Control} from 'ol/control';
import {Coordinate} from 'ol/coordinate';
import Map from 'ol/Map';
import {CreateDomIcon} from '../../gui/components/map/dom-icon';
import src from '../../target.svg';
import {transform} from 'ol/proj';

export const addCenterControl = (map: Map, coords: Coordinate) => {
  const element = document.createElement('div');
  element.className = 'ol-center-box';

  const button = document.createElement('button');
  button.className = 'ol-center-button';

  button.appendChild(
    CreateDomIcon({
      src,
      width: 24,
      height: 24,
      alt: 'Center map',
    })
  );

  button.addEventListener('click', () => {
    map.getView().setCenter(transform(coords, 'EPSG:4326', 'EPSG:3857'));
  });

  element.appendChild(button);

  map.addControl(
    new Control({
      element: element,
    })
  );
};
