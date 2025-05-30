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

import {Box, Grid} from '@mui/material';
import {View} from 'ol';
import {Zoom} from 'ol/control';
import {Extent} from 'ol/extent';
import GeoJSON, {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, RegularShape, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIsOnline} from '../../../utils/customHooks';
import {getCoordinates, useCurrentLocation} from '../../../utils/useLocation';
import {createCenterControl} from '../map/center-control';
import {failedURLs, VectorTileStore} from './tile-source';
import Feature from 'ol/Feature';
import {Point} from 'ol/geom';
import CircleStyle from 'ol/style/Circle';
import {Geolocation, Position} from '@capacitor/geolocation';

const defaultMapProjection = 'EPSG:3857';
const MAX_ZOOM = 20;
const MIN_ZOOM = 12;

/**
 * canShowMapNear - can we show a map near this location?
 *
 * Return true if we are online or if we have a cached map that includes
 * the center location.
 */
export const canShowMapNear = async (
  features: GeoJSONFeatureCollection | undefined
) => {
  if (navigator.onLine) return true;

  if (features) {
    const geoJson = new GeoJSON();
    const parsedFeatures = geoJson.readFeatures(features, {
      dataProjection: 'EPSG:4326',
      featureProjection: defaultMapProjection,
    });

    // now work out if we have a stored map
    const tileStore = new VectorTileStore();
    return await tileStore.mapCacheIncludes(parsedFeatures);
  } else {
    return false;
  }
};

/**
 * A Map component for all our mapping needs.
 * Props:
 *   parentSetMap - callback from the parent component, called with the map element once it has been created.
 *   center: optional, the map center. If not supplied we try to get the current location or back off to Sydney.
 */
export interface MapComponentProps {
  parentSetMap: (map: Map) => void;
  center?: [number, number];
  extent?: Extent;
  zoom?: number;
}

/**
 * MapComponent
 *
 * This is the main map rendering component. It:
 * - Initializes an OpenLayers map with tile support
 * - Renders live GPS location and directional cursor
 * - Accepts a parent callback to provide the map instance
 */
export const MapComponent = (props: MapComponentProps) => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState(props.zoom || MIN_ZOOM); // Default zoom level
  const [attribution, setAttribution] = useState<string | null>(null);
  const {isOnline} = useIsOnline();
  const tileStore = useMemo(() => new VectorTileStore(), []);

  // Use the custom hook for location
  const {data: currentPosition, isLoading: loadingLocation} =
    useCurrentLocation();

  // Determine map center based on props or current location
  const mapCenter = useMemo(() => {
    if (props.center) {
      return props.center;
    }
    return getCoordinates(currentPosition);
  }, [props.center, currentPosition]);

  const positionLayerRef = useRef<VectorLayer>();
  const watchIdRef = useRef<string | null>(null);
  const liveLocationRef = useRef<Position | null>(null);

  /**
   * Initializes the map instance with base tile layers and zoom controls.
   */
  const createMap = useCallback(async (element: HTMLElement): Promise<Map> => {
    setAttribution(tileStore.getAttribution() as unknown as string);
    const tileLayer = tileStore.getTileLayer();
    // if we're offline, limit the zoom level to 12 so that we don't go
    // off map.
    // TODO: Could also limit the extent to that covered by the offline
    // map.

    const view = new View({
      projection: defaultMapProjection,
      zoom: zoomLevel,
      minZoom: isOnline ? 0 : 12,
      maxZoom: MAX_ZOOM,
    });

    const theMap = new Map({
      target: element,
      layers: [tileLayer],
      view: view,
      controls: [new Zoom()],
    });

    // create a center control
    theMap.getView().on('change:resolution', () => {
      const z = theMap.getView().getZoom();
      if (z) setZoomLevel(z);
    });

    return theMap;
  }, []);

  /**
   * Initializes and updates the live GPS location cursor.
   * Displays:
   * - Blue dot at user location with directional traingular and accuracy circle. which would wokk on rela-time gps location tracking
   *   */
  const startLiveCursor = (theMap: Map) => {
    // Clean up before re-adding
    if (positionLayerRef.current) {
      theMap.removeLayer(positionLayerRef.current);
      positionLayerRef.current.getSource()?.clear();
      positionLayerRef.current = undefined;
    }
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch({id: watchIdRef.current}).catch(() =>
        console.warn('Failed to clear previous GPS watch')
      );
      watchIdRef.current = null;
    }
    const view = theMap.getView();
    const projection = view.getProjection();
    const positionSource = new VectorSource();
    const layer = new VectorLayer({source: positionSource, zIndex: 999});
    theMap.addLayer(layer);
    positionLayerRef.current = layer;

    const dotFeature = new Feature(new Point([0, 0]));
    const triangleFeature = new Feature(new Point([0, 0]));
    const accuracyFeature = new Feature(new Point([0, 0]));
    positionSource.addFeatures([dotFeature, triangleFeature, accuracyFeature]);

    const updateCursor = (
      coords: number[],
      heading: number,
      accuracy: number
    ) => {
      const resolution = view.getResolution() ?? 1;

      //  blue location dot
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

      // accuracy circle
      const accuracyRadius = accuracy / resolution;
      accuracyFeature.setGeometry(new Point(coords));
      accuracyFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: accuracyRadius,
            fill: new Fill({color: 'rgba(100, 149, 237, 0.1)'}),
            stroke: new Stroke({color: 'rgba(100, 149, 237, 0.4)', width: 1}),
          }),
        })
      );

      // heading is in degrees
      const headingRadians = (heading * Math.PI) / 180;
      // directional navigation triangle
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
    };

    // Watch real GPS position and update cursor
    Geolocation.watchPosition(
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}, // maximum age to avoic using cached postion of the user.
      (position, err) => {
        if (err) {
          console.warn('Geolocation error:', err.message || err);
          return;
        }
        if (position) {
          liveLocationRef.current = position;
          const coords = transform(
            [position.coords.longitude, position.coords.latitude],
            'EPSG:4326',
            projection
          );
          updateCursor(
            coords,
            position.coords.heading ?? 0,
            position.coords.accuracy ?? 30
          );
        }
      }
    ).then(id => {
      watchIdRef.current = id;
    });
  };

  // center the map on the current location
  const centerMap = () => {
    if (map && liveLocationRef.current) {
      const coords = getCoordinates(liveLocationRef.current);
      if (coords) {
        const center = transform(coords, 'EPSG:4326', defaultMapProjection);
        map.getView().setCenter(center);
      }
    }
  };

  // when we have a location and a map, add the 'here' marker to the map
  useEffect(() => {
    if (!loadingLocation && map && mapCenter) {
      startLiveCursor(map);
      if (mapCenter) {
        const center = transform(mapCenter, 'EPSG:4326', defaultMapProjection);
        map.addControl(createCenterControl(map.getView(), centerMap));

        // we set the map extent if we were given one or if not,
        // set the map center which will either have been passed
        // in or derived from the current location
        if (props.extent) {
          map.getView().fit(props.extent, {
            padding: [20, 20, 20, 20],
            maxZoom: props.zoom,
          });
        } else {
          map.getView().setCenter(center);
        }
      }
    }
  }, [map, mapCenter, loadingLocation]);

  // callback to add the map to the DOM
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

  // This avoids double-calling and ensures cursor only starts after DOM + map are fully ready
  useEffect(() => {
    if (map) {
      startLiveCursor(map);
    }
  }, [map]);

  return (
    <>
      <Grid container spacing={2}>
        {loadingLocation ? (
          <div>Loading location...</div>
        ) : (
          <Box sx={{height: '100%', width: '100%', minHeight: '600px'}}>
            <Box
              ref={refCallback}
              sx={{
                height: '95%',
                width: '100%',
              }}
            />
            <Box sx={{height: '5%', paddingLeft: '20px'}}>
              {attribution && (
                <p dangerouslySetInnerHTML={{__html: attribution}} />
              )}
            </Box>
            {failedURLs.size > 0 && (
              <details>
                <summary>Style Cache Misses</summary>
                {Array.from(failedURLs).map((url, i) => (
                  <p key={i}>{url}</p>
                ))}
              </details>
            )}
          </Box>
        )}
      </Grid>
    </>
  );
};
