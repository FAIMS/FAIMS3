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
import Button, {ButtonProps} from '@mui/material/Button';
import {Extent} from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import {Draw, Modify} from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {register} from 'ol/proj/proj4';
import VectorSource from 'ol/source/Vector';
import {Fill, Icon, Stroke, Style} from 'ol/style';
import proj4 from 'proj4';
import {useCallback, useEffect, useState} from 'react';
import {useNotification} from '../../../context/popup';
import {MapComponent} from '../../components/map/map-component';
import {theme} from '../../themes';

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

function MapWrapper(props: MapProps) {
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] = useState<VectorLayer>();
  const geoJson = new GeoJSON();
  const [showConfirmSave, setShowConfirmSave] = useState<boolean>(false);
  const [featuresExtent, setFeaturesExtent] = useState<Extent>();

  // notifications
  const notify = useNotification();

  // draw interaction with pin mark added and scaled
  const addDrawInteraction = useCallback(
    (theMap: Map, props: MapProps) => {
      const vectorSource = new VectorSource();
      // @TODO: RG - Stretch goal to show a popup on click of any point with lat-long info
      // icon downloaded from https://freepngimg.com/png/66934-map-google-pin-icons-maps-computer-maker
      const pinIcon = new Icon({
        src: '/static/map-pin.png',
        anchor: [0.5, 1],
        scale: 0.25,
      });

      const fill = new Fill({
        color: 'rgba(255,255,255,0.4)',
      });
      const stroke = new Stroke({
        color: '#3399CC',
        width: 2,
      });
      const pinStyle = new Style({
        image: pinIcon,
        fill,
        stroke,
      });

      const layer = new VectorLayer({
        source: vectorSource,
        style: pinStyle,
      });

      const draw = new Draw({
        source: vectorSource,
        type: props.featureType || 'Point',
      });
      const modify = new Modify({source: vectorSource});

      // Only allow one point at a time
      draw.on('drawstart', () => {
        vectorSource.clear();
      });

      if (props.features && props.features.type) {
        const parsedFeatures = geoJson.readFeatures(props.features, {
          dataProjection: 'EPSG:4326',
          featureProjection: theMap.getView().getProjection(),
        });
        vectorSource.addFeatures(parsedFeatures);

        const extent = vectorSource.getExtent();
        if (!extent.includes(Infinity)) setFeaturesExtent(extent);
      }

      theMap.addLayer(layer);
      theMap.addInteraction(draw);
      theMap.addInteraction(modify);
      setFeaturesLayer(layer);
    },
    [geoJson, setFeaturesExtent]
  );

  // save clear and close
  const handleClose = (action: MapAction | 'clear') => {
    if (!map) return;

    const source = featuresLayer?.getSource();

    if (action === 'clear') {
      source?.clear();
      return;
    }
    const features = source?.getFeatures() ?? [];

    if (featuresLayer) {
      featuresLayer?.getSource()?.clear(); // just clear features, don’t remove layer
    }

    // action save
    if (action === 'save') {
      if (!features.length) {
        setShowConfirmSave(true);
        return;
      }

      const geoJsonFeatures = geoJson.writeFeaturesObject(features, {
        featureProjection: map.getView().getProjection(), // EPSG:3857
        dataProjection: 'EPSG:4326', // convert back to EPSG:4326
      });

      props.setFeatures(geoJsonFeatures, 'save');
      setMapOpen(false);
    } else if (action === 'close') {
      setMapOpen(false);
    }
  };

  // open map
  const handleClickOpen = () => {
    if (props.fallbackCenter) {
      notify.showWarning(
        'Using default map location - no current GPS or center.'
      );
    }
    setMapOpen(true);
    setTimeout(() => {
      if (map) {
        map.getLayers().forEach(layer => {
          try {
            // Only remove pin layers, not the GPS live cursor
            const zIndex =
              typeof layer.getZIndex === 'function' ? layer.getZIndex() : -1;
            if (zIndex === 998) map.removeLayer(layer); // 999 is used by live cursor in mapcomponent.
          } catch (err) {
            console.warn('Error while checking/removing layer:', err);
          }
        });

        map.updateSize();
        map.getView().setZoom(props.zoom || 17);
      }
    }, 300);
  };
  // always re-apply draw interaction if maps open.
  useEffect(() => {
    if (mapOpen && map) addDrawInteraction(map, props);
  }, [mapOpen, map]);

  return (
    <>
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

        <Dialog
          sx={{
            top: 'var(--safe-area-inset-top)',
            left: 'var(--safe-area-inset-left)',
          }}
          fullScreen
          open={mapOpen}
          onClose={() => setMapOpen(false)}
        >
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

          <Grid container spacing={2} sx={{height: '100%'}}>
            <MapComponent
              key={mapOpen ? 'map-open' : 'map-closed'}
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
      <style>
        {`
    .ol-layer canvas {
      will-change: unset !important;
    }
  `}
      </style>
    </>
  );
}
// added forward rendering..
export default MapWrapper;

