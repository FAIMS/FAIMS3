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
import {transform, transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, RegularShape, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIsOnline} from '../../../utils/customHooks';
import {getCoordinates, useCurrentLocation} from '../../../utils/useLocation';
import {createCenterControl} from '../map/center-control';
import {VectorTileStore} from './tile-source';
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
  center?: [number, number]; // in EPSG:4326
  extent?: Extent; // note that the extent should be in EPSG:4326, not in the map projection
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

  // Use the custom hook for location which we only need if we don't have a center or extent
  // passed in props
  const {data: currentPosition, isLoading: loadingLocation} =
    useCurrentLocation();

  const positionLayerRef = useRef<VectorLayer>();
  const watchIdRef = useRef<string | null>(null);
  const liveLocationRef = useRef<Position | null>(null);

  // Determine map center based on props or current location
  // if we really can't work it out, use Sydney
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
      return getCoordinates(liveLocationRef?.current ?? undefined);
    } else {
      // try to get current location
      if (!loadingLocation && currentPosition) {
        return getCoordinates(currentPosition);
      } else {
        // default to Sydney
        return [151.2093, -33.8688];
      }
    }
  }, [props.center, props.extent]);

  /**
   * Initializes the map instance with base tile layers and zoom controls.
   * Adds the live cursor layer and sets up GPS tracking.
   *
   * @param element The HTML element to attach the map to
   * @returns The initialized OpenLayers Map instance
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
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}, // maximum age to avoid using cached position of the user.
      (position, err) => {
        if (err) {
          console.warn('Geolocation error:', err.message || err);
          return;
        }
        if (position) {
          liveLocationRef.current = position;
          liveCursor.updateCursorLocation(position);
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
          console.warn('Failed to clear GPS watch on unmount:', error)
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
        map.addControl(createCenterControl(map.getView(), centerMap));

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

  return (
    <>
      <Grid container spacing={2}>
        <Box sx={{height: '100%', width: '100%', minHeight: '600px'}}>
          <Box
            ref={refCallback} // will create the map
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
        </Box>
      </Grid>
    </>
  );
};
