/*
 * Copyright 2021 Macquarie University
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
 * Filename: MapWrapper.tsx
 * Description:
 *   Internals of map generation for MapFormField
 */
import React, {useState, useRef, useCallback} from 'react';

// openlayers
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import {Draw, Modify} from 'ol/interaction';
import OSM from 'ol/source/OSM';
import {transform} from 'ol/proj';
import proj4 from 'proj4';
import {register} from 'ol/proj/proj4';
import Button, {ButtonProps} from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import GeoJSON from 'ol/format/GeoJSON';

// define some EPSG codes - these are for two sample images
// TODO: we need to have a better way to include a useful set or allow
// them to be defined by a project
// e.g. https://www.npmjs.com/package/epsg-index
// or maybe https://github.com/matafokka/geotiff-geokeys-to-proj4 allows us
// to get things from the image?
proj4.defs('EPSG:32636', '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs');
proj4.defs(
  'EPSG:28354',
  '+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);
register(proj4);

interface MapProps extends ButtonProps {
  label: string;
  features: any;
  geoTiff?: string;
  projection?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  zoom: number;
  center: Array<number>;
  callbackFn: (features: object) => void;
}

import {AppBar, Dialog, IconButton, Toolbar, Typography} from '@mui/material';
import Feature from 'ol/Feature';
import {Geometry} from 'ol/geom';

const styles = {
  mapContainer: {
    height: '90%',
  },
  mapSubmitButton: {
    height: '10%',
  },
} as const;

function MapWrapper(props: MapProps) {
  // set initial state
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] =
    useState<VectorLayer<Feature<Geometry>>>();
  const defaultMapProjection = 'EPSG:3857';
  const geoJson = new GeoJSON();

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>();
  mapRef.current = map;

  const createMap = useCallback(
    async (element: HTMLElement, props: MapProps): Promise<Map> => {
      const center = transform(
        props.center,
        'EPSG:4326',
        props.projection || defaultMapProjection
      );
      let tileLayer: any;
      let view: View;

      if (props.geoTiff) {
        const geoTIFFSource = new GeoTIFF({
          sources: [
            {
              url: props.geoTiff,
            },
          ],
          convertToRGB: true,
        });
        tileLayer = new WebGLTileLayer({source: geoTIFFSource});
        const viewOptions = await geoTIFFSource.getView();
        // if the geoTiff doesn't have projection info we
        // need to set it from the props or it will default to EPSG:3857
        // can't see a way to test the geoTIFF image so we just set the
        // projection if it has been passed in via the props
        if (props.projection) {
          view = new View({...viewOptions, projection: props.projection});
        } else {
          view = new View(viewOptions);
        }
      } else {
        tileLayer = new TileLayer({source: new OSM()});
        view = new View({
          projection: props.projection || defaultMapProjection,
          center: center,
          zoom: props.zoom,
        });
      }

      const theMap = new Map({
        target: element,
        layers: [tileLayer],
        view: view,
        controls: [],
      });

      theMap.getView().setCenter(center);

      return theMap;
    },
    []
  );

  const addDrawInteraction = useCallback(
    (map: Map, props: MapProps) => {
      const source = new VectorSource();

      const layer = new VectorLayer({
        source: source,
        style: new Style({
          stroke: new Stroke({
            color: '#33ff33',
            width: 4,
          }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#33ff33'}),
          }),
        }),
      });
      const draw = new Draw({
        source: source,
        type: props.featureType || 'Point',
      });
      const modify = new Modify({
        source: source,
      });

      // add features to map if we're passed any in
      if (props.features && props.features.type) {
        const parsedFeatures = geoJson.readFeatures(props.features, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);

        // set the view so that we can see the features
        // but don't zoom too much
        const extent = source.getExtent();
        // don't fit if the extent is infinite because it crashes
        if (!extent.includes(Infinity)) {
          map
            .getView()
            .fit(extent, {padding: [20, 20, 20, 20], maxZoom: props.zoom});
        }
      }

      // setDrawInteraction(draw)

      map.addLayer(layer);
      map.addInteraction(draw);
      map.addInteraction(modify);
      setFeaturesLayer(layer);

      draw.on('drawstart', () => {
        // clear any existing features if we start drawing again
        // could allow up to a fixed number of features
        // here by counting
        source.clear();
      });
    },
    [setFeaturesLayer]
  );

  const handleClose = () => {
    if (featuresLayer) {
      const source = featuresLayer.getSource();
      if (source) {
        const features = source.getFeatures();

        if (map) {
          const geoJsonFeatures = geoJson.writeFeaturesObject(features, {
            featureProjection: map.getView().getProjection(),
            dataProjection: 'EPSG:4326',
            rightHanded: true,
          });

          props.callbackFn(geoJsonFeatures);

          source.clear();
        }
      }
      // TODO: should we delete the map element? Memory?
      setMap(undefined);
    }
    setMapOpen(false);
  };

  const handleClickOpen = () => {
    // only show the map if we have a center
    if (props.center[0] !== 0 && props.center[1] !== 0) {
      setMapOpen(true);
    } else {
      console.log('no center defined');
    }
    // TODO: should do something to inform the user here...
  };

  const refCallback = (element: HTMLElement | null) => {
    if (element) {
      if (!map) {
        // create map
        createMap(element, props).then((theMap: Map) => {
          addDrawInteraction(theMap, props);
          setMap(theMap);
        });
      } else {
        map.setTarget(element);
      }
    }
  };

  // render component
  return (
    <div>
      <Button variant="outlined" onClick={handleClickOpen}>
        {props.label}
      </Button>

      <Dialog fullScreen open={mapOpen} onClose={handleClose}>
        <AppBar sx={{position: 'relative'}}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ml: 2, flex: 1}} variant="h6" component="div">
              {props.label}
            </Typography>
            <Button autoFocus color="inherit" onClick={handleClose}>
              save
            </Button>
          </Toolbar>
        </AppBar>

        <div ref={refCallback} style={styles.mapContainer} />
      </Dialog>
    </div>
  );
}

export default MapWrapper;

// <div style={styles.mapInputWidget}>
// <div ref={mapElement} style={styles.mapContainer} />
// <Button
//   type='button'
//   variant='outlined'
//   color='primary'
//   style={styles.mapSubmitButton}
//   onClick={submitAction}
// >
//   Submit
// </Button>
// </div>
