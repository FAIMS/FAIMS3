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

import {ProjectID, ProjectUIModel, RecordMetadata} from '@faims3/data-model';
import {Box, Grid, Popover} from '@mui/material';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {MapComponent} from '../map/map-component';
import {Extent} from 'ol/extent';
import {transformExtent} from 'ol/proj';

interface OverviewMapProps {
  uiSpec: ProjectUIModel;
  project_id: ProjectID;
  serverId: string;
  records: {allRecords: RecordMetadata[]};
}

interface FeatureProps {
  name: string;
  record_id: string;
  revision_id: string;
}

/**
 * Create an overview map of the records in the notebook.
 * Wrapped in memo to prevent re-rendering when nothing has changed.
 *
 * @param props {uiSpec, project_id}
 */
export const OverviewMap = (props: OverviewMapProps) => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selectedFeature, setSelectedFeature] = useState<FeatureProps | null>(
    null
  );
  const [featuresExtent, setFeaturesExtent] = useState<Extent | undefined>();

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
  const getFeatures = (records: any[], gisFields: string[]) => {
    const f: FeatureProps[] = [];
    if (gisFields.length > 0) {
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

  const features = useMemo(() => {
    return getFeatures(props.records.allRecords, gisFields);
  }, [props.records.allRecords, gisFields]);

  /**
   * Add the features to the map and set the map view to
   * encompass the features.
   *
   * @param theMap OpenLayers map object
   */
  const addFeaturesToMap = (theMap: Map) => {
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
        featureProjection: theMap.getView().getProjection(),
      });
      source.addFeatures(parsedFeatures);

      // set the view so that we can see the features
      // but don't zoom too much
      // this extent will be in the map projection, so need to transform to EPSG:4326
      const extent = transformExtent(
        source.getExtent(),
        theMap.getView().getProjection(),
        'EPSG:4326'
      );
      // don't set if the extent is infinite because it crashes
      if (!extent.includes(Infinity)) {
        setFeaturesExtent(extent);
      }
    }

    theMap.addLayer(layer);
  };

  useEffect(() => {
    // when we have features, add them to the map
    if (features && map) {
      addFeaturesToMap(map);

      // add click handler for map features
      map.on('click', evt => {
        const feature = map.forEachFeatureAtPixel(
          evt.pixel,
          feature => {
            // only return features that relate to records (not general map features)
            if (feature.getProperties().record_id)
              return feature.getProperties();
          },
          {
            hitTolerance: 10,
          }
        );
        if (!feature) {
          return;
        }
        setSelectedFeature(feature as FeatureProps);
      });
    }
  }, [features, map]);

  const handlePopoverClose = () => {
    setSelectedFeature(null);
  };

  if (gisFields.length === 0) {
    return <Box>No GIS fields found.</Box>;
  } else if (features?.features.length === 0) {
    return <Box>No records with locations found.</Box>;
  } else if (features === undefined) {
    return <Box>Loading...</Box>;
  } else
    return (
      <Grid
        container
        spacing={2}
        sx={{width: '90vw', marginTop: '20px', marginLeft: '20px'}}
      >
        <MapComponent parentSetMap={setMap} extent={featuresExtent} />
        <Popover
          open={!!selectedFeature}
          onClose={handlePopoverClose}
          anchorEl={map?.getTargetElement()}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          {selectedFeature && (
            <Box sx={{padding: '50px'}}>
              <Link
                to={ROUTES.getExistingRecordRoute({
                  serverId: props.serverId,
                  projectId: props.project_id,
                  recordId: selectedFeature.record_id
                })}
              >
                {selectedFeature.name}
              </Link>
            </Box>
          )}
        </Popover>
      </Grid>
    );
};
