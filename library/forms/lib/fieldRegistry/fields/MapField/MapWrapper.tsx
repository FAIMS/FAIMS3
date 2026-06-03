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
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Button, {ButtonProps} from '@mui/material/Button';
import {Feature} from 'ol';
import {Extent} from 'ol/extent';
import GeoJSON, {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {Draw, Modify} from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import {register} from 'ol/proj/proj4';
import VectorSource from 'ol/source/Vector';
import {Fill, Icon, Stroke, Style} from 'ol/style';
import proj4 from 'proj4';
import {useCallback, useEffect, useRef, useState} from 'react';
import {MapComponent} from '../../../components/maps/MapComponent';
import {MapConfig} from '../../../components/maps/types';
import {logError, logWarn} from '../../../logging';

export type MapAction = 'save' | 'close';

interface MapProps extends ButtonProps {
  config: MapConfig;
  label: string;
  features: GeoJSONFeatureCollection | undefined;
  geoTiff?: string;
  projection?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  zoom: number;
  center?: [number, number];
  setFeatures: (features: object | undefined, action: MapAction) => void;
  setNoPermission: (flag: boolean) => void;
  isLocationSelected: boolean;
  openMap?: () => void;
  disabled?: boolean;
  allowSetToCurrentPoint?: boolean;
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

/** Builds the point layer which renders points as pins */
const generatePointLayer = () => {
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

  return new VectorLayer({
    source: vectorSource,
    style: pinStyle,
  });
};

function MapWrapper(props: MapProps) {
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] = useState<VectorLayer | undefined>(
    undefined
  );

  // Some callbacks need to track this and closures can get funky without stable
  // reference
  const featuresLayerRef = useRef<
    VectorLayer<VectorSource<Feature>> | undefined
  >(undefined);
  const mapRef = useRef<Map | undefined>(undefined);

  const drawRef = useRef<Draw | null>(null);

  const geoJson = new GeoJSON();
  const [showConfirmSave, setShowConfirmSave] = useState<boolean>(false);
  /** Confirm dialog for closing with unsaved drawn features (BSS-1144). */
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [featuresExtent, setFeaturesExtent] = useState<Extent>();

  // Has the user drawn features?
  const [hasDrawnFeatures, setHasDrawnFeatures] = useState<boolean>(false);

  // Is the user partway through drawing a polygon / line (sketch started but
  // not yet finished)? Used so Clear can abort an in-progress sketch.
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Does the map have features already?
  const hasExistingFeatures = !!(
    props.features?.features && props.features.features.length > 0
  );

  const theme = useTheme();

  // draw interaction with pin mark added and scaled
  const addDrawInteraction = useCallback(
    (theMap: Map, props: MapProps) => {
      // Build the new point layer (doesn't have any features yet)
      const layer = generatePointLayer();
      const source = layer.getSource();

      // This should not happen
      if (!source) {
        logError(new Error('No source found for features layer'));
        return;
      }

      // Add the draw interaction
      const draw = new Draw({
        source: source,
        type: props.featureType || 'Point',
      });
      // Expose the Draw to handleClose so Clear can abort an in-progress sketch.
      drawRef.current = draw;

      const modify = new Modify({source: source});

      // Only allow one point at a time
      draw.on('drawstart', () => {
        source.clear();
        setIsDrawing(true);
      });

      draw.on('drawend', () => {
        setHasDrawnFeatures(true);
        setIsDrawing(false);
      });

      // Sketch was aborted (e.g. via Clear) - no longer drawing.
      draw.on('drawabort', () => {
        setIsDrawing(false);
      });

      // import any exiting features
      if (props.features && props.features.type) {
        const parsedFeatures = geoJson.readFeatures(props.features, {
          dataProjection: 'EPSG:4326',
          featureProjection: theMap.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);

        // pass the extent in the EPSG:4326 projection
        const extent = transformExtent(
          source.getExtent(),
          theMap.getView().getProjection(),
          'EPSG:4326'
        );

        if (!extent.includes(Infinity)) setFeaturesExtent(extent);
      }

      // Add layer to the map
      theMap.addLayer(layer);
      theMap.addInteraction(draw);
      theMap.addInteraction(modify);
      setFeaturesLayer(layer);
      featuresLayerRef.current = layer;
    },
    [geoJson, setFeaturesExtent]
  );

  // save clear and close
  const handleClose = (action: MapAction | 'clear') => {
    if (!map) return;

    const source = featuresLayer?.getSource();

    if (action === 'clear') {
      setHasDrawnFeatures(false);
      setIsDrawing(false);

      drawRef.current?.abortDrawing();
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
    if (props.disabled) return;

    // Reset this
    setHasDrawnFeatures(false);
    setIsDrawing(false);

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
            logWarn('Error while checking/removing layer:', err);
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
    // NOTE: Adding addDrawInteraction causes infinite loop
  }, [mapOpen, map]);

  return (
    <>
      <div>
        {!props.isLocationSelected ? (
          <Button
            variant="contained"
            disabled={props.disabled}
            onClick={handleClickOpen}
            startIcon={
              <MapIcon
                sx={{
                  fontSize: '20px !important',
                  color: theme.palette.background.default,
                }}
              />
            }
            sx={{
              marginTop: '12px',
              width: {xs: '100%', md: '350px'},
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.background.default,
              padding: '10px 20px',
              minHeight: '44px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease-in-out',
              display: props.isLocationSelected ? 'none' : 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textTransform: 'none',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              '&:hover': {
                backgroundColor: theme.palette.secondary.main,
                boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
              },
            }}
          >
            {props.label}
          </Button>
        ) : (
          <Box>
            {!props.disabled && (
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
            )}
          </Box>
        )}

        <Dialog
          sx={{
            top: 'env(safe-area-inset-top)',
            left: 'env(safe-area-inset-left)',
          }}
          fullScreen
          open={mapOpen}
          onClose={() => setMapOpen(false)}
        >
          <AppBar
            sx={{
              position: 'relative',
              height: '50px',
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
              {/* Cancel — destructive. If the user has unsaved drawn
                  features, prompt before discarding. */}
              <Box
                sx={{display: 'flex', alignItems: 'center', marginLeft: '10px'}}
              >
                <Button
                  onClick={() => {
                    if (hasDrawnFeatures) {
                      setShowCloseConfirm(true);
                    } else {
                      setMapOpen(false);
                    }
                  }}
                  aria-label="cancel"
                  color="error"
                  variant="contained"
                  disableElevation
                  startIcon={<CloseIcon sx={{fontSize: 16}} />}
                  sx={{
                    '& .MuiButton-startIcon': {
                      marginLeft: 0,
                      marginRight: '4px',
                    },
                  }}
                >
                  Cancel
                </Button>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                }}
              >
                {/* Clear — secondary action, outlined so it stays
                    visually quieter than Save. */}
                <Button
                  onClick={() => handleClose('clear')}
                  color="primary"
                  variant="outlined"
                  // Disabled if there's nothing to clear. Stays enabled while a
                  // polygon/line sketch is in progress so Clear can abort it.
                  disabled={
                    !hasExistingFeatures && !hasDrawnFeatures && !isDrawing
                  }
                >
                  Clear
                </Button>

                {/* Save — primary action, green via bssTheme success token. */}
                <Button
                  onClick={() => handleClose('save')}
                  color="success"
                  variant="contained"
                  disableElevation
                  // Gray out when no features and hasn't drawn any
                  disabled={!hasExistingFeatures && !hasDrawnFeatures}
                >
                  Save
                </Button>
              </Box>
            </Toolbar>
          </AppBar>

          <Grid container spacing={2} sx={{height: '100%'}}>
            {/* Info Banner */}
            <Box
              sx={{
                position: 'absolute',
                top:
                  props.featureType === 'Point' && props.allowSetToCurrentPoint
                    ? '70px' // align properly
                    : '68px',
                left: 8,
                // Account for the "Use Current Location" button if present
                right:
                  props.featureType === 'Point' && props.allowSetToCurrentPoint
                    ? 70 // Leave space for the control button
                    : 8,
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(4px)',
                borderRadius: '8px',
                padding: '10px 14px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                pointerEvents: 'none', // Allow clicks to pass through to map
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {props.featureType === 'Point'
                  ? 'Click on the map to select a point.'
                  : props.featureType === 'LineString'
                    ? 'Click on the map for each segment of your line. Click twice on the final segment to complete your line.'
                    : 'Click on the map for each corner of your shape, finishing where you started.'}
              </Typography>
            </Box>

            <MapComponent
              config={props.config}
              key={mapOpen ? 'map-open' : 'map-closed'}
              parentSetMap={m => {
                setMap(m);
                mapRef.current = m;
              }}
              center={props.center}
              extent={featuresExtent}
              zoom={props.zoom}
              additionalControls={{
                // Add use current location control for points
                setSelectionAsCurrentLocation:
                  props.featureType === 'Point' && props.allowSetToCurrentPoint
                    ? point => {
                        const source = featuresLayerRef.current?.getSource();
                        if (source) {
                          source.clear();
                          const feature = new Feature({
                            geometry: point,
                          });
                          source.addFeature(feature);
                          setHasDrawnFeatures(true);
                        }
                        // Center map on the point
                        if (mapRef.current && point) {
                          mapRef.current
                            .getView()
                            .setCenter(point.getCoordinates());
                        }
                      }
                    : undefined,
              }}
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
                // backgroundColor: theme.palette.dialogButton.cancel,
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
                // backgroundColor: theme.palette.alert.successBackground,
                // color: theme.palette.dialogButton.dialogText,
                '&:hover': {
                  backgroundColor: theme.palette.text.primary,
                  transform: 'scale(1.05)',
                },
              }}
              onClick={() => {
                setShowConfirmSave(false);
                props.setFeatures(undefined, 'save');
                setMapOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {(() => {
          // Use the right noun for the shape the user is drawing
          // ("location" for points, "polygon" for polygons, "line" for lines).
          const shapeNoun =
            props.featureType === 'Polygon'
              ? 'polygon'
              : props.featureType === 'LineString'
                ? 'line'
                : 'location';
          return (
            <Dialog
              open={showCloseConfirm}
              onClose={() => setShowCloseConfirm(false)}
              aria-labelledby="map-close-confirm-title"
              aria-describedby="map-close-confirm-description"
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle
                id="map-close-confirm-title"
                sx={{textAlign: 'center', fontSize: '1.35rem', fontWeight: 600}}
              >
                Are you sure you want to discard the {shapeNoun}?
              </DialogTitle>
              <DialogContent>
                <Stack spacing={2} id="map-close-confirm-description">
                  <Typography variant="body2">
                    You have selected a {shapeNoun} on the map but haven't saved
                    it. If you close now, your selection will be lost.
                  </Typography>
                </Stack>
              </DialogContent>
              <DialogActions
                sx={{justifyContent: 'space-between', px: 3, pb: 2}}
              >
                <Button
                  onClick={() => {
                    setShowCloseConfirm(false);
                    setMapOpen(false);
                  }}
                  color="error"
                  variant="contained"
                  disableElevation
                >
                  Discard
                </Button>
                <Button
                  onClick={() => setShowCloseConfirm(false)}
                  color="primary"
                  variant="contained"
                  disableElevation
                >
                  Keep editing
                </Button>
              </DialogActions>
            </Dialog>
          );
        })()}
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
