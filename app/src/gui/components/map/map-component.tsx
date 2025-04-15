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
 * Description:
 *   Display a map
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
import {Circle, Fill, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useIsOnline} from '../../../utils/customHooks';
import {getCoordinates, useCurrentLocation} from '../../../utils/useLocation';
import {createCenterControl} from '../map/center-control';
import {VectorTileStore} from './tile-source';

const defaultMapProjection = 'EPSG:3857';
const MAX_ZOOM = 20;
const MIN_ZOOM = 12;

// fake gps flag for browser testing: window.__USE_FAKE_GPS__ = true; @TODO: ranisa remove later.
declare global {
  interface Window {
    __USE_FAKE_GPS__?: boolean;
  }
}

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

  /**
   * Create the OpenLayers map element
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
   * Add a marker to the map at the current location
   *
   * @param theMap the map element
   */
  const addCurrentLocationMarker = (theMap: Map) => {
    const source = new VectorSource();
    const geoJson = new GeoJSON();

    const stroke = new Stroke({color: '#e2ebef', width: 2});
    const layer = new VectorLayer({
      source: source,
      style: new Style({
        image: new Circle({
          radius: 10,
          fill: new Fill({color: '#465ddf90'}),
          stroke: stroke,
        }),
      }),
    });

    // only do this if we have a real map_center
    if (mapCenter) {
      const centerFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: mapCenter,
        },
      };

      // there is only one feature but readFeature return type is odd and readFeatures works for singletons
      const theFeatures = geoJson.readFeatures(centerFeature, {
        dataProjection: 'EPSG:4326',
        featureProjection: theMap.getView().getProjection(),
      });
      source.addFeature(theFeatures[0]);
      theMap.addLayer(layer);
    }
  };

  // when we have a location and a map, add the 'here' marker to the map
  useEffect(() => {
    if (!loadingLocation && map && mapCenter) {
      addCurrentLocationMarker(map);
      if (mapCenter) {
        const center = transform(mapCenter, 'EPSG:4326', defaultMapProjection);
        // add the 'here' button to go to the current location
        map.addControl(createCenterControl(map.getView(), center));

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
          </Box>
        )}
      </Grid>
    </>
  );
};
