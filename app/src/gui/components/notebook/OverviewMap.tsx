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
  CompiledNotebookUiSpec,
  DataEngine,
  getOverviewMapTypes,
  MinimalRecordMetadata,
  NotebookUiSpec,
  ProjectID,
} from '@faims3/data-model';
import {MapComponent} from '@faims3/forms';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Popover,
  Typography,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Extent} from 'ol/extent';
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
import {formatTimestamp} from '../../../utils/formUtilities';
import {
  useRecordFeatures,
  type RecordFeatureCollection,
  type RecordFeatureProps,
} from './recordFeatures';

interface OverviewMapProps {
  /** Notebook UI spec (compiled fields/views + settings / schemaVersion for {@link DataEngine}). */
  uiSpec: CompiledNotebookUiSpec;
  project_id: ProjectID;
  serverId: string;
  records: {allRecords: MinimalRecordMetadata[]};
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

/** Query key prefix for overview map record hydration (data engine) */
const OVERVIEW_MAP_RECORD_KEY_PREFIX = 'overview-map-record';

/**
 * Popover content for the currently selected map feature. Hydrates the record
 * via the data engine's hydration module (React Query) and shows key metadata.
 */
interface SelectedRecordPopoverContentProps {
  feature: RecordFeatureProps;
  project_id: ProjectID;
  serverId: string;
  uiSpec: NotebookUiSpec;
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
    <Card variant="outlined" sx={{minWidth: 260, maxWidth: 320}}>
      <CardContent sx={{'&:last-child': {pb: 2}}}>
        <Typography
          variant="subtitle1"
          gutterBottom
          title={hydrated.hrid}
          sx={{
            fontWeight: 600,
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
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{display: 'block'}}
        >
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

/**
 * Create an overview map of the records in the notebook.
 */
export const OverviewMap = (props: OverviewMapProps) => {
  const {uiSpec, project_id, serverId, records} = props;
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selectedFeature, setSelectedFeature] =
    useState<RecordFeatureProps | null>(null);
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
  // Ref so the vector layer style function can read current selection and highlight it
  const selectedFeatureRef = useRef<RecordFeatureProps | null>(null);

  const mapConfig = getMapConfig();

  // Only forms configured to display on the overview map: this tab's own scope
  const overviewMapTypes = useMemo(() => getOverviewMapTypes(uiSpec), [uiSpec]);

  // The records' GIS features, plus the hook's memoized data engine and GIS
  // field list
  const {
    data: featureCollection,
    isLoading,
    isError,
    error,
    dataEngine,
    gisFields,
  } = useRecordFeatures({
    projectId: project_id,
    uiSpec,
    records: records.allRecords,
    recordTypes: overviewMapTypes,
  });

  /**
   * Build a map from form_id to color for styling features by form type.
   */
  const getFormIdToColor = useCallback(
    (features: RecordFeatureCollection): Record<string, string> => {
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
    (theMap: Map, features: RecordFeatureCollection) => {
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
            return props as RecordFeatureProps;
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        height: {
          xs: 'clamp(320px, 55vh, 600px)',
          sm: 'clamp(400px, 60vh, 600px)',
        },
        mt: {xs: 1, sm: 2.5},
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
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        marginThreshold={24}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 'min(320px, calc(100vw - 48px))',
              minWidth: 0,
            },
          },
        }}
      >
        {selectedFeature && (
          <Box sx={{p: 1.5}}>
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
    </Box>
  );
};
