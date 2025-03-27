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

import {Geolocation} from '@capacitor/geolocation';
import {Box, Grid} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {View} from 'ol';
import {Zoom} from 'ol/control';
import GeoJSON, {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {RegularShape, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {createCenterControl} from '../map/center-control';
import {VectorTileStore} from './tile-source';
import {useIsOnline} from '../../../utils/customHooks';

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
  zoom?: number;
}

export const MapComponent = (props: MapComponentProps) => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState(props.zoom || MIN_ZOOM); // Default zoom level
  const [attribution, setAttribution] = useState<string | null>(null);

  const {isOnline} = useIsOnline();

  const tileStore = useMemo(() => new VectorTileStore(), []);

  const {data: mapCenter, isLoading: loadingLocation} = useQuery({
    queryKey: ['current_location'],
    queryFn: async (): Promise<[number, number]> => {
      // if we are passed a center location use that, otherwise get the current location
      if (props.center) {
        return props.center;
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      return [position.coords.longitude, position.coords.latitude];
    },
  });

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
      console.log('zoom', z);
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

    const stroke = new Stroke({color: 'black', width: 2});
    const layer = new VectorLayer({
      source: source,
      style: new Style({
        image: new RegularShape({
          stroke: stroke,
          points: 4,
          radius: 10,
          radius2: 0,
          angle: 0,
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
    if (!loadingLocation && map) {
      addCurrentLocationMarker(map);
      if (mapCenter) {
        const center = transform(mapCenter, 'EPSG:4326', defaultMapProjection);
        // add the 'here' button to go to the current location
        map.addControl(createCenterControl(map.getView(), center));
        map.getView().setCenter(center);
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
