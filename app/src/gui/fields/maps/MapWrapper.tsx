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
import Zoom from 'ol/control/Zoom';
import MapIcon from '@mui/icons-material/LocationOn';

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
  fallbackCenter: boolean;
  callbackFn: (features: object, action?: 'save' | 'clear' | 'close') => void;
  setNoPermission: (flag: boolean) => void;
}

import {
  Alert,
  AlertTitle,
  AppBar,
  Box,
  Dialog,
  DialogActions,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import Feature from 'ol/Feature';
import {Geometry} from 'ol/geom';
import {createCenterControl} from '../../components/map/center-control';
import {useNotification} from '../../../context/popup';
import {theme} from '../../themes';

const styles = {
  mapContainer: {
    height: '90%',
  },
  mapSubmitButton: {
    height: '10%',
  },
} as const;

function MapWrapper(props: MapProps) {
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] =
    useState<VectorLayer<Feature<Geometry>>>();
  const defaultMapProjection = 'EPSG:3857';
  const geoJson = new GeoJSON();
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);
  const [showNewLocationPrompt, setShowNewLocationPrompt] =
    useState<boolean>(false);

  // notifications
  const notify = useNotification();

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
        controls: [new Zoom()],
      });

      theMap.addControl(createCenterControl(theMap.getView(), center));

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

  const handleClear = () => {
    setShowConfirmClear(true);
  };

  const confirmClearLocation = () => {
    if (featuresLayer) {
      const source = featuresLayer.getSource();
      if (source) {
        source.clear();
        props.callbackFn({}, 'clear');
        notify.showWarning('Location selection cleared.');
        setShowConfirmClear(false);
        setShowNewLocationPrompt(true);
      }
    }
  };

  const handleClose = (action: 'save' | 'clear' | 'close') => {
    if (action === 'clear') {
      setShowConfirmClear(true);
      return;
    }
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
          if (action === 'save') {
            props.callbackFn(geoJsonFeatures, 'save');
            notify.showSuccess('Location saved successfully!');
          } else {
            props.callbackFn({}, 'close');
          }
        }
      }
      setMap(undefined);
    }
    setMapOpen(false);
  };

  const handleClickOpen = () => {
    if (props.fallbackCenter) {
      notify.showWarning(
        'Using default map location - unable to determine current location and no center location configured.'
      );
    }
    // We always provide a center, so it's always safe to open the map
    setMapOpen(true);
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

  return (
    <div>
      <Button
        variant="contained"
        fullWidth
        onClick={handleClickOpen}
        sx={{
          width: {xs: '100%', sm: '50%', md: '40%'},
          maxWidth: '450px',
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.background.default,
          padding: '12px',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '12px',
          boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease-in-out',
          display: 'flex',
          alignItems: 'left',
          justifyContent: 'center',
          '&:hover': {
            backgroundColor: theme.palette.secondary.main,
            transform: 'scale(1.03)',
            boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
          <MapIcon
            sx={{
              fontSize: 26,
              color: theme.palette.background.default,
              transform: 'scale(1.5)',
            }}
          />

          <Typography variant="h6" sx={{fontWeight: 'bold', fontSize: '18px'}}>
            {props.label}
          </Typography>
        </Box>
      </Button>

      <Dialog fullScreen open={mapOpen} onClose={() => handleClose('close')}>
        <AppBar
          sx={{
            position: 'relative',
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Toolbar
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: theme.palette.background.default,
              width: '100%',
              paddingX: {xs: '8px', sm: '12px'},
            }}
          >
            <Box
              sx={{display: 'flex', alignItems: 'center', marginLeft: '10px'}}
            >
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => handleClose('close')}
                aria-label="close"
                sx={{
                  backgroundColor: theme.palette.primary.dark,
                  color: theme.palette.background.default,
                  fontSize: '16px',
                  gap: '4px',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  transition:
                    'background-color 0.3s ease-in-out, transform 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme.palette.text.primary,
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <CloseIcon
                  sx={{
                    stroke: theme.palette.background.default,
                    strokeWidth: '1.5',
                  }}
                />
                Cancel
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
              }}
            >
              <Button
                color="inherit"
                onClick={() => handleClose('clear')}
                sx={{
                  backgroundColor: theme.palette.dialogButton.confirm,
                  color: theme.palette.dialogButton.dialogText,
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  transition:
                    'background-color 0.3s ease-in-out, transform 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme.palette.text.primary,
                    transform: 'scale(1.05)',
                  },
                }}
              >
                Clear
              </Button>

              <Button
                color="inherit"
                onClick={() => handleClose('save')}
                sx={{
                  backgroundColor: theme.palette.icon.main,
                  color: theme.palette.dialogButton.dialogText,
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  transition:
                    'background-color 0.3s ease-in-out, transform 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme.palette.text.primary,
                    transform: 'scale(1.05)',
                  },
                }}
              >
                Save
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <div ref={refCallback} style={styles.mapContainer} />
      </Dialog>

      {/* Confirmation Dialog for Clearing Location */}
      <Dialog
        open={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
      >
        <Alert severity="warning">
          <AlertTitle>Are you sure?</AlertTitle>
          Do you want to clear the selected location?
        </Alert>
        <DialogActions>
          <Button onClick={() => setShowConfirmClear(false)}>Cancel</Button>
          <Button
            onClick={confirmClearLocation}
            sx={{
              backgroundColor: theme.palette.dialogButton.cancel,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
                transform: 'scale(1.05)',
              },
            }}
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>

      {/* Prompt to Select a New Location */}
      <Dialog
        open={showNewLocationPrompt}
        onClose={() => setShowNewLocationPrompt(false)}
      >
        <Alert severity="info">
          <AlertTitle>Location Cleared</AlertTitle>
          Please select a new location on the map.
        </Alert>
        <DialogActions>
          <Button
            onClick={() => setShowNewLocationPrompt(false)}
            sx={{
              backgroundColor: theme.palette.dialogButton.cancel,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
                transform: 'scale(1.05)',
              },
            }}
          >
            OK
          </Button>
        </DialogActions>
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
