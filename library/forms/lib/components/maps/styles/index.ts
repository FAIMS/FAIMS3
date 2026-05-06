// https://github.com/openmaptiles/maptiler-basic-gl-style
import basicStyle from './basic-style.json';
import openstreetmapStyle from './openstreetmap-style.json';
// https://github.com/openmaptiles/osm-bright-gl-style
import osmBrightStyle from './osm-bright.json';

import tonerStyle from './toner-style.json';

// These style files comes from Maputnik (https://maplibre.org/maputnik) which allows
// you to load standard styles and edit them, then export the style json file.
// Styles are described here: https://openmaptiles.org/styles/ but the only way I can
// see to download them is via Maputnik.
export type MapStylesheetNameType =
  | 'basic'
  | 'openstreetmap'
  | 'osm-bright'
  | 'toner';

export const getMapStylesheet = (style: MapStylesheetNameType) => {
  switch (style) {
    case 'basic':
      return basicStyle;
    case 'openstreetmap':
      return openstreetmapStyle;
    case 'osm-bright':
      return osmBrightStyle;
    case 'toner':
      return tonerStyle;
    default:
      return basicStyle;
  }
};
