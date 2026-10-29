// SPDX-License-Identifier: Apache-2.0

/*
/**
 * MapComponent.tsx
 * This component renders an interactive OpenLayers map with support for:
 * - Real-time GPS tracking (blue dot, accuracy circle, direction triangle)
 * - Offline map support using cached tiles
 * - Dynamic center control and zooming
 * - Integration with parent component through callback
 */

import {Geolocation, Position} from '@capacitor/geolocation';
import {Box} from '@mui/material';
import {View} from 'ol';
import {Extent} from 'ol/extent';
import Feature from 'ol/Feature';
import {Point} from 'ol/geom';
import {
  DoubleClickZoom,
  DragPan,
  KeyboardPan,
  KeyboardZoom,
  MouseWheelZoom,
  PinchRotate,
  PinchZoom,
} from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform, transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, RegularShape, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {getCoordinates, useCurrentLocation} from '../../hooks/useLocation';
import {logWarn} from '../../logging';
import {headingIndicatorCoordinate} from './headingIndicator';
import {loadLastLocation, saveLastLocation} from './lastKnownLocation';
import {mapAttributionSx} from './mapAttributionSx';
import {topVisibleAttribution} from './mapHelpers';
import {useIsOnline} from './useIsOnline';
import {
  CenterOnLocationControl,
  CompassControl,
  FullscreenControl,
  UseCurrentLocationControl,
  ZoomControl,
} from './controls/map-controls';
import {MapControlsOverlay, MapControlStack} from './controls/primitives';
import {useMapFullscreen} from './useMapFullscreen';
import {MapControlThemeProvider} from './mapTheme';
import {MapConfig} from './types';
import {
  applyBaseMapLayerPaint,
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  readBaseMapLayersState,
} from './baseMapLayers';
import {ContextualLayersControl} from './ContextualLayersControl';
import {GPS_CURSOR_LAYER_Z_INDEX} from './layerStack';
import type {RecordFormLayer, RecordFormLayerPatch} from './recordFormLayers';
import {useBaseMapLayers} from './useBaseMapLayers';
import {useBaseMapTileLoads} from './useBaseMapTileLoads';
import {useContextualMapLayers} from './useContextualMapLayers';
import {PrioritizedTileMap, stopAllTileLoads} from './tileLoadControl';
import {createTileStore} from './tileDB/TileStore';

export const defaultMapProjection = 'EPSG:3857';
const MAX_ZOOM = 20;
const MIN_ZOOM = 12;

const MAP_VIEW_ANIMATION_DURATION_MS = 800;
const MAP_VIEW_FIT_PADDING_PX = [24, 24, 24, 24];
// fallback to Sydney
const FALLBACK_MAP_CENTER: [number, number] = [151.2093, -33.8688];

/**
 * A Map component for all our mapping needs.
 * Props:
 *   parentSetMap - callback from the parent component, called with the map element once it has been created.
 *   center: optional, the map center. If not supplied we try to get the current location or back off to Sydney.
 */
export interface MapComponentProps {
  config: MapConfig;
  parentSetMap: (map: Map) => void;
  center?: [number, number]; // in EPSG:4326
  extent?: Extent; // note that the extent should be in EPSG:4326, not in the map projection
  zoom?: number;

  // Additional controls to embed into the map - with associated callbacks
  additionalControls?: {
    // Adds a button which, when current location is available, chooses this
    // location
    setSelectionAsCurrentLocation?: (point: Point) => void;
  };

  // Optional content rendered over the top of the map (e.g. an instruction
  // banner). Laid out by the controls overlay so it never collides with the
  // control buttons.
  topOverlay?: ReactNode;

  /** When false, hides zoom, compass, layers, and location controls. */
  showControls?: boolean;

  /**
   * When true, shows a top-right control that expands this map into a
   * lightbox-style full-screen view. Opt-in so hosts that are already
   * full-screen (the map field dialog) do not nest another overlay.
   */
  enableFullscreen?: boolean;

  /** Whether to auto-fly to the first valid current location. Defaults to true. */
  autoFlyToCurrentLocation?: boolean;

  /** When true, disables user map navigation such as pan, zoom, and rotation. */
  lockNavigation?: boolean;

  /**
   * Per-form record geometry on the overview map. Listed in the Layers panel
   * with the same visibility and vector paint controls as downloaded overlays.
   */
  recordLayers?: RecordFormLayer[];
  onUpdateRecordLayer?: (id: string, patch: RecordFormLayerPatch) => void;
  /** Restore per-form record layers to default visibility, stack, and paint. */
  onResetRecordLayers?: () => void;
}

/**
 * Wraps {@link MapComponentImpl} with {@link MapControlThemeProvider} so map
 * controls render correctly outside the mobile app's MUI theme.
 */
export const MapComponent = (props: MapComponentProps) => (
  <MapControlThemeProvider>
    <MapComponentImpl {...props} />
  </MapControlThemeProvider>
);

/** OpenLayers map with optional controls, GPS overlay, and layers panel. */
const MapComponentImpl = (props: MapComponentProps) => {
  // Defaults
  const showControls = props.showControls ?? true;
  const enableFullscreen = props.enableFullscreen ?? false;
  const autoFlyToCurrentLocation = props.autoFlyToCurrentLocation ?? true;
  const {isFullscreen, toggleFullscreen} = useMapFullscreen(enableFullscreen);

  const [map, setMap] = useState<Map | undefined>(undefined);
  const olMapRef = useRef<Map | undefined>(undefined);
  const mapMountedRef = useRef(true);
  const {layerErrors} = useContextualMapLayers(map);
  const [zoomLevel, setZoomLevel] = useState(props.zoom || MIN_ZOOM); // Default zoom level
  const [attribution, setAttribution] = useState<string | null>(null);
  const isOnline = useIsOnline();
  // Whether we have a live GPS fix (drives control button enablement)
  const [locationAvailable, setLocationAvailable] = useState<boolean>(false);
  const tileStore = useMemo(() => createTileStore(props.config), []);
  // Same layer instances are added to the map and driven by the layers panel
  const tileLayer = useMemo(() => {
    const layer = tileStore.getTileLayer();
    const prefs = readBaseMapLayersState();
    applyBaseMapLayerPaint(layer, prefs.vector, prefs.vector.visible);
    return layer;
  }, [tileStore]);
  const satelliteLayer = useMemo(() => {
    if (!tileStore.hasSatellite()) {
      return undefined;
    }
    const layer = tileStore.getSatelliteLayer();
    if (!layer) {
      return undefined;
    }
    const prefs = readBaseMapLayersState();
    applyBaseMapLayerPaint(
      layer,
      prefs.satellite,
      prefs.satellite.visible && navigator.onLine
    );
    return layer;
  }, [tileStore]);
  const {
    baseLayers,
    updateBaseLayer,
    resetBaseLayers,
    vectorVisible,
    satelliteVisible,
  } = useBaseMapLayers(tileLayer, satelliteLayer, isOnline);
  useBaseMapTileLoads(map, tileLayer, satelliteLayer);

  useEffect(() => {
    const vectorAttribution = tileStore.getAttribution() as unknown as string;
    setAttribution(
      topVisibleAttribution(
        [
          {
            visible: satelliteVisible,
            zIndex:
              baseLayers.find(layer => layer.id === BASE_MAP_SATELLITE_ID)
                ?.zIndex ?? 0,
            attribution: tileStore.getSatelliteAttribution(),
          },
          {
            visible: vectorVisible,
            zIndex:
              baseLayers.find(layer => layer.id === BASE_MAP_VECTOR_ID)
                ?.zIndex ?? 0,
            attribution: vectorAttribution,
          },
        ],
        vectorAttribution
      )
    );
  }, [tileStore, baseLayers, vectorVisible, satelliteVisible]);

  // Use the custom hook for location which we only need if we don't have a center or extent
  // passed in props
  const {data: currentPosition} = useCurrentLocation();

  const positionLayerRef = useRef<VectorLayer>();
  const watchIdRef = useRef<string | null>(null);
  const liveLocationRef = useRef<Position | null>(null);

  const hasInitialisedViewRef = useRef(false);
  const hasHandledFirstCurrentLocationRef = useRef(false);

  /**
   * Initializes the map instance with base tile layers and zoom controls.
   * Adds the live cursor layer and sets up GPS tracking.
   *
   * @param element The HTML element to attach the map to
   * @returns The initialized OpenLayers Map instance
   */
  const createMap = useCallback(async (element: HTMLElement): Promise<Map> => {
    setAttribution(tileStore.getAttribution() as unknown as string);
    const layers = [tileLayer];

    // if we're offline, limit the zoom level to 12 so that we don't go
    // off map.
    // TODO: Could also limit the extent to that covered by the offline
    // map.

    // Add satellite layer if configured
    if (satelliteLayer) {
      layers.push(satelliteLayer);
    }

    const view = new View({
      projection: defaultMapProjection,
      zoom: zoomLevel,
      minZoom: 0,
      maxZoom: MAX_ZOOM,
    });

    const theMap = new PrioritizedTileMap({
      target: element,
      layers,
      view: view,
      // All map controls are React components rendered in the overlay -
      // no OpenLayers controls
      controls: [],
    });

    // create the live cursor layer
    const liveCursor = createLiveCursorFeatures(theMap);

    // Handle zoom events, keep track of the zoom level and
    // redraw the live cursor accuracy circle
    theMap.getView().on('change:resolution', () => {
      const z = theMap.getView().getZoom();
      if (z) {
        setZoomLevel(z);
        // need to trigger redrawing of the live cursor because the zoom level has changed
        // so any accuracy circle needs to be redrawn
        liveCursor.updateCursorAccuracy(
          liveLocationRef.current?.coords.accuracy ?? 30
        );
      }
    });

    // ~1 Hz live cursor. Capacitor reads these options differently per platform:
    // - Android (plugin >= 7.1): `timeout` is the fused-location interval, and
    //   `minimumUpdateInterval` is a hard floor. The plugin default floor is
    //   5000 ms, which is what made the marker lag. On a watch, `timeout` is
    //   not a wait deadline (that meaning applies to getCurrentPosition).
    // - iOS: both interval fields are ignored. CLLocationManager delivers on
    //   its own cadence, typically ~1 Hz while moving and slower when still.
    // - Web: `minimumUpdateInterval` is ignored. `timeout` is the browser's
    //   max wait for a fix, not an interval; the browser chooses the rate.
    // `coords.heading` is GPS course-over-ground and only changes with a fix.
    Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 1000,
        maximumAge: 0,
        minimumUpdateInterval: 1000,
      },
      (position, err) => {
        if (err) {
          logWarn('Geolocation error:', err.message || err);
          setLocationAvailable(false);
          return;
        }
        if (position) {
          liveLocationRef.current = position;
          liveCursor.updateCursorLocation(position);
          // Persist so the next map open uses this location instead of Sydney
          saveLastLocation([
            position.coords.longitude,
            position.coords.latitude,
          ]);
          setLocationAvailable(true);
        }
      }
    ).then(id => {
      watchIdRef.current = id;
    });
    return theMap;
  }, []);

  // Clean up the location watcher and any still-queued tile fetches.
  useEffect(() => {
    mapMountedRef.current = true;
    return () => {
      mapMountedRef.current = false;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({id: watchIdRef.current}).catch(error =>
          logWarn('Failed to clear GPS watch on unmount:', error)
        );
        watchIdRef.current = null;
      }
      const theMap = olMapRef.current;
      if (!theMap) {
        return;
      }
      stopAllTileLoads(theMap);
      theMap.setTarget(undefined);
      olMapRef.current = undefined;
    };
  }, []);

  // Enable or disable user map navigation while leaving non-navigation
  // interactions, such as drawing, unaffected.
  useEffect(() => {
    if (!map || props.lockNavigation === undefined) {
      return;
    }

    map.getInteractions().forEach(interaction => {
      if (
        interaction instanceof DragPan ||
        interaction instanceof MouseWheelZoom ||
        interaction instanceof DoubleClickZoom ||
        interaction instanceof PinchZoom ||
        interaction instanceof PinchRotate ||
        interaction instanceof KeyboardPan ||
        interaction instanceof KeyboardZoom
      ) {
        interaction.setActive(!props.lockNavigation);
      }
    });
  }, [map, props.lockNavigation]);

  /**
   * Apply the configured extent/center to the map view.
   *
   * The first run establishes the initial view:
   * - extent takes priority over center, otherwise the cached/fallback location is used.
   * - Initial view positioning is applied immediately without animation.
   *
   * On later runs, changes to extent or center are animated.
   * If either is cleared, the current map position is preserved.
   */
  useEffect(() => {
    if (!map) {
      return;
    }

    const view = map.getView();
    const isInitialView = !hasInitialisedViewRef.current;

    // Track the initial view separately from later prop changes.
    if (isInitialView) {
      hasInitialisedViewRef.current = true;
    }

    // Extent takes priority over center. Later extent changes are animated.
    if (props.extent) {
      view.cancelAnimations();
      view.fit(
        transformExtent(props.extent, 'EPSG:4326', view.getProjection()),
        {
          padding: MAP_VIEW_FIT_PADDING_PX,
          maxZoom: props.zoom,
          duration: isInitialView ? undefined : MAP_VIEW_ANIMATION_DURATION_MS,
        }
      );

      return;
    }

    if (props.center) {
      const center = transform(props.center, 'EPSG:4326', defaultMapProjection);

      // Apply the configured center immediately on first load, then animate changes.
      if (isInitialView) {
        view.setCenter(center);
      } else {
        view.cancelAnimations();
        view.animate({
          center,
          duration: MAP_VIEW_ANIMATION_DURATION_MS,
        });
      }

      return;
    }

    // Only use the cached/fallback position when the map first opens.
    // If center/extent is later cleared, preserve the current map view.
    if (isInitialView) {
      const initialCenter = loadLastLocation() ?? FALLBACK_MAP_CENTER;

      view.setCenter(
        transform(initialCenter, 'EPSG:4326', defaultMapProjection)
      );
    }
  }, [map, props.center, props.extent, props.zoom]);

  // Optionally auto-fly to the first valid current GPS location.
  useEffect(() => {
    if (
      !map ||
      !autoFlyToCurrentLocation ||
      !currentPosition ||
      hasHandledFirstCurrentLocationRef.current
    ) {
      return;
    }

    const coords = getCoordinates(currentPosition);
    if (!coords) {
      return;
    }

    // Only handle the first successful current location result.
    // Later location updates only update the GPS marker, not the map view.
    hasHandledFirstCurrentLocationRef.current = true;

    const view = map.getView();
    view.cancelAnimations();
    view.animate({
      center: transform(coords, 'EPSG:4326', defaultMapProjection),
      duration: MAP_VIEW_ANIMATION_DURATION_MS,
    });
  }, [map, currentPosition, autoFlyToCurrentLocation]);

  // Create a layer to show the live cursor, return functions
  // that can be used to update the cursor location and accuracy
  const createLiveCursorFeatures = (theMap: Map) => {
    // Clean up before re-adding
    if (positionLayerRef.current) {
      theMap.removeLayer(positionLayerRef.current);
      positionLayerRef.current.getSource()?.clear();
      positionLayerRef.current = undefined;
    }

    const positionSource = new VectorSource();
    // The heading triangle offset is in map units sized to a fixed pixel gap.
    // Rebuild during zoom gestures and animations so that gap stays constant
    // instead of snapping when the gesture ends.
    const layer = new VectorLayer({
      source: positionSource,
      zIndex: GPS_CURSOR_LAYER_Z_INDEX,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    theMap.addLayer(layer);
    positionLayerRef.current = layer;

    const dotFeature = new Feature(new Point([0, 0]));
    dotFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 14,
          fill: new Fill({color: '#1a73e8'}),
          stroke: new Stroke({color: '#A19F9FFF', width: 3}),
        }),
      })
    );
    const triangleFeature = new Feature(new Point([0, 0]));
    const accuracyFeature = new Feature(new Point([0, 0]));
    positionSource.addFeatures([dotFeature, triangleFeature, accuracyFeature]);

    // function to update the cursor location when we move
    const updateCursorLocation = (position: Position) => {
      const coords = transform(
        [position.coords.longitude, position.coords.latitude],
        'EPSG:4326',
        theMap.getView().getProjection()
      );

      // set the location of the blue dot marking our position
      dotFeature.setGeometry(new Point(coords));
      dotFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 14,
            fill: new Fill({color: '#1a73e8'}),
            stroke: new Stroke({color: '#A19F9FFF', width: 3}),
          }),
        })
      );

      // Heading triangle. 0 is north and is a real bearing, so don't treat it
      // as missing. A null heading means the device is not reporting direction.
      if (typeof position.coords.heading === 'number') {
        const headingRadians = (position.coords.heading * Math.PI) / 180;
        triangleFeature.setGeometry(new Point(coords));
        triangleFeature.setStyle(
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 12,
              // angle PI draws one point facing down; add PI so heading 0 points north.
              rotation: headingRadians + Math.PI,
              // Default is screen-fixed, which leaves the marker pointing the
              // same way after the user rotates the map.
              rotateWithView: true,
              angle: Math.PI,
              fill: new Fill({color: '#1a73e8'}),
              stroke: new Stroke({color: 'white', width: 2}),
            }),
            geometry: () => {
              const resolution = theMap.getView().getResolution() ?? 1;
              return new Point(
                headingIndicatorCoordinate(
                  coords as [number, number],
                  headingRadians,
                  resolution
                )
              );
            },
          })
        );
      } else {
        triangleFeature.setStyle([]);
      }

      // set the location of the accuracy circle
      accuracyFeature.setGeometry(new Point(coords));
      updateCursorAccuracy(position.coords.accuracy);
    };

    // function to update the size of the accuracy circle if we zoom or it changes
    const updateCursorAccuracy = (accuracy: number) => {
      const resolution = theMap.getView().getResolution() ?? 1;
      const accuracyRadius = accuracy / resolution;
      accuracyFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: accuracyRadius,
            fill: new Fill({color: 'rgba(100, 149, 237, 0.1)'}),
            stroke: new Stroke({color: 'rgba(100, 149, 237, 0.4)', width: 1}),
          }),
        })
      );
    };

    return {updateCursorLocation, updateCursorAccuracy};
  };

  // Center the map on the current location
  const centerMap = () => {
    if (map && liveLocationRef.current) {
      const coords = getCoordinates(liveLocationRef.current);

      if (coords) {
        const view = map.getView();

        view.cancelAnimations();
        view.animate({
          center: transform(coords, 'EPSG:4326', defaultMapProjection),
          duration: MAP_VIEW_ANIMATION_DURATION_MS,
        });
      }
    }
  };

  // callback to add the map to the DOM
  // here is where we actually create the map if it doesn't exist already
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) {
        const theMap = olMapRef.current ?? map;
        if (theMap) {
          stopAllTileLoads(theMap);
          theMap.setTarget(undefined);
        }
        return;
      }

      if (!map) {
        // First render - create new map
        createMap(element).then((theMap: Map) => {
          if (!mapMountedRef.current || !element.isConnected) {
            stopAllTileLoads(theMap);
            theMap.setTarget(undefined);
            return;
          }
          olMapRef.current = theMap;
          setMap(theMap);
          props.parentSetMap(theMap);
        });
      } else if (element !== map.getTarget()) {
        // Subsequent renders - only set target if it has changed
        map.setTarget(element);
      }
    },
    [map, createMap]
  );

  // Keep the OpenLayers canvas in sync with its container size (OL doesn't
  // observe container resizes itself). Also refresh after entering or leaving
  // full-screen so tiles fill the new viewport immediately.
  useEffect(() => {
    if (!map) return;
    const target = map.getTargetElement();
    if (!target) return;
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target);
    const frame = requestAnimationFrame(() => map.updateSize());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map, isFullscreen]);

  // Handler for the "use current location" control (map picker only)
  const setSelectionAsCurrentLocation =
    props.additionalControls?.setSelectionAsCurrentLocation;
  const handleUseCurrentLocation = () => {
    if (liveLocationRef.current && setSelectionAsCurrentLocation) {
      const coords = transform(
        [
          liveLocationRef.current.coords.longitude,
          liveLocationRef.current.coords.latitude,
        ],
        'EPSG:4326',
        defaultMapProjection
      );
      setSelectionAsCurrentLocation(new Point(coords));
    }
  };

  const showOverlay = showControls || props.topOverlay || enableFullscreen;
  const showTopRight =
    enableFullscreen || (showControls && !!setSelectionAsCurrentLocation);

  return (
    <Box
      role={isFullscreen ? 'dialog' : undefined}
      aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? 'Full screen map' : undefined}
      sx={theme => ({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        ...(isFullscreen && {
          position: 'fixed',
          inset: 0,
          zIndex: theme.zIndex.modal,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
          pb: 'env(safe-area-inset-bottom, 0px)',
        }),
      })}
    >
      <Box sx={{position: 'relative', flex: 1, minHeight: 0, width: '100%'}}>
        <Box
          ref={refCallback} // will create the map
          sx={{
            height: '100%',
            width: '100%',
          }}
        />
        {map && showOverlay && (
          <MapControlsOverlay
            insetSafeArea={isFullscreen}
            topContent={
              <>
                {props.topOverlay}
                {showControls && (
                  <ContextualLayersControl
                    map={map}
                    baseLayers={baseLayers}
                    onUpdateBaseLayer={updateBaseLayer}
                    onResetBaseLayers={resetBaseLayers}
                    recordLayers={props.recordLayers}
                    onUpdateRecordLayer={props.onUpdateRecordLayer}
                    onResetRecordLayers={props.onResetRecordLayers}
                    layerErrors={layerErrors}
                  />
                )}
              </>
            }
            topRight={
              showTopRight && (
                <>
                  {enableFullscreen && (
                    <FullscreenControl
                      isFullscreen={isFullscreen}
                      onToggle={toggleFullscreen}
                    />
                  )}
                  {showControls && setSelectionAsCurrentLocation && (
                    <UseCurrentLocationControl
                      onSetPoint={handleUseCurrentLocation}
                      locationAvailable={locationAvailable}
                    />
                  )}
                </>
              )
            }
            bottomRight={
              showControls && (
                <MapControlStack>
                  <CompassControl map={map} />
                  <CenterOnLocationControl
                    onCenter={centerMap}
                    locationAvailable={locationAvailable}
                  />
                  <ZoomControl map={map} />
                </MapControlStack>
              )
            }
          />
        )}
      </Box>
      {attribution && (
        <Box
          component="div"
          dangerouslySetInnerHTML={{__html: attribution}}
          sx={mapAttributionSx}
        />
      )}
    </Box>
  );
};
