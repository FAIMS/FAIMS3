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
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/LocationOn';
import Button, {ButtonProps} from '@mui/material/Button';
import Map from 'ol/Map';
import GeoJSON from 'ol/format/GeoJSON';
import {Draw, Modify} from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import {register} from 'ol/proj/proj4';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import proj4 from 'proj4';
import {useCallback, useEffect, useRef, useState} from 'react';
import {transform} from 'ol/proj';
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

export type MapAction = 'save' | 'close';

interface MapProps extends ButtonProps {
  label: string;
  features: any;
  geoTiff?: string;
  projection?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  zoom: number;
  center: [number, number];
  fallbackCenter: boolean;
  setFeatures: (features: object, action: MapAction) => void;
  setNoPermission: (flag: boolean) => void;
  isLocationSelected: boolean;
  openMap?: () => void;
}

import {
  Alert,
  AlertTitle,
  AppBar,
  Box,
  Dialog,
  DialogActions,
  Grid,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {useNotification} from '../../../context/popup';
import {MapComponent} from '../../components/map/map-component';
import {theme} from '../../themes';
import {Extent} from 'ol/extent';
import Feature from 'ol/Feature';
import {Geometry, Point} from 'ol/geom';
import {unByKey} from 'ol/Observable';
import {RegularShape} from 'ol/style';

function MapWrapper(props: MapProps) {
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] = useState<VectorLayer>();
  const geoJson = new GeoJSON();
  const [showConfirmSave, setShowConfirmSave] = useState<boolean>(false);
  const [featuresExtent, setFeaturesExtent] = useState<Extent>();

  // notifications
  const notify = useNotification();

  // trakcing user's real-time location, make precise after test inputs-  @todo ranisa
  const [positionFeature, setPositionFeature] = useState<Feature<Point> | null>(
    null
  );
  const [positionLayer, setPositionLayer] = useState<VectorLayer>();
  const watchIdRef = useRef<number | null>(null);
  const [accuracyFeature, setAccuracyFeature] = useState<Feature<Point> | null>(
    null
  );

  const addDrawInteraction = useCallback(
    (theMap: Map, props: MapProps) => {
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
          featureProjection: theMap.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);

        // set the view so that we can see the features
        // but don't zoom too much
        const extent = source.getExtent();
        // don't fit if the extent is infinite because it crashes
        if (!extent.includes(Infinity)) {
          setFeaturesExtent(extent);
        }
      }

      theMap.addLayer(layer);
      theMap.addInteraction(draw);
      theMap.addInteraction(modify);
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

  // auto-clean tracking
  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (map && positionLayer) {
      map.removeLayer(positionLayer);
      setPositionLayer(undefined);
    }
  };

  // add this to stoptracking after test works.
  // if (positionLayer) {
  //   const source = positionLayer.getSource();
  //   source?.clear(); // clear any leftover features
  //   map.removeLayer(positionLayer);
  //   setPositionLayer(undefined);
  // }

  // real-time blue dot + accuracy tracking
  const startLocationTracking = (theMap: Map) => {
    stopTracking(); // Clean up any previous tracking

    const view = theMap.getView();
    const projection = view.getProjection();

    // zooming to initial location on start
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = transform(
          [pos.coords.longitude, pos.coords.latitude],
          'EPSG:4326',
          projection
        );
        view.setCenter(coords);
        view.setZoom(17);
      },
      err => console.error('Initial location error', err),
      {enableHighAccuracy: true}
    );

    // set up new position layer
    const positionSource = new VectorSource();
    const positionLayer = new VectorLayer({
      source: positionSource,
      zIndex: 999, // keeping it above layers
    });
    theMap.addLayer(positionLayer);
    setPositionLayer(positionLayer);

    // blue directional arrow + accuracy circle
    const directionFeature = new Feature(new Point([0, 0]));
    const accuracyFeature = new Feature(new Point([0, 0]));

    // initial styles
    directionFeature.setStyle(
      new Style({
        image: new RegularShape({
          points: 3,
          radius: 10,
          rotation: 0, //  rotate based on heading
          angle: Math.PI / 3,
          fill: new Fill({color: '#1a73e8'}),
          stroke: new Stroke({color: '#fff', width: 2}),
        }),
      })
    );

    accuracyFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 30, // todo ranisa to try dyanmic radius
          fill: new Fill({color: 'rgba(100, 149, 237, 0.1)'}),
          stroke: new Stroke({color: 'rgba(100, 149, 237, 0.3)', width: 1}),
        }),
      })
    );

    positionSource.addFeatures([accuracyFeature, directionFeature]);

    // continuous location work in progress..
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const coords = transform(
          [pos.coords.longitude, pos.coords.latitude],
          'EPSG:4326',
          projection
        );

        const heading = pos.coords.heading ?? 0; // Use real heading, or fallback
        const accuracy = pos.coords.accuracy ?? 30;

        directionFeature.getGeometry()?.setCoordinates(coords);
        accuracyFeature.getGeometry()?.setCoordinates(coords);

        // Update accuracy circle
        accuracyFeature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: Math.max(20, accuracy / 2),
              fill: new Fill({color: 'rgba(100, 149, 237, 0.1)'}),
              stroke: new Stroke({color: 'rgba(100, 149, 237, 0.3)', width: 1}),
            }),
          })
        );

        //  direction arrow rotation
        directionFeature.setStyle(
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 10,
              rotation: heading,
              angle: Math.PI / 3,
              fill: new Fill({color: '#1a73e8'}),
              stroke: new Stroke({color: '#fff', width: 2}),
            }),
          })
        );
      },
      err => console.error('Live tracking error', err),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  useEffect(() => {
    if (mapOpen && map) {
      addDrawInteraction(map, props);
      startLocationTracking(map);
    }
    return stopTracking;
  }, [mapOpen, map]);

  useEffect(() => {
    if (map) {
      addDrawInteraction(map, props);
    }
  }, [map]);

  const handleClose = (action: 'save' | 'clear' | 'close') => {
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
          if (action === 'clear') {
            // if clearing - just remove locally don't callback so we don't save this change
            source.clear();
          } else if (action === 'save') {
            if (!features.length) {
              setShowConfirmSave(true); // show confirmation dialog if no location is selected while saving.
              return;
            }
            props.setFeatures(geoJsonFeatures, 'save');
            setMapOpen(false);
          } else if (action === 'close') {
            setMapOpen(false);
          }
        }
      }
    }
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

  return (
    <div>
      {!props.isLocationSelected ? (
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
            display: props.isLocationSelected ? 'none' : 'block',
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

            <Typography
              variant="h6"
              sx={{fontWeight: 'bold', fontSize: '18px'}}
            >
              {props.label}
            </Typography>
          </Box>
        </Button>
      ) : (
        <Box>
          <Tooltip title="Edit location">
            <Box
              id="edit-location-container"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                backgroundColor: '#dfdfdf',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  backgroundColor: '#e0e0e0',
                  transform: 'scale(1.1)',
                  boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.2)',
                },
              }}
              onClick={handleClickOpen}
            >
              <EditIcon
                sx={{
                  fontSize: 26,
                  color: theme.palette.primary.main,
                }}
              />
            </Box>
          </Tooltip>
        </Box>
      )}

      <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)}>
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
                onClick={() => setMapOpen(false)}
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
                Close
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
                  backgroundColor: theme.palette.highlightColor.main,
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
                  backgroundColor: theme.palette.alert.successBackground,
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

        {/* <div ref={refCallback} style={styles.mapContainer} /> */}
        <Grid container spacing={2} sx={{height: '100%'}}>
          <MapComponent
            parentSetMap={setMap}
            center={props.center}
            extent={featuresExtent}
            zoom={props.zoom}
          />
        </Grid>
      </Dialog>

      <Dialog open={showConfirmSave} onClose={() => setShowConfirmSave(false)}>
        <Alert severity="warning">
          <AlertTitle>No location selected</AlertTitle>
          Are you sure you want to save an empty location selection?
        </Alert>
        <DialogActions>
          <Button
            onClick={() => setShowConfirmSave(false)}
            sx={{
              backgroundColor: theme.palette.dialogButton.cancel,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
                transform: 'scale(1.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            sx={{
              backgroundColor: theme.palette.alert.successBackground,
              color: theme.palette.dialogButton.dialogText,
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
                transform: 'scale(1.05)',
              },
            }}
            onClick={() => {
              setShowConfirmSave(false);
              props.setFeatures({}, 'save');
              setMapOpen(false);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
// added forward rendering..
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
