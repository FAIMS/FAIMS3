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

import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ProjectID,
  ProjectUIModel,
  UnhydratedRecord,
} from '@faims3/data-model';
import {GeoJSONFeatureOrCollectionSchema, MapComponent} from '@faims3/forms';
import {Alert, Box, CircularProgress, Grid, Popover} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Extent} from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {localGetDataDb} from '../../../utils/database';

interface OverviewMapProps {
  uiSpec: ProjectUIModel;
  project_id: ProjectID;
  serverId: string;
  records: {allRecords: UnhydratedRecord[]};
}

interface FeatureProps {
  name: string;
  record_id: string;
  revision_id: string;
}

interface GeoJSONFeature {
  type: string;
  geometry?: unknown;
  properties?: FeatureProps;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Get the names of all GIS fields in a UI Specification
 */
const getGISFields = (uiSpec: ProjectUIModel): string[] => {
  const fields = Object.getOwnPropertyNames(uiSpec.fields);
  return fields.filter(
    (field: string) =>
      uiSpec.fields[field]['component-name'] === 'MapFormField' ||
      uiSpec.fields[field]['component-name'] === 'TakePoint'
  );
};

/**
 * Create an overview map of the records in the notebook.
 */
export const OverviewMap = (props: OverviewMapProps) => {
  const {uiSpec, project_id, serverId, records} = props;

  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selectedFeature, setSelectedFeature] = useState<FeatureProps | null>(
    null
  );
  const [featuresExtent, setFeaturesExtent] = useState<Extent | undefined>();

  // Track if we've added the layer to prevent duplicates
  const layerAddedRef = useRef(false);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const mapConfig = getMapConfig();

  // Memoize the data engine to prevent recreation on every render
  const dataEngine = useMemo(() => {
    const dataDb = localGetDataDb(project_id);
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec: uiSpec,
    });
  }, [project_id, uiSpec]);

  // Memoize GIS fields
  const gisFields = useMemo(() => getGISFields(uiSpec), [uiSpec]);

  /**
   * Extract features from a single record for the given GIS fields
   */
  const extractFeaturesFromRecord = useCallback(
    async (
      record: UnhydratedRecord,
      fields: string[]
    ): Promise<GeoJSONFeature[]> => {
      const features: GeoJSONFeature[] = [];

      await Promise.all(
        fields.map(async field => {
          try {
            const avpId = record.avps[field];
            if (!avpId) return;

            const avpData = await dataEngine.core.getAvp(avpId);
            const dataRaw = avpData?.data;
            if (!dataRaw) return;

            const {data: geoJson, success} =
              GeoJSONFeatureOrCollectionSchema.safeParse(dataRaw);

            if (!success) {
              return;
            }

            const baseProperties: FeatureProps = {
              // TODO bring back HRID - or maybe only on records we click on?
              name: record.record_id,
              record_id: record.record_id,
              revision_id: record.revision_id,
            };

            if (geoJson.type === 'FeatureCollection') {
              // Handle FeatureCollection with multiple features
              geoJson.features?.forEach(feature => {
                if (feature && feature.geometry) {
                  features.push({
                    ...feature,
                    properties: baseProperties,
                  });
                }
              });
            } else if (geoJson.type === 'Feature') {
              // Handle single Feature or geometry object
              features.push({
                ...geoJson,
                properties: baseProperties,
              });
            }
          } catch (error) {
            // Log but don't fail - skip this field/record combination
            console.warn(
              `Failed to extract GIS data for record ${record.record_id}, field ${field}:`,
              error
            );
          }
        })
      );

      return features;
    },
    [dataEngine]
  );

  /**
   * Query function to fetch all features from all records
   */
  const fetchAllFeatures = useCallback(async (): Promise<FeatureCollection> => {
    if (gisFields.length === 0 || !records.allRecords?.length) {
      return {type: 'FeatureCollection', features: []};
    }

    // Process records in parallel with concurrency limit to avoid overwhelming the DB
    const BATCH_SIZE = 10;
    const allFeatures: GeoJSONFeature[] = [];

    for (let i = 0; i < records.allRecords.length; i += BATCH_SIZE) {
      const batch = records.allRecords.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(record => extractFeaturesFromRecord(record, gisFields))
      );
      allFeatures.push(...batchResults.flat());
    }

    return {
      type: 'FeatureCollection',
      features: allFeatures,
    };
  }, [gisFields, records.allRecords, extractFeaturesFromRecord]);

  // Use React Query to manage the async feature fetching
  const {
    data: featureCollection,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      'overview-map-features',
      project_id,
      records.allRecords?.map(r => `${r.record_id}:${r.revision_id}`).join(','),
      gisFields.join(','),
    ],
    queryFn: fetchAllFeatures,
    enabled: gisFields.length > 0 && records.allRecords?.length > 0,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  /**
   * Add the features to the map and set the map view to encompass the features.
   */
  const addFeaturesToMap = useCallback(
    (theMap: Map, features: FeatureCollection) => {
      // Remove existing layer if present
      if (vectorLayerRef.current) {
        theMap.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }

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

      if (features.features.length > 0) {
        try {
          const parsedFeatures = geoJson.readFeatures(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: theMap.getView().getProjection(),
          });
          source.addFeatures(parsedFeatures);

          // Calculate and set extent
          const sourceExtent = source.getExtent();
          if (sourceExtent && !sourceExtent.some(val => !isFinite(val))) {
            const extent = transformExtent(
              sourceExtent,
              theMap.getView().getProjection(),
              'EPSG:4326'
            );
            if (!extent.some(val => !isFinite(val))) {
              setFeaturesExtent(extent);
            }
          }
        } catch (error) {
          console.error('Failed to parse GeoJSON features:', error);
        }
      }

      theMap.addLayer(layer);
      vectorLayerRef.current = layer;
      layerAddedRef.current = true;
    },
    []
  );

  // Effect to add features to map when both are ready
  useEffect(() => {
    if (!map || !featureCollection || featureCollection.features.length === 0) {
      return;
    }

    addFeaturesToMap(map, featureCollection);

    // Click handler for map features
    const handleClick = (evt: {pixel: number[]}) => {
      const feature = map.forEachFeatureAtPixel(
        evt.pixel,
        olFeature => {
          const props = olFeature.getProperties();
          if (props.record_id) {
            return props as FeatureProps;
          }
          return undefined;
        },
        {hitTolerance: 10}
      );

      if (feature) {
        setSelectedFeature(feature);
      }
    };

    map.on('click', handleClick);

    // Cleanup
    return () => {
      map.un('click', handleClick);
      if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }
      layerAddedRef.current = false;
    };
  }, [map, featureCollection, addFeaturesToMap]);

  const handlePopoverClose = () => {
    setSelectedFeature(null);
  };

  // Render states
  if (gisFields.length === 0) {
    return (
      <Box sx={{p: 2}}>
        <Alert severity="info">
          No GIS fields found in this project's form definition.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
          gap: 2,
        }}
      >
        <CircularProgress size={24} />
        <span>Loading map data...</span>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{p: 2}}>
        <Alert severity="error">
          Failed to load map data:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  if (!featureCollection || featureCollection.features.length === 0) {
    return (
      <Box sx={{p: 2}}>
        <Alert severity="info">No records with location data found.</Alert>
      </Box>
    );
  }

  return (
    <Grid
      container
      spacing={2}
      sx={{
        height: '600px',
        width: '90vw',
        marginTop: '20px',
        marginLeft: '20px',
      }}
    >
      <MapComponent
        parentSetMap={setMap}
        extent={featuresExtent}
        config={mapConfig}
      />
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
              to={ROUTES.getEditRecordRoute({
                serverId: serverId,
                projectId: project_id,
                recordId: selectedFeature.record_id,
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
