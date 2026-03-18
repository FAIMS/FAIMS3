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
  MinimalRecordMetadata,
  ProjectID,
  ProjectUIModel,
} from '@faims3/data-model';
import {GeoJSONFeatureOrCollectionSchema, MapComponent} from '@faims3/forms';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Popover,
  Typography,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Control} from 'ol/control';
import type {EventsKey} from 'ol/events';
import {Extent} from 'ol/extent';
import {unByKey} from 'ol/Observable';
import {FeatureLike} from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {localGetDataDb} from '../../../utils/database';
import {formatTimestamp} from '../../../utils/formUtilities';

interface OverviewMapProps {
  uiSpec: ProjectUIModel;
  project_id: ProjectID;
  serverId: string;
  records: {allRecords: MinimalRecordMetadata[]};
}

interface FeatureProps {
  name: string;
  record_id: string;
  revision_id: string;
  form_id: string;
}

/** Distinct colors for form types on the map */
const FORM_TYPE_COLORS = [
  '#2171b5', // blue
  '#cb181d', // red
  '#238b45', // green
  '#6a51a3', // purple
  '#d94801', // orange
  '#0c2c84', // dark blue
  '#e7298a', // magenta
  '#006d2c', // dark green
  '#8856a7', // violet
  '#dd3497', // pink
];

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

/** Query key prefix for overview map record hydration (data engine) */
const OVERVIEW_MAP_RECORD_KEY_PREFIX = 'overview-map-record';

/**
 * Popover content for the currently selected map feature. Hydrates the record
 * via the data engine's hydration module (React Query) and shows key metadata.
 */
interface SelectedRecordPopoverContentProps {
  feature: FeatureProps;
  project_id: ProjectID;
  serverId: string;
  uiSpec: ProjectUIModel;
  dataEngine: DataEngine;
}

/** Short time which is used for various checks in the file, including guarding
 * the popover button, and for tap detection. */
const SHORT_WAIT_CONSTANT = 400;

const SelectedRecordPopoverContent = ({
  feature,
  project_id,
  serverId,
  uiSpec,
  dataEngine,
}: SelectedRecordPopoverContentProps) => {
  // Prevent the same tap that opened the popover from immediately activating the
  // view record button (which would navigate away).
  const [buttonInteractionAllowed, setButtonInteractionAllowed] =
    useState(false);
  useEffect(() => {
    const id = setTimeout(
      () => setButtonInteractionAllowed(true),
      SHORT_WAIT_CONSTANT
    );
    return () => clearTimeout(id);
  }, []);

  const {
    data: hydrated,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      OVERVIEW_MAP_RECORD_KEY_PREFIX,
      project_id,
      feature.record_id,
      feature.revision_id,
    ],
    queryFn: () =>
      dataEngine.hydrated.getHydratedRecord({
        recordId: feature.record_id,
        revisionId: feature.revision_id,
      }),
    enabled: !!feature.record_id,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Box
        sx={{p: 2, minWidth: 220, display: 'flex', justifyContent: 'center'}}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{p: 2, minWidth: 220}}>
        <Alert severity="error" sx={{mb: 1}}>
          {error instanceof Error ? error.message : 'Failed to load record'}
        </Alert>
        <Button
          component={RouterLink}
          to={ROUTES.getViewRecordRoute({
            serverId,
            projectId: project_id,
            recordId: feature.record_id,
          })}
          size="small"
          variant="outlined"
          onClick={e => {
            if (!buttonInteractionAllowed) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          Open record
        </Button>
      </Box>
    );
  }

  if (!hydrated) {
    return null;
  }

  const formLabel =
    uiSpec.viewsets?.[hydrated.record.formId]?.label ?? hydrated.record.formId;
  const createdDate =
    formatTimestamp(new Date(hydrated.record.created).getTime()) ||
    hydrated.record.created;

  const viewUrl = ROUTES.getViewRecordRoute({
    serverId,
    projectId: project_id,
    recordId: feature.record_id,
    revisionId: feature.revision_id,
  });

  return (
    <Card
      variant="outlined"
      sx={{
        minWidth: 'min(260px, 100%)',
        maxWidth: 'min(320px, 100%)',
      }}
    >
      <CardContent sx={{'&:last-child': {pb: 2}}}>
        <Typography
          variant="subtitle1"
          fontWeight="600"
          gutterBottom
          title={hydrated.hrid}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hydrated.hrid}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{mb: 0.5}}>
          {formLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Created {createdDate}
          {hydrated.record.createdBy ? ` by ${hydrated.record.createdBy}` : ''}
        </Typography>
        <Button
          component={RouterLink}
          to={viewUrl}
          variant="contained"
          size="small"
          sx={{mt: 1.5}}
          onClick={e => {
            if (!buttonInteractionAllowed) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          View record
        </Button>
      </CardContent>
    </Card>
  );
};

/** Inline SVG: north-facing arrow (prominent) and subtle south-facing arrow, Google Maps style */
const COMPASS_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M12 4 L8 14 L16 14 Z"/><path fill="white" fill-opacity="0.4" d="M12 20 L10 16 L14 16 Z"/></svg>';

/** Rotation below this (radians) is treated as north-up; compass hidden at 0° (Google Maps style). */
const ROTATION_NEAR_ZERO_THRESHOLD = 1e-6;

/**
 * Creates a control button that resets the map rotation to north (rotation 0).
 * The compass is hidden when rotation is 0° (Google Maps style) and shown when the map is rotated.
 */
const createResetNorthControl = (map: Map): Control => {
  const button = document.createElement('button');
  button.className = 'ol-custom-control-button';
  button.type = 'button';
  button.title = 'Reset map to north';
  button.innerHTML = COMPASS_ICON_SVG;

  button.addEventListener('click', () => {
    const view = map.getView();
    const currentRotation = view.getRotation();
    if (currentRotation !== undefined && Math.abs(currentRotation) >= ROTATION_NEAR_ZERO_THRESHOLD) {
      view.animate({rotation: 0, duration: 200});
    }
  });

  const element = document.createElement('div');
  element.className = 'ol-custom-control ol-compass-box';
  element.appendChild(button);

  const control = new Control({element});
  let rotationKey: EventsKey | undefined;

  const updateVisibility = (rotation: number) => {
    const nearZero =
      rotation === undefined ||
      Math.abs(rotation) < ROTATION_NEAR_ZERO_THRESHOLD;
    element.style.display = nearZero ? 'none' : '';
  };

  const originalSetMap = control.setMap.bind(control);
  control.setMap = (targetMap: Map | null) => {
    if (rotationKey !== undefined) {
      unByKey(rotationKey);
      rotationKey = undefined;
    }
    originalSetMap(targetMap);
    if (targetMap) {
      const view = targetMap.getView();
      updateVisibility(view.getRotation() ?? 0);
      rotationKey = view.on('change:rotation', () => {
        updateVisibility(view.getRotation() ?? 0);
      });
    }
  };

  return control;
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
  /** Popover anchor in viewport coordinates (set when opening so position is reliable on first open) */
  const [popoverAnchorPosition, setPopoverAnchorPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [featuresExtent, setFeaturesExtent] = useState<Extent | undefined>();

  // Keep ref in sync so vector layer style can highlight selected feature
  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
    const layer = vectorLayerRef.current;
    if (layer) {
      layer.changed();
    }
  }, [selectedFeature]);

  // Track if we've added the layer to prevent duplicates
  const layerAddedRef = useRef(false);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  // When the popover was opened (timestamp). Used to ignore immediate backdropClick from the same touch.
  const popoverOpenedAtRef = useRef<number>(0);
  const resetNorthControlRef = useRef<Control | null>(null);
  // Ref so the vector layer style function can read current selection and highlight it
  const selectedFeatureRef = useRef<FeatureProps | null>(null);

  const mapConfig = getMapConfig();

  // Add compass (reset to north) control when map is ready
  useEffect(() => {
    if (!map) return;
    const control = createResetNorthControl(map);
    map.addControl(control);
    resetNorthControlRef.current = control;
    return () => {
      if (resetNorthControlRef.current) {
        map.removeControl(resetNorthControlRef.current);
        resetNorthControlRef.current = null;
      }
    };
  }, [map]);

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
      record: MinimalRecordMetadata,
      fields: string[]
    ): Promise<GeoJSONFeature[]> => {
      const features: GeoJSONFeature[] = [];

      // TODO this is not optimal for efficiency
      const revision = await dataEngine.core.getRevision(record.revisionId);

      await Promise.all(
        fields.map(async field => {
          try {
            const avpId = revision.avps[field];
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
              name: record.recordId,
              record_id: record.recordId,
              revision_id: record.revisionId,
              form_id: record.type,
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
              `Failed to extract GIS data for record ${record.recordId}, field ${field}:`,
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
      records.allRecords?.map(r => `${r.recordId}:${r.revisionId}`).join(','),
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
   * Build a map from form_id to color for styling features by form type.
   */
  const getFormIdToColor = useCallback(
    (features: FeatureCollection): Record<string, string> => {
      const formIds = [
        ...new Set(
          features.features
            .map(f => (f.properties?.form_id as string) ?? '')
            .filter(Boolean)
        ),
      ].sort();
      const map: Record<string, string> = {};
      formIds.forEach((id, i) => {
        map[id] = FORM_TYPE_COLORS[i % FORM_TYPE_COLORS.length];
      });
      return map;
    },
    []
  );

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
      const formIdToColor = getFormIdToColor(features);

      const layer = new VectorLayer({
        source: source,
        style: (olFeature: FeatureLike) => {
          const formId = (olFeature.get('form_id') as string) ?? '';
          const color = formIdToColor[formId] ?? FORM_TYPE_COLORS[0];
          const recordId = olFeature.get('record_id') as string | undefined;
          const revisionId = olFeature.get('revision_id') as string | undefined;
          const selected = selectedFeatureRef.current;
          const isSelected =
            selected &&
            recordId === selected.record_id &&
            revisionId === selected.revision_id;

          if (isSelected) {
            return new Style({
              stroke: new Stroke({
                color: '#ffffff',
                width: 5,
              }),
              fill: new Fill({color: color + 'cc'}),
              image: new CircleStyle({
                radius: 10,
                fill: new Fill({color}),
                stroke: new Stroke({color: '#ffffff', width: 4}),
              }),
            });
          }

          return new Style({
            stroke: new Stroke({
              color,
              width: 4,
            }),
            fill: new Fill({color: color + '80'}), // 50% opacity for polygons
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({color}),
              stroke: new Stroke({color: '#fff', width: 2}),
            }),
          });
        },
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
    [getFormIdToColor]
  );

  // Effect to add features to map when both are ready
  useEffect(() => {
    if (!map || !featureCollection || featureCollection.features.length === 0) {
      return;
    }

    addFeaturesToMap(map, featureCollection);

    // Resolve feature at pixel and open popover if found
    const selectFeatureAtPixel = (pixel: number[]) => {
      const feature = map.forEachFeatureAtPixel(
        pixel,
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
        popoverOpenedAtRef.current = Date.now();
        // Anchor popover to click position so it's reliable on first open (map container
        // rect can be wrong before layout has settled)
        const mapEl = map.getTargetElement();
        const rect = mapEl.getBoundingClientRect();
        setPopoverAnchorPosition({
          left: rect.left + pixel[0],
          top: rect.top + pixel[1],
        });
        setSelectedFeature(feature);
      }
    };

    // Use pointerdown/pointerup on the map element for tap detection so taps
    // work on touch devices (Android). Relying only on map 'click' fails on many
    // Android browsers because the map's pan interaction consumes the gesture, so
    // click often doesn't fire or only fires on long-press. A quick
    // pointerdown→pointerup with little movement is treated as a tap.
    const TAP_MAX_MOVEMENT_PX = 15;

    let pointerDown: {pixel: number[]; time: number; id: number} | null = null;

    const handlePointerDown = (evt: PointerEvent) => {
      const pixel = map.getEventPixel(evt).slice();
      pointerDown = {
        pixel,
        time: Date.now(),
        id: evt.pointerId,
      };
    };

    const handlePointerUp = (evt: PointerEvent) => {
      const upPixel = map.getEventPixel(evt);
      if (!pointerDown || pointerDown.id !== evt.pointerId) {
        return;
      }
      const dt = Date.now() - pointerDown.time;
      const dx = Math.abs(upPixel[0] - pointerDown.pixel[0]);
      const dy = Math.abs(upPixel[1] - pointerDown.pixel[1]);
      const withinTime = dt <= SHORT_WAIT_CONSTANT;
      const withinMove = dx <= TAP_MAX_MOVEMENT_PX && dy <= TAP_MAX_MOVEMENT_PX;
      const isTap = withinTime && withinMove;
      pointerDown = null;
      if (isTap) {
        selectFeatureAtPixel(upPixel);
      }
    };

    const mapEl = map.getTargetElement();
    mapEl.addEventListener('pointerdown', handlePointerDown);
    mapEl.addEventListener('pointerup', handlePointerUp);

    // Cleanup
    return () => {
      mapEl.removeEventListener('pointerdown', handlePointerDown);
      mapEl.removeEventListener('pointerup', handlePointerUp);
      if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }
      layerAddedRef.current = false;
    };
  }, [map, featureCollection, addFeaturesToMap]);

  const handlePopoverClose = (
    _event: object,
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // On touch, the same tap that opens the popover is often reported as a
    // backdropClick, closing it immediately. Ignore backdropClick for a short
    // window after opening so the popover stays open.
    if (reason === 'backdropClick') {
      const elapsed = Date.now() - popoverOpenedAtRef.current;
      if (elapsed < SHORT_WAIT_CONSTANT) return;
    }
    setSelectedFeature(null);
    setPopoverAnchorPosition(null);
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
        open={!!selectedFeature && !!popoverAnchorPosition}
        onClose={handlePopoverClose}
        anchorReference="anchorPosition"
        anchorPosition={popoverAnchorPosition ?? {left: 0, top: 0}}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              mx: 1.5,
              maxWidth: 'calc(100vw - 24px)',
            },
          },
        }}
      >
        {selectedFeature && (
          <Box sx={{p: 1.5, maxWidth: '100%', minWidth: 0}}>
            <SelectedRecordPopoverContent
              feature={selectedFeature}
              project_id={project_id}
              serverId={serverId}
              uiSpec={uiSpec}
              dataEngine={dataEngine}
            />
          </Box>
        )}
      </Popover>
    </Grid>
  );
};
