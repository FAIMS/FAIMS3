/*
 * Copyright 2021, 2022 Macquarie University
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
/**
 * MapComponent.tsx
 *
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
import {
  CenterOnLocationControl,
  CompassControl,
  LayerToggleControl,
  UseCurrentLocationControl,
  ZoomControl,
} from './controls/map-controls';
import {MapControlsOverlay, MapControlStack} from './controls/primitives';
import {MapControlThemeProvider} from './mapTheme';
import {createTileStore} from './TileStore';
import {MapConfig} from './types';

export const defaultMapProjection = 'EPSG:3857';
const MAX_ZOOM = 20;
const MIN_ZOOM = 12;

const LAST_LOCATION_KEY = 'last_map_center';

function saveLastLocation(coords: [number, number]) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(coords));
  } catch {
    // Silently ignore — localStorage can be unavailable in private browsing
    // or when storage quota is exceeded. Losing the cached location is
    // acceptable; the map will fall back to Sydney on next open.
  }
}

function loadLastLocation(): [number, number] | null {
  try {
    const stored = localStorage.getItem(LAST_LOCATION_KEY);
    if (stored) {
      const coords = JSON.parse(stored);
      if (
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        return coords as [number, number];
      }
    }
  } catch {
    //  malformed JSON in localStorage is treated as no cache
  }
  return null;
}

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

  /** When false, hides zoom, compass, layer toggle, and location controls. */
  showControls?: boolean;
}

/**
 * MapComponent
 *
 * This is the main map rendering component. It:
 * - Initializes an OpenLayers map with tile support
 * - Renders live GPS location and directional cursor
 * - Accepts a parent callback to provide the map instance
 */
/**
 * Wraps {@link MapComponentImpl} with {@link MapControlThemeProvider} so map
 * controls render correctly outside the mobile app's MUI theme.
 */
export const MapComponent = (props: MapComponentProps) => (
  <MapControlThemeProvider>
    <MapComponentImpl {...props} />
  </MapControlThemeProvider>
);

/** OpenLayers map with optional controls, GPS overlay, and layer toggle. */
const MapComponentImpl = (props: MapComponentProps) => {
  const showControls = props.showControls ?? true;
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState(props.zoom || MIN_ZOOM); // Default zoom level
  const [attribution, setAttribution] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // Whether we have a live GPS fix (drives control button enablement)
  const [locationAvailable, setLocationAvailable] = useState<boolean>(false);
  const tileStore = useMemo(() => createTileStore(props.config), []);
  // Layers are memoised so the layer toggle control operates on the same
  // instances that were added to the map
  const tileLayer = useMemo(() => tileStore.getTileLayer(), [tileStore]);
  const satelliteLayer = useMemo(
    () =>
      tileStore.hasSatellite() ? tileStore.getSatelliteLayer() : undefined,
    [tileStore]
  );
  const vectorZoomRange = useMemo(
    () => tileStore.getVectorZoomRange(),
    [tileStore]
  );
  const satelliteZoomRange = useMemo(
    () => tileStore.getSatelliteZoomRange(),
    [tileStore]
  );
  const handleLayerChange = useCallback(
    (isSatellite: boolean) => {
      setAttribution(
        isSatellite
          ? tileStore.getSatelliteAttribution()
          : (tileStore.getAttribution() as unknown as string)
      );
    },
    [tileStore]
  );

  // Listen for online/offline events to update isOnline state
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Use the custom hook for location which we only need if we don't have a center or extent
  // passed in props
  const {data: currentPosition, isLoading: loadingLocation} =
    useCurrentLocation();

  const positionLayerRef = useRef<VectorLayer>();
  const watchIdRef = useRef<string | null>(null);
  const liveLocationRef = useRef<Position | null>(null);

  // Determine map center based on props or current location.
  // Priority: explicit center > extent > live GPS > cached position > last saved location > Sydney
  const mapCenter = useMemo(() => {
    if (props.center) {
      return props.center;
    } else if (props.extent) {
      // find the centre of the extent and return that
      const centerX = (props.extent[0] + props.extent[2]) / 2;
      const centerY = (props.extent[1] + props.extent[3]) / 2;
      return [centerX, centerY];
    }
    // otherwise rely on current location
    if (liveLocationRef.current) {
      return getCoordinates(liveLocationRef.current ?? undefined);
    } else if (!loadingLocation && currentPosition) {
      return getCoordinates(currentPosition);
    } else {
      // use the last location the user had the map open at, so it feels
      // consistent even when GPS is slow or unavailable
      const cached = loadLastLocation();
      if (cached) return cached;
      // final fallback to Sydney
      return [151.2093, -33.8688];
    }
  }, [props.center, props.extent, currentPosition, loadingLocation]);

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
      minZoom: isOnline ? 0 : 12,
      maxZoom: MAX_ZOOM,
    });

    const theMap = new Map({
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

    // Watch real GPS position and update cursor when it changes
    Geolocation.watchPosition(
      // maximum age to avoid using cached position of the user.
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 0},
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

  // Clean up the location watcher when the component unmounts
  useEffect(() => {
    return () => {
      // Clean up location watcher when component unmounts
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({id: watchIdRef.current}).catch(error =>
          logWarn('Failed to clear GPS watch on unmount:', error)
        );
        watchIdRef.current = null;
      }
    };
  }, []);

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
    const layer = new VectorLayer({source: positionSource, zIndex: 999});
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

      // draw the heading triangle
      // convert heading from degrees to radians
      if (position.coords.heading) {
        const headingRadians = (position.coords.heading * Math.PI) / 180;
        triangleFeature.setGeometry(new Point(coords));
        triangleFeature.setStyle(
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 12,
              rotation: headingRadians + Math.PI,
              angle: Math.PI,
              fill: new Fill({color: '#1a73e8'}),
              stroke: new Stroke({color: 'white', width: 2}),
            }),
            geometry: () => {
              const px = theMap.getPixelFromCoordinate(coords);
              const offset = 23;
              const dx = offset * Math.sin(headingRadians);
              const dy = -offset * Math.cos(headingRadians);
              const newPx = [px[0] + dx, px[1] + dy];
              return new Point(theMap.getCoordinateFromPixel(newPx));
            },
          })
        );
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
        const center = transform(coords, 'EPSG:4326', defaultMapProjection);
        map.getView().setCenter(center);
      }
    }
  };

  // Here we set the extent of the map or just the center depending on
  // what information we are given
  useEffect(() => {
    if (map && mapCenter) {
      // move the map to the center and fit the extent
      if (mapCenter) {
        const center = transform(mapCenter, 'EPSG:4326', defaultMapProjection);

        // we set the map extent if we were given one or if not,
        // set the map center which will either have been passed
        // in or derived from the current location
        if (props.extent) {
          // need to transform the extent to the map projection
          map
            .getView()
            .fit(
              transformExtent(
                props.extent,
                'EPSG:4326',
                map.getView().getProjection()
              ),
              {
                padding: [20, 20, 20, 20],
                maxZoom: props.zoom,
              }
            );
        } else {
          map.getView().setCenter(center);
        }
      }
    }
  }, [map, mapCenter, props.center, props.extent, props.zoom]);

  // callback to add the map to the DOM
  // here is where we actually create the map if it doesn't exist already
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;

      if (!map) {
        // First render - create new map
        createMap(element).then((theMap: Map) => {
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
  // observe container resizes itself)
  useEffect(() => {
    if (!map) return;
    const target = map.getTargetElement();
    if (!target) return;
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target);
    return () => observer.disconnect();
  }, [map]);

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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <Box sx={{position: 'relative', flex: 1, minHeight: 0, width: '100%'}}>
        <Box
          ref={refCallback} // will create the map
          sx={{
            height: '100%',
            width: '100%',
          }}
        />
        {map && (showControls || props.topOverlay) && (
          <MapControlsOverlay
            topContent={props.topOverlay}
            topRight={
              showControls &&
              setSelectionAsCurrentLocation && (
                <UseCurrentLocationControl
                  onSetPoint={handleUseCurrentLocation}
                  locationAvailable={locationAvailable}
                />
              )
            }
            bottomRight={
              showControls && (
                <>
                  <CompassControl map={map} />
                  <MapControlStack>
                    {satelliteLayer && (
                      <LayerToggleControl
                        map={map}
                        vectorLayer={tileLayer}
                        satelliteLayer={satelliteLayer}
                        isOnline={isOnline}
                        vectorZoomRange={vectorZoomRange}
                        satelliteZoomRange={satelliteZoomRange}
                        onLayerChange={handleLayerChange}
                      />
                    )}
                    <CenterOnLocationControl
                      onCenter={centerMap}
                      locationAvailable={locationAvailable}
                    />
                    <ZoomControl map={map} />
                  </MapControlStack>
                </>
              )
            }
          />
        )}
      </Box>
      {attribution && (
        <Box
          component="div"
          dangerouslySetInnerHTML={{__html: attribution}}
          sx={{
            flexShrink: 0,
            fontSize: '10px',
            lineHeight: 1.3,
            color: 'text.secondary',
            py: 0.25,
            px: {xs: 0.5, sm: 1},
            wordBreak: 'break-word',
          }}
        />
      )}
    </Box>
  );
};
