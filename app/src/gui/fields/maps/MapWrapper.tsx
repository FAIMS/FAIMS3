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
import {Circle as CircleStyle, Fill, Icon, Stroke, Style} from 'ol/style';
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

  // ddd draw interaction with pin mark - can be imporved if needed
  const addDrawInteraction = useCallback(
    (theMap: Map, props: MapProps) => {
      const source = new VectorSource();

      const layer = new VectorLayer({
        source: source,
        style: new Style({
          image: new Icon({
            src: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png',
            anchor: [0.5, 1],
            scale: 1,
          }),
        }),
      });

      const draw = new Draw({source, type: props.featureType || 'Point'});
      const modify = new Modify({source});

      if (props.features && props.features.type) {
        const parsedFeatures = geoJson.readFeatures(props.features, {
          dataProjection: 'EPSG:4326',
          featureProjection: theMap.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);

        const extent = source.getExtent();
        if (!extent.includes(Infinity)) setFeaturesExtent(extent);
      }

      draw.on('drawstart', () => {
        source.clear(); // 1 pin
      });

      theMap.addLayer(layer);
      theMap.addInteraction(draw);
      theMap.addInteraction(modify);
      setFeaturesLayer(layer); // layr clenaup
    },
    [geoJson, setFeaturesExtent]
  );

  //  Stop tracking live GPS
  const stopTracking = () => {
    if (watchIdRef.current) {
      clearInterval(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (map && positionLayer) {
      positionLayer.getSource()?.clear();
      map.removeLayer(positionLayer);
      setPositionLayer(undefined);
    }
  };

  /// Live location + direction + accuracy style
  const startLocationTracking = (theMap: Map) => {
    stopTracking(); // Clear previous tracking

    const view = theMap.getView();
    const projection = view.getProjection();

    const positionSource = new VectorSource();
    const layer = new VectorLayer({
      source: positionSource,
      zIndex: 999,
    });
    theMap.addLayer(layer);
    setPositionLayer(layer);

    const dotFeature = new Feature(new Point([0, 0]));
    const triangleFeature = new Feature(new Point([0, 0]));
    const accuracyFeature = new Feature(new Point([0, 0]));
    positionSource.addFeatures([dotFeature, triangleFeature, accuracyFeature]);
    const updateStyles = (
      coords: number[],
      heading: number,
      accuracy: number
    ) => {
      const view = theMap.getView();

      // geometry
      dotFeature.setGeometry(new Point(coords));
      triangleFeature.setGeometry(new Point(coords));
      accuracyFeature.setGeometry(new Point(coords));

      // blue ocation circle)
      dotFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 14,
            fill: new Fill({color: '#1a73e8'}),
            stroke: new Stroke({color: '#A19F9FFF', width: 3}),
          }),
          zIndex: 1000,
        })
      );

      // directional triangle
      triangleFeature.setStyle(
        new Style({
          image: new RegularShape({
            points: 3,
            radius: 12, // distance from center to each point
            rotation: heading + Math.PI, // flip to base the (dot)
            angle: Math.PI, // vertex up
            fill: new Fill({color: '#1a73e8'}),
            stroke: new Stroke({color: 'white', width: 2}),
          }),
          geometry: () => {
            const px = theMap.getPixelFromCoordinate(coords);
            const offset = 22;
            const dx = offset * Math.sin(heading);
            const dy = -offset * Math.cos(heading);
            const offsetPx = [px[0] + dx, px[1] + dy];
            return new Point(theMap.getCoordinateFromPixel(offsetPx));
          },
          zIndex: 1001,
        })
      );

      // aaccuracy circle
      accuracyFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: Math.max(25, accuracy / 2),
            fill: new Fill({color: 'rgba(100, 149, 237, 0.1)'}),
            stroke: new Stroke({color: 'rgba(100, 149, 237, 0.3)', width: 1}),
          }),
        })
      );
    };

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
      err => {
        console.error('Initial GPS error', err);
        props.setNoPermission(true);
      },
      {enableHighAccuracy: true}
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const coords = transform(
          [pos.coords.longitude, pos.coords.latitude],
          'EPSG:4326',
          projection
        );
        const heading = pos.coords.heading ?? 0;
        const accuracy = pos.coords.accuracy ?? 30;
        updateStyles(coords, heading, accuracy);
      },
      err => {
        console.error('Live GPS error', err);
        props.setNoPermission(true);
      },
      {enableHighAccuracy: true, maximumAge: 0, timeout: 10000}
    );
  };

  //  ini.  load & cleanup
  useEffect(() => {
    if (mapOpen && map) {
      addDrawInteraction(map, props);
      startLocationTracking(map);
    }
    return stopTracking;
  }, [mapOpen, map]);

  useEffect(() => {
    if (map) addDrawInteraction(map, props);
  }, [map]);

  // save cleanr and close
  const handleClose = (action: MapAction | 'clear') => {
    if (!map) return;

    if (featuresLayer) {
      map.removeLayer(featuresLayer); // Remove previous layer
      setFeaturesLayer(undefined);
    }

    const source = featuresLayer?.getSource();
    const features = source?.getFeatures() ?? [];

    if (action === 'clear') {
      console.log('Inside clear');
      props.setFeatures({}, 'save'); // Clear pin from state
      addDrawInteraction(map, props); // re-ad draw layer
      return;
    }
    // action save
    if (action === 'save') {
      if (!features.length) {
        setShowConfirmSave(true);
        return;
      }

      const geoJsonFeatures = geoJson.writeFeaturesObject(features, {
        featureProjection: map.getView().getProjection(),
        dataProjection: 'EPSG:4326',
      });

      props.setFeatures(geoJsonFeatures, 'save');
      setMapOpen(false);
    } else if (action === 'close') {
      setMapOpen(false);
    }
  };

  // ppen map
  const handleClickOpen = () => {
    if (props.fallbackCenter) {
      notify.showWarning(
        'Using default map location - no current GPS or center.'
      );
    }
    setMapOpen(true);
    setTimeout(() => {
      if (map) {
        startLocationTracking(map);
      }
    }, 300); // adding delaye intentionally so map tracking instantiastes
  };

  return (
    <>
      <div className="mapInputWidget">TEST CSS WORKING</div>
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

        <Dialog
          open={showConfirmSave}
          onClose={() => setShowConfirmSave(false)}
        >
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
    </>
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
