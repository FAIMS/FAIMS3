/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * MapComponent.tsx
 *
 * An interactive OpenLayers map component with support for:
 * - Real-time GPS tracking (blue dot, accuracy circle, direction triangle)
 * - Pluggable tile sources with optional offline support
 * - Dynamic center control and zooming
 * - Integration with parent component through callback
 *
 * ## Tile Source Injection
 *
 * This component uses dependency injection for tile sources to support different
 * deployment scenarios. The client application provides a `TileSourceProvider`
 * implementation that handles:
 *
 * - Tile layer creation (online, offline, or hybrid)
 * - Attribution management
 * - Optional offline cache checking
 *
 * ### Default Behaviour
 *
 * If no provider is supplied, the component uses `DefaultTileSourceProvider`
 * which renders OpenStreetMap tiles (online only, no caching).
 *
 * ### Offline Support
 *
 * For offline support, the client application should:
 * 1. Implement `TileSourceProvider` with their caching strategy
 * 2. Optionally implement `mapCacheIncludes` to check cache coverage
 * 3. Use `canShowMapNear` to determine if the map can be displayed
 *
 * @example
 * ```tsx
 * // Basic usage with default tiles
 * <MapComponent
 *   parentSetMap={setMap}
 *   center={[151.2093, -33.8688]}
 *   zoom={14}
 * />
 *
 * // With custom tile provider for offline support
 * const offlineProvider: TileSourceProvider = {
 *   getTileLayer: () => myOfflineTileLayer,
 *   getAttribution: () => '© My Tiles',
 *   mapCacheIncludes: async (features) => checkMyCache(features),
 * };
 *
 * <MapComponent
 *   parentSetMap={setMap}
 *   tileSourceProvider={offlineProvider}
 *   center={[151.2093, -33.8688]}
 * />
 * ```
 */

import {Geolocation, Position} from '@capacitor/geolocation';
import {Box, Typography} from '@mui/material';
import {View} from 'ol';
import {Zoom} from 'ol/control';
import Feature from 'ol/Feature';
import GeoJSON, {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {Point} from 'ol/geom';
import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform, transformExtent} from 'ol/proj';
import {OSM} from 'ol/source';
import VectorSource from 'ol/source/Vector';
import {Fill, RegularShape, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createCenterControl} from './CenterControl';
import {getCoordinates, useCurrentLocation} from './helpers/useLocation';
import {Coordinates, TileSourceProvider, WGS84Extent} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Default map projection used by OpenLayers */
const DEFAULT_MAP_PROJECTION = 'EPSG:3857';

/** Standard coordinate system for GPS/GeoJSON */
const WGS84_PROJECTION = 'EPSG:4326';

/** Maximum zoom level allowed */
const MAX_ZOOM = 20;

/** Minimum zoom level when online */
const MIN_ZOOM_ONLINE = 0;

/** Minimum zoom level when offline (prevents zooming beyond cached tiles) */
const MIN_ZOOM_OFFLINE = 12;

/** Default zoom level */
const DEFAULT_ZOOM = 12;

/** Default center coordinates (Sydney, Australia) */
const DEFAULT_CENTER: Coordinates = [151.2093, -33.8688];

/** Default GPS accuracy in meters when actual accuracy is unavailable */
const DEFAULT_ACCURACY_METERS = 30;

/**
 * Props for the MapComponent.
 */
export interface MapComponentProps {
  /**
   * Callback invoked when the map instance is created.
   *
   * Use this to get a reference to the OpenLayers Map for external
   * manipulation (adding layers, handling events, etc.).
   *
   * @param map - The created OpenLayers Map instance
   */
  parentSetMap: (map: Map) => void;

  /**
   * Optional tile source provider for custom tile layers.
   *
   * If not provided, defaults to online-only OpenStreetMap tiles.
   * Provide a custom implementation for offline support or
   * alternative tile sources.
   */
  tileSourceProvider?: TileSourceProvider;

  /**
   * Initial map center in WGS84 coordinates [longitude, latitude].
   *
   * If not provided, the component will:
   * 1. Try to use the center of `extent` if provided
   * 2. Fall back to current GPS location
   * 3. Default to Sydney, Australia
   */
  center?: Coordinates;

  /**
   * Bounding box to fit the map view to, in WGS84 coordinates.
   * Format: [minLon, minLat, maxLon, maxLat]
   *
   * When provided, the map will fit this extent with padding,
   * respecting the `zoom` prop as maximum zoom level.
   */
  extent?: WGS84Extent;

  /**
   * Initial zoom level (0-20).
   *
   * When used with `extent`, this acts as the maximum zoom level
   * for the fit operation.
   *
   * @default 12
   */
  zoom?: number;

  /**
   * Whether the application is currently online.
   *
   * When false, restricts minimum zoom level to prevent zooming
   * beyond cached tile coverage.
   *
   * @default true
   */
  isOnline?: boolean;
}

/**
 * Internal interface for live cursor update functions.
 */
interface LiveCursorControls {
  /** Update the cursor position on the map */
  updateCursorLocation: (position: Position) => void;
  /** Update the accuracy circle radius */
  updateCursorAccuracy: (accuracyMeters: number) => void;
}

// ============================================================================
// Default Tile Source Provider
// ============================================================================

/**
 * Default tile source provider using OpenStreetMap.
 *
 * This provides basic online-only map tiles with standard OSM attribution.
 * Use this as a reference implementation or fallback when no custom
 * provider is needed.
 */
export const DefaultTileSourceProvider: TileSourceProvider = {
  getTileLayer: () =>
    new TileLayer({
      source: new OSM(),
    }) as BaseLayer,

  getAttribution: () =>
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determines if a map can be displayed near the given features.
 *
 * This function checks whether the map can be rendered, considering:
 * - Online status (always returns true when online)
 * - Offline tile cache coverage (when offline)
 *
 * Use this before rendering a MapComponent to avoid showing an empty
 * or broken map when offline without cached tiles.
 *
 * @param features - GeoJSON features defining the area of interest
 * @param tileSourceProvider - The tile source provider to check cache against
 * @param isOnline - Current online status
 * @returns Promise resolving to true if map can be displayed
 */
export const canShowMapNear = async (
  features: GeoJSONFeatureCollection | undefined,
  tileSourceProvider: TileSourceProvider,
  isOnline: boolean
): Promise<boolean> => {
  // Always show map when online
  if (isOnline) {
    return true;
  }

  // If we have features and the provider supports cache checking
  if (features && tileSourceProvider.mapCacheIncludes) {
    const geoJson = new GeoJSON();
    const parsedFeatures = geoJson.readFeatures(features, {
      dataProjection: WGS84_PROJECTION,
      featureProjection: DEFAULT_MAP_PROJECTION,
    });

    const canBe = await tileSourceProvider.mapCacheIncludes(parsedFeatures);
    console.log('Thinks can be seen,', canBe);
    return canBe
  }

  // No features or no cache checking capability - can't show offline
  return false;
};

/**
 * Calculates the center point of a bounding box extent.
 *
 * @param extent - Bounding box [minX, minY, maxX, maxY]
 * @returns Center coordinates [x, y]
 */
const getExtentCenter = (extent: WGS84Extent): Coordinates => {
  const centerX = (extent[0] + extent[2]) / 2;
  const centerY = (extent[1] + extent[3]) / 2;
  return [centerX, centerY];
};

// ============================================================================
// Live Cursor Component Logic
// ============================================================================

/**
 * Creates the live GPS cursor layer and returns control functions.
 *
 * The cursor consists of three elements:
 * - Blue dot: Current position
 * - Accuracy circle: GPS accuracy radius (semi-transparent)
 * - Direction triangle: Heading indicator (when moving)
 *
 * @param map - The OpenLayers Map instance
 * @param existingLayerRef - Ref to track and clean up existing layers
 * @returns Control functions for updating cursor position and accuracy
 */
const createLiveCursorLayer = (
  map: Map,
  existingLayerRef: React.MutableRefObject<
    VectorLayer<VectorSource> | undefined
  >
): LiveCursorControls => {
  // Clean up any existing layer
  if (existingLayerRef.current) {
    map.removeLayer(existingLayerRef.current);
    existingLayerRef.current.getSource()?.clear();
    existingLayerRef.current = undefined;
  }

  // Create new layer and source
  const positionSource = new VectorSource();
  const layer = new VectorLayer({
    source: positionSource,
    zIndex: 999, // Ensure cursor is always on top
  });
  map.addLayer(layer);
  existingLayerRef.current = layer;

  // Create the three cursor features
  const dotFeature = new Feature(new Point([0, 0]));
  const triangleFeature = new Feature(new Point([0, 0]));
  const accuracyFeature = new Feature(new Point([0, 0]));

  // Set initial dot style
  dotFeature.setStyle(createDotStyle());

  positionSource.addFeatures([dotFeature, triangleFeature, accuracyFeature]);

  /**
   * Updates all cursor elements to reflect new GPS position.
   */
  const updateCursorLocation = (position: Position): void => {
    const coords = transform(
      [position.coords.longitude, position.coords.latitude],
      WGS84_PROJECTION,
      map.getView().getProjection()
    );

    // Update position dot
    dotFeature.setGeometry(new Point(coords));
    dotFeature.setStyle(createDotStyle());

    // Update heading triangle (only if heading available)
    if (
      position.coords.heading !== null &&
      position.coords.heading !== undefined
    ) {
      const headingRadians = (position.coords.heading * Math.PI) / 180;
      triangleFeature.setGeometry(new Point(coords));
      triangleFeature.setStyle(createHeadingStyle(map, coords, headingRadians));
    } else {
      // Hide triangle when no heading
      triangleFeature.setStyle(undefined);
    }

    // Update accuracy circle position
    accuracyFeature.setGeometry(new Point(coords));
    updateCursorAccuracy(position.coords.accuracy);
  };

  /**
   * Updates the accuracy circle radius based on GPS accuracy and zoom level.
   */
  const updateCursorAccuracy = (accuracyMeters: number): void => {
    const resolution = map.getView().getResolution() ?? 1;
    const accuracyRadius = accuracyMeters / resolution;

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

/**
 * Creates the style for the position dot.
 */
const createDotStyle = (): Style =>
  new Style({
    image: new CircleStyle({
      radius: 14,
      fill: new Fill({color: '#1a73e8'}),
      stroke: new Stroke({color: '#A19F9FFF', width: 3}),
    }),
  });

/**
 * Creates the style for the heading direction triangle.
 *
 * The triangle is positioned offset from the center dot in the
 * direction of travel.
 */
const createHeadingStyle = (
  map: Map,
  coords: number[],
  headingRadians: number
): Style =>
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
      // Offset triangle from center in heading direction
      const px = map.getPixelFromCoordinate(coords);
      const offset = 23;
      const dx = offset * Math.sin(headingRadians);
      const dy = -offset * Math.cos(headingRadians);
      const newPx = [px[0] + dx, px[1] + dy];
      return new Point(map.getCoordinateFromPixel(newPx));
    },
  });

// ============================================================================
// Main Component
// ============================================================================

/**
 * MapComponent
 *
 * Renders an interactive OpenLayers map with GPS tracking and optional
 * offline tile support.
 *
 * ## Features
 *
 * - **GPS Tracking**: Shows current position with accuracy indicator
 * - **Heading Display**: Shows direction of travel when moving
 * - **Center Control**: Button to re-center on current location
 * - **Offline Support**: Pluggable tile source for cached tiles
 * - **Extent Fitting**: Can fit view to provided bounding box
 *
 * ## Usage
 *
 * The component requires a callback to receive the Map instance.
 * Optionally provide a tile source provider for custom tiles.
 *
 * @see MapComponentProps for all available props
 * @see TileSourceProvider for implementing custom tile sources
 */
export const MapComponent = ({
  parentSetMap,
  tileSourceProvider = DefaultTileSourceProvider,
  center: propCenter,
  extent: propExtent,
  zoom: propZoom = DEFAULT_ZOOM,
  isOnline = true,
}: MapComponentProps) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [map, setMap] = useState<Map | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState(propZoom);
  const [attribution, setAttribution] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  /** Reference to the position layer for cleanup */
  const positionLayerRef = useRef<VectorLayer<VectorSource>>();

  /** Geolocation watch ID for cleanup */
  const watchIdRef = useRef<string | null>(null);

  /** Current GPS position (updated by watch) */
  const liveLocationRef = useRef<Position | null>(null);

  /** Live cursor control functions */
  const liveCursorControlsRef = useRef<LiveCursorControls | null>(null);

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  // Fallback location when no center/extent provided
  const {data: currentPosition, isLoading: loadingLocation} =
    useCurrentLocation();

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  /**
   * Determines the map center based on available information.
   * Priority: props.center > props.extent center > GPS location > Sydney
   */
  const mapCenter = useMemo((): Coordinates => {
    if (propCenter) {
      return propCenter;
    }

    if (propExtent) {
      return getExtentCenter(propExtent);
    }

    // Try live GPS location
    if (liveLocationRef.current) {
      const coords = getCoordinates(liveLocationRef.current);
      if (coords) return coords as Coordinates;
    }

    // Try initial GPS location from hook
    if (!loadingLocation && currentPosition) {
      const coords = getCoordinates(currentPosition);
      if (coords) return coords as Coordinates;
    }

    // Default fallback
    return DEFAULT_CENTER;
  }, [propCenter, propExtent, loadingLocation, currentPosition]);

  // -------------------------------------------------------------------------
  // Map Creation
  // -------------------------------------------------------------------------

  /**
   * Creates and initializes the OpenLayers map.
   */
  const createMap = useCallback(
    async (element: HTMLElement): Promise<Map> => {
      // Set up tile layer from provider
      setAttribution(tileSourceProvider.getAttribution());
      const tileLayer = tileSourceProvider.getTileLayer();

      // Configure view with appropriate zoom constraints
      const view = new View({
        projection: DEFAULT_MAP_PROJECTION,
        zoom: zoomLevel,
        minZoom: isOnline ? MIN_ZOOM_ONLINE : MIN_ZOOM_OFFLINE,
        maxZoom: MAX_ZOOM,
      });

      // Create map instance
      const theMap = new Map({
        target: element,
        layers: [tileLayer],
        view: view,
        controls: [new Zoom()],
      });

      // Set up live cursor
      const cursorControls = createLiveCursorLayer(theMap, positionLayerRef);
      liveCursorControlsRef.current = cursorControls;

      // Handle zoom changes - update state and redraw accuracy circle
      theMap.getView().on('change:resolution', () => {
        const z = theMap.getView().getZoom();
        if (z !== undefined) {
          setZoomLevel(z);
          // Redraw accuracy circle at new zoom level
          cursorControls.updateCursorAccuracy(
            liveLocationRef.current?.coords.accuracy ?? DEFAULT_ACCURACY_METERS
          );
        }
      });

      // Start GPS watch
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Always get fresh position
        },
        (position, err) => {
          if (err) {
            console.warn('Geolocation error:', err.message || err);
            return;
          }
          if (position) {
            liveLocationRef.current = position;
            cursorControls.updateCursorLocation(position);
          }
        }
      );
      watchIdRef.current = watchId;

      return theMap;
    },
    [tileSourceProvider, zoomLevel, isOnline]
  );

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Clean up GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({id: watchIdRef.current}).catch(error =>
          console.warn('Failed to clear GPS watch on unmount:', error)
        );
        watchIdRef.current = null;
      }
    };
  }, []);

  // Set map center/extent when map or relevant props change
  useEffect(() => {
    if (!map) return;

    // Add center control
    const centerMapFn = () => {
      if (liveLocationRef.current) {
        const coords = getCoordinates(liveLocationRef.current);
        if (coords) {
          const center = transform(
            coords,
            WGS84_PROJECTION,
            DEFAULT_MAP_PROJECTION
          );
          map.getView().setCenter(center);
        }
      }
    };
    map.addControl(createCenterControl(map.getView(), centerMapFn));

    // Apply extent or center
    if (propExtent) {
      const transformedExtent = transformExtent(
        propExtent,
        WGS84_PROJECTION,
        map.getView().getProjection()
      );
      map.getView().fit(transformedExtent, {
        padding: [20, 20, 20, 20],
        maxZoom: propZoom,
      });
    } else {
      const center = transform(
        mapCenter,
        WGS84_PROJECTION,
        DEFAULT_MAP_PROJECTION
      );
      map.getView().setCenter(center);
    }
  }, [map, mapCenter, propExtent, propZoom]);

  // -------------------------------------------------------------------------
  // Ref Callback
  // -------------------------------------------------------------------------

  /**
   * Callback ref that creates the map when the container element is available.
   */
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;

      if (!map) {
        // First render - create new map
        createMap(element).then((theMap: Map) => {
          setMap(theMap);
          parentSetMap(theMap);
        });
      } else if (element !== map.getTarget()) {
        // Element changed - update target
        map.setTarget(element);
      }
    },
    [map, createMap, parentSetMap]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: '400px',
      }}
    >
      <Box
        ref={refCallback}
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: 0, // Important for flex child to shrink properly
        }}
      />
      {attribution && (
        <Box sx={{py: 0.5, px: 2, flexShrink: 0}}>
          <Typography
            variant="caption"
            component="div"
            dangerouslySetInnerHTML={{__html: attribution}}
          />
        </Box>
      )}
    </Box>
  );
};

export default MapComponent;
