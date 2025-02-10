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
 * Filename: overview_map.tsx
 * Description:
 *   Display an overview map of the records in the notebook.
 */

import {Geolocation} from '@capacitor/geolocation';
import {
  getMetadataForAllRecords,
  ProjectID,
  ProjectUIModel,
} from '@faims3/data-model';
import {Box, Popover} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {View} from 'ol';
import {Zoom} from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, RegularShape, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import {createCenterControl} from '../map/center-control';
import {ImageTileStore} from '../map/tile-source';

interface OverviewMapProps {
  uiSpec: ProjectUIModel;
  project_id: ProjectID;
}

interface FeatureProps {
  name: string;
  record_id: string;
  revision_id: string;
}

const defaultMapProjection = 'EPSG:3857';

/**
 * Create an overview map of the records in the notebook.
 *
 * @param props {uiSpec, project_id}
 */
export const OverviewMap = (props: OverviewMapProps) => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selectedFeature, setSelectedFeature] = useState<FeatureProps | null>(
    null
  );
  const activeUser = useAppSelector(selectActiveUser);
  const [zoomLevel, setZoomLevel] = useState(12); // Default zoom level
  const tileStore = useMemo(() => new ImageTileStore(), []);

  /**
   * Get the names of all GIS fields in this UI Specification
   * @param uiSpec UI specification for the project
   * @returns
   */
  const getGISFields = () => {
    const fields = Object.getOwnPropertyNames(props.uiSpec.fields);
    return fields.filter(
      (field: string) =>
        props.uiSpec.fields[field]['component-name'] === 'MapFormField' ||
        props.uiSpec.fields[field]['component-name'] === 'TakePoint'
    );
  };
  const gisFields = useMemo(getGISFields, [props.uiSpec]);

  /**
   * Extract all of the features from the records in the notebook that
   * we will display on the map.  To be used in the useQuery hook below.
   *
   * @returns a FeatureProps object containing all of the features in the record
   */
  const getFeatures = async () => {
    const f: FeatureProps[] = [];
    if (gisFields.length > 0) {
      const records = await getMetadataForAllRecords(
        // TODO what do we do if no active user?
        activeUser!.parsedToken,
        props.project_id,
        true
      );
      if (records) {
        records.forEach(record => {
          if (record.data) {
            gisFields.forEach((field: string) => {
              // two options here, if it's a TakePoint field we'll have a single feature
              // if it's a MapFormField we'll have an object with multiple features
              if (record.data?.[field] && record.data[field].type) {
                if (record.data[field].type === 'FeatureCollection') {
                  record.data[field].features.forEach((feature: any) => {
                    // add properties to the feature for display
                    feature.properties = {
                      name: record.hrid,
                      record_id: record.record_id,
                      revision_id: record.revision_id,
                    };
                    f.push(feature);
                  });
                } else {
                  f.push({
                    ...record.data[field],
                    properties: {
                      name: record.hrid,
                      record_id: record.record_id,
                      revision_id: record.revision_id,
                    },
                  });
                }
              }
            });
          }
        });
      }
    }
    return {
      type: 'FeatureCollection',
      features: f,
    };
  };

  const {data: features, isLoading: loadingFeatures} = useQuery({
    queryKey: ['records', props.project_id],
    queryFn: getFeatures,
  });

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>();
  mapRef.current = map;

  const {data: map_center, isLoading: loadingLocation} = useQuery({
    queryKey: ['current_location'],
    queryFn: async (): Promise<[number, number]> => {
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
    const tileLayer = tileStore.getTileLayer();
    const view = new View({
      projection: defaultMapProjection,
      zoom: zoomLevel,
    });

    const theMap = new Map({
      target: element,
      layers: [tileLayer],
      view: view,
      controls: [new Zoom()],
    });

    theMap.on('click', evt => {
      const feature = theMap.forEachFeatureAtPixel(evt.pixel, feature => {
        return feature.getProperties();
      });
      if (!feature) {
        return;
      }
      setSelectedFeature(feature as FeatureProps);
    });

    // Add this in the createMap function after creating theMap
    theMap.getView().on('change:resolution', () => {
      const z = theMap.getView().getZoom();
      //console.log('Resolution changed', z);
      if (z) setZoomLevel(z);
    });

    return theMap;
  }, []);

  /**
   * Add a marker to the map at the current location
   *
   * @param map the map element
   */
  const addCurrentLocationMarker = (map: Map) => {
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
    if (map_center) {
      const centerFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: map_center,
        },
      };

      // there is only one feature but readFeature return type is odd and readFeatures works for singletons
      const theFeatures = geoJson.readFeatures(centerFeature, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      });
      source.addFeature(theFeatures[0]);
      map.addLayer(layer);
    }
  };

  /**
   * Add the features to the map and set the map view to
   * encompass the features.
   *
   * @param map OpenLayers map object
   */
  const addFeaturesToMap = (map: Map) => {
    console.log('Adding features to map');
    const source = new VectorSource();
    const geoJson = new GeoJSON();

    const layer = new VectorLayer({
      source: source,
      style: new Style({
        stroke: new Stroke({
          color: '#FF0000',
          width: 4,
        }),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({color: '#FF0000'}),
        }),
      }),
    });

    if (features && features.features.length > 0) {
      const parsedFeatures = geoJson.readFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      });
      source.addFeatures(parsedFeatures);

      // set the view so that we can see the features
      // but don't zoom too much
      const extent = source.getExtent();
      // don't fit if the extent is infinite because it crashes
      if (!extent.includes(Infinity)) {
        map.getView().fit(extent, {padding: [100, 100, 100, 100], maxZoom: 12});
      }
    }

    map.addLayer(layer);
  };

  // when we have a location and a map, add the 'here' marker to the map
  if (!loadingLocation && map) {
    addCurrentLocationMarker(map);
    if (map_center) {
      const center = transform(map_center, 'EPSG:4326', defaultMapProjection);
      // add the 'here' button to go to the current location
      map.addControl(createCenterControl(map.getView(), center));
    }
  }

  useEffect(() => {
    // when we have features, add them to the map
    if (!loadingFeatures && map) {
      addFeaturesToMap(map);
    }
  }, [loadingFeatures, map]);

  // callback to add the map to the DOM
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;

      if (!map) {
        // First render - create new map
        console.log('creating map');
        createMap(element).then((theMap: Map) => {
          setMap(theMap);
        });
      } else if (element !== map.getTarget()) {
        // Subsequent renders - only set target if it has changed
        console.log('setting target');
        map.setTarget(element);
      }
    },
    [map, createMap]
  );

  const handlePopoverClose = () => {
    setSelectedFeature(null);
  };

  if (gisFields.length === 0) {
    return <Box>No GIS fields found.</Box>;
  } else if (features?.features.length === 0) {
    return <Box>No records with locations found.</Box>;
  } else if (loadingFeatures) {
    return <Box>Loading...</Box>;
  } else
    return (
      <>
        <Box
          ref={refCallback}
          sx={{
            height: 600,
            width: '100%',
          }}
        />
        <Popover
          open={!!selectedFeature}
          onClose={handlePopoverClose}
          anchorEl={mapRef.current?.getTargetElement()}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          {selectedFeature && (
            <Box sx={{padding: '50px'}}>
              <Link
                to={ROUTES.getRecordRoute(
                  props.project_id || 'dummy',
                  selectedFeature.record_id,
                  selectedFeature.revision_id
                )}
              >
                {selectedFeature.name}
              </Link>
            </Box>
          )}
        </Popover>
      </>
    );
};
