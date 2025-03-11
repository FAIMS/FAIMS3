import {Fill, Stroke, Style, Text} from 'ol/style';

export const mapStyle = (feature: any, resolution: number): Style | Style[] => {
  const featureType = feature.get('layer');
  const class_ = feature.get('class');
  const sourceLayer = feature.get('source-layer');

  const default_style = new Style({
    fill: new Fill({
      color: 'hsl(47, 26%, 88%)',
    }),
  });

  // Return different styles based on feature type
  switch (featureType) {
    case 'building': {
      // Convert zoom stops to resolution checks
      // Zoom 13-15 maps to opacity 0-1
      let opacity = 0;
      if (resolution <= 40) {
        // ~zoom 13
        opacity = Math.min(1, (40 - resolution) / 20); // Linear interpolation
      }

      return new Style({
        fill: new Fill({
          color: `rgba(222, 211, 190, ${opacity})`,
        }),
        stroke: new Stroke({
          color: `rgba(212, 177, 146, ${opacity / 2})`,
          width: 1,
        }),
      });
    }

    case 'road':
    case 'transportation':
      return new Style({
        stroke: new Stroke({
          color: 'hsl(0, 63%, 84%)',
          width: 1.4,
          lineCap: 'round',
          lineJoin: 'round',
        }),
      });

    case 'transportation_name':
      if (feature.get('name:latin') && resolution <= 100) {
        let font = '8px Noto Sans';
        if (resolution <= 150) {
          // ~zoom 8
          font = '14px Noto Sans';
        }
        return new Style({
          text: new Text({
            text: String(feature.get('name:latin')),
            font: font,
            fill: new Fill({
              color: '#000',
            }),
            stroke: new Stroke({
              color: 'hsl(0, 0%, 100%)',
              width: 2,
            }),
            placement: 'line',
            textAlign: 'center',
            textBaseline: 'middle',
            offsetY: 1,
          }),
        });
      } else {
        return default_style;
      }
      break;

    case 'landuse': {
      let colour = '#ccc';
      switch (class_) {
        case 'forest':
          colour = '#55AA55';
          break;
        case 'grass':
          colour = '#99CC99';
          break;
        case 'farmland':
          colour = 'hsl(138, 43%, 47%)';
          break;
        case 'orchard':
        case 'vineyard':
        case 'village_green':
          colour = 'hsl(138, 43%, 47%)';
          break;
        case 'recreation_ground':
          colour = '#7ca282';
          break;
        case 'cemetery':
          colour = 'hsl(35, 24%, 75%)';
          break;
        case 'university':
        case 'school':
          colour = 'hsla(229, 43%, 75%, 0.551)';
          break;
        case 'allotments':
          colour = 'hsl(132, 42%, 60%)';
          break;
        case 'railway':
          colour = 'hsla(54, 12%, 31%, 0.517)';
          break;
        case 'industrial':
          colour = '#EAE0D0';
          break;
        case 'residential':
        case 'suburb':
        case 'neighbourhood':
          colour = 'hsla(47, 13%, 86%, 0.7)';
          break;
        case 'agriculture':
          colour = '#eae0d0';
          break;
        case 'sand':
          colour = 'rgba(232, 214, 38, 1)';
          break;
      }
      if (colour === '#CCC') console.log('Unknown land use class:', class_);

      return new Style({
        fill: new Fill({
          color: colour,
        }),
      });

      break;
    }

    case 'park':
      return new Style({
        fill: new Fill({
          color: 'hsla(82, 46%, 90%, 0.80)',
        }),
      });

    case 'landcover':
      switch (class_) {
        case 'grass':
          return new Style({
            fill: new Fill({
              color: 'hsla(82, 46%, 72%, 0.80)',
            }),
          });
        case 'wood': {
          let opacity = 0.6;
          if (resolution <= 150) {
            // ~zoom 8
            opacity = 0.6 + (0.4 * (150 - resolution)) / 150;
          }

          return new Style({
            fill: new Fill({
              color: `hsla(82, 46%, 72%, ${opacity})`,
            }),
          });
        }
        default:
          console.log('Unknown landcover class:', class_);
          return new Style({
            fill: new Fill({
              color: 'hsla(142, 30%, 57%, 0.5)',
            }),
          });
      }
      break;

    case 'water':
      return new Style({
        fill: new Fill({
          color: 'hsl(205, 56%, 73%)',
        }),
      });

    case 'housenumber':
      // Only show housenumbers at high zoom levels (minzoom: 17 in mapbox style)
      if (resolution <= 2) {
        return new Style({
          text: new Text({
            text: String(feature.get('housenumber')),
            //          font: '10px Noto Sans Regular',
            fill: new Fill({
              color: 'rgba(212, 177, 146, 1)',
            }),
          }),
        });
      }
      break;

    case 'place': {
      if (class_ === 'city') {
        return new Style({
          text: new Text({
            text: String(feature.get('name:latin')),
            font: '20px Noto Sans',
            fill: new Fill({
              color: 'hsl(0, 0%, 30%)',
            }),
            stroke: new Stroke({
              color: 'hsla(0, 0%, 50%, 0.75)',
              width: 2,
            }),
          }),
        });
      }

      // Other places (towns, villages etc)
      return new Style({
        text: new Text({
          text: String(feature.get('name:latin')),
          font: '14px Noto Sans',
          fill: new Fill({
            color: 'hsl(0, 0%, 25%)',
          }),
          stroke: new Stroke({
            color: 'hsl(0, 0%, 100%)',
            width: 2,
          }),
        }),
      });
    }

    case 'waterway':
      return new Style({
        stroke: new Stroke({
          color: 'hsl(205, 56%, 73%)',
          width: Math.min(2, 1.4 * (150 / resolution)),
        }),
      });

    case 'poi':
      if (feature.get('rank') === 1) {
        return new Style({
          text: new Text({
            text: String(feature.get('name:latin')),
            font: '11px Noto Sans Regular',
            fill: new Fill({
              color: '#666',
            }),
            stroke: new Stroke({
              color: 'rgba(255,255,255,0.75)',
              width: 1,
            }),
            offsetY: 8,
            textAlign: 'center',
          }),
        });
      } else {
        return default_style;
      }
      break;
  }

  // log what we don't know about
  console.log('mapStyle', sourceLayer, featureType, class_);
  console.log('Feature properties:', feature.getProperties());

  // Default style if no matches
  return default_style;
};
