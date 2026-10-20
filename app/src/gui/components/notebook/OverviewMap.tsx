// SPDX-License-Identifier: Apache-2.0

/*
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
  formatTimestamp,
} from '@faims3/data-model';
import {
  applyRecordFormLayerPaint,
  applyRecordFormLayerPatch,
  buildRecordFormLayers,
  contextualVectorStyle,
  defaultRecordFormLayerPrefs,
  formIdFromRecordFormLayerId,
  MapComponent,
  prefsFromRecordFormLayer,
  readRecordFormLayerPrefs,
  selectedVectorStyle,
  writeRecordFormLayerPrefs,
  type RecordFormLayerPatch,
} from '@faims3/forms';
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
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {useNotebookRoute} from '../../../context/notebookRoute';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {
  groupRecordFeaturesByForm,
  recordFeatureSyncKey,
  useRecordFeatures,
  type RecordFeatureProps,
} from './recordFeatures';

interface OverviewMapProps {
  /** Notebook UI spec (compiled fields/views + settings / schemaVersion for {@link DataEngine}). */
  uiSpec: CompiledNotebookUiSpec;
  project_id: ProjectID;
  records: {allRecords: MinimalRecordMetadata[]};
}

/** Query key prefix for overview map record hydration (data engine) */
const OVERVIEW_MAP_RECORD_KEY_PREFIX = 'overview-map-record';

/**
 * Popover content for the currently selected map feature. Hydrates the record
 * via the data engine's hydration module (React Query) and shows key metadata.
 */
interface SelectedRecordPopoverContentProps {
  feature: RecordFeatureProps;
  project_id: ProjectID;
  uiSpec: NotebookUiSpec;
  dataEngine: DataEngine;
}

/** Short time which is used for various checks in the file, including guarding
 * the popover button, and for tap detection. */
const SHORT_WAIT_CONSTANT = 400;

/**
 * True when two form-id → bbox maps have the same keys and extents.
 * Used to skip overview-map recentering when the record set did not move.
 */
function formExtentsEqual(
  left: Record<string, [number, number, number, number]>,
  right: Record<string, [number, number, number, number]>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(key => {
    const a = left[key];
    const b = right[key];
    return (
      !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
    );
  });
}

const SelectedRecordPopoverContent = ({
  feature,
  project_id,
  uiSpec,
  dataEngine,
}: SelectedRecordPopoverContentProps) => {
  const {notebook} = useNotebookRoute();

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
            ...notebook,
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
    ...notebook,
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
  const {uiSpec, project_id, records} = props;
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selectedFeature, setSelectedFeature] =
    useState<RecordFeatureProps | null>(null);
  /** Popover anchor in viewport coordinates (set when opening so position is reliable on first open) */
  const [popoverAnchorPosition, setPopoverAnchorPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [featuresExtent, setFeaturesExtent] = useState<Extent | undefined>();
  const [formExtents, setFormExtents] = useState<
    Record<string, [number, number, number, number]>
  >({});
  const [recordLayerPrefs, setRecordLayerPrefs] = useState(() =>
    readRecordFormLayerPrefs(project_id)
  );

  // When the popover was opened (timestamp). Used to ignore immediate backdropClick from the same touch.
  const popoverOpenedAtRef = useRef<number>(0);
  // Ref so the vector layer style function can read current selection and highlight it
  const selectedFeatureRef = useRef<RecordFeatureProps | null>(null);
  const layersByFormRef = useRef(
    new globalThis.Map<string, VectorLayer<VectorSource>>()
  );

  const mapConfig = getMapConfig();

  // Only forms configured to display on the overview map: this tab's own scope
  const overviewMapTypes = useMemo(() => getOverviewMapTypes(uiSpec), [uiSpec]);

  useEffect(() => {
    setRecordLayerPrefs(readRecordFormLayerPrefs(project_id));
  }, [project_id]);

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

  // Keep the last plotted collection while a newly synced record hydrates
  // (or one record fails) so this tree is not swapped for a spinner and
  // the OpenLayers view is not recreated.
  const lastCollectionRef = useRef(featureCollection);
  if (featureCollection?.features.length) {
    lastCollectionRef.current = featureCollection;
  }
  const plottedCollection = featureCollection?.features.length
    ? featureCollection
    : isLoading || isError
      ? lastCollectionRef.current
      : featureCollection;

  const recordFormDescriptors = useMemo(() => {
    if (!plottedCollection) {
      return [];
    }
    const formIds = [
      ...new Set(
        plottedCollection.features
          .map(feature => feature.properties.form_id)
          .filter(Boolean)
      ),
    ].sort();
    return formIds.map(formId => ({
      formId,
      name: uiSpec.viewsets[formId]?.label ?? formId,
      extent4326: formExtents[formId],
    }));
  }, [formExtents, plottedCollection, uiSpec]);

  const recordLayers = useMemo(
    () =>
      buildRecordFormLayers(
        recordFormDescriptors,
        recordLayerPrefs,
        overviewMapTypes
      ),
    [overviewMapTypes, recordFormDescriptors, recordLayerPrefs]
  );
  const recordLayersRef = useRef(recordLayers);
  recordLayersRef.current = recordLayers;

  const updateRecordLayer = useCallback(
    (id: string, patch: RecordFormLayerPatch) => {
      setRecordLayerPrefs(current => {
        const layer = recordLayersRef.current.find(item => item.id === id);
        const formId = layer?.formId ?? formIdFromRecordFormLayerId(id) ?? id;
        const fallback = layer
          ? prefsFromRecordFormLayer(layer)
          : defaultRecordFormLayerPrefs(formId, overviewMapTypes, 0);
        const next = applyRecordFormLayerPatch(current, id, patch, fallback);
        writeRecordFormLayerPrefs(project_id, next);
        return next;
      });
    },
    [overviewMapTypes, project_id]
  );

  const resetRecordLayers = useCallback(() => {
    writeRecordFormLayerPrefs(project_id, {});
    setRecordLayerPrefs({});
  }, [project_id]);

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
    for (const layer of layersByFormRef.current.values()) {
      layer.changed();
    }
  }, [selectedFeature]);

  const plottedCollectionRef = useRef(plottedCollection);
  plottedCollectionRef.current = plottedCollection;
  const plottedSyncKey = recordFeatureSyncKey(plottedCollection);

  useEffect(() => {
    const collection = plottedCollectionRef.current;
    if (!map || !collection || collection.features.length === 0) {
      return;
    }

    const grouped = groupRecordFeaturesByForm(collection);
    const formIds = new Set(grouped.keys());
    const geoJson = new GeoJSON();
    const nextExtents: Record<string, [number, number, number, number]> = {};
    let overallExtent: Extent | undefined;

    for (const [formId, layer] of layersByFormRef.current) {
      if (!formIds.has(formId)) {
        map.removeLayer(layer);
        layersByFormRef.current.delete(formId);
      }
    }

    for (const [formId, collection] of grouped) {
      let layer = layersByFormRef.current.get(formId);
      if (!layer) {
        layer = new VectorLayer({
          source: new VectorSource(),
          style: (olFeature: FeatureLike) => {
            const spec =
              recordLayersRef.current.find(item => item.formId === formId) ??
              defaultRecordFormLayerPrefs(formId, overviewMapTypes, 0);
            const recordId = olFeature.get('record_id') as string | undefined;
            const revisionId = olFeature.get('revision_id') as
              | string
              | undefined;
            const selected = selectedFeatureRef.current;
            const isSelected = Boolean(
              selected &&
              recordId === selected.record_id &&
              revisionId === selected.revision_id
            );
            return isSelected
              ? selectedVectorStyle(spec)(olFeature)
              : contextualVectorStyle(spec)(olFeature);
          },
        });
        map.addLayer(layer);
        layersByFormRef.current.set(formId, layer);
      }

      const source = layer.getSource();
      if (!source) {
        continue;
      }
      source.clear();
      try {
        const parsedFeatures = geoJson.readFeatures(collection, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);
        const sourceExtent = source.getExtent();
        if (
          sourceExtent &&
          !sourceExtent.some((val: number) => !isFinite(val))
        ) {
          const extent = transformExtent(
            sourceExtent,
            map.getView().getProjection(),
            'EPSG:4326'
          );
          if (!extent.some((val: number) => !isFinite(val))) {
            nextExtents[formId] = extent as [number, number, number, number];
            overallExtent = overallExtent
              ? [
                  Math.min(overallExtent[0], extent[0]),
                  Math.min(overallExtent[1], extent[1]),
                  Math.max(overallExtent[2], extent[2]),
                  Math.max(overallExtent[3], extent[3]),
                ]
              : extent;
          }
        }
      } catch (error) {
        console.error('Failed to parse GeoJSON features:', error);
      }

      const spec = recordLayersRef.current.find(item => item.formId === formId);
      if (spec) {
        applyRecordFormLayerPaint(layer, spec);
      }
    }

    setFormExtents(current =>
      formExtentsEqual(current, nextExtents) ? current : nextExtents
    );
    // Fit the view only the first time features exist. Later syncs refresh
    // the vector sources above; re-fitting here is what makes the map jump.
    if (overallExtent) {
      setFeaturesExtent(current => current ?? overallExtent);
    }
  }, [map, overviewMapTypes, plottedSyncKey]);

  useEffect(() => {
    return () => {
      if (!map) {
        return;
      }
      for (const layer of layersByFormRef.current.values()) {
        map.removeLayer(layer);
      }
      layersByFormRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    for (const spec of recordLayers) {
      const layer = layersByFormRef.current.get(spec.formId);
      if (layer) {
        applyRecordFormLayerPaint(layer, spec);
        layer.changed();
      }
    }
  }, [recordLayers]);

  useEffect(() => {
    if (!map) {
      return;
    }

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
    return () => {
      mapEl.removeEventListener('pointerdown', handlePointerDown);
      mapEl.removeEventListener('pointerup', handlePointerUp);
    };
  }, [map]);

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

  if (!plottedCollection || plottedCollection.features.length === 0) {
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
        autoFlyToCurrentLocation={false}
        enableFullscreen
        recordLayers={recordLayers}
        onUpdateRecordLayer={updateRecordLayer}
        onResetRecordLayers={resetRecordLayers}
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
              uiSpec={uiSpec}
              dataEngine={dataEngine}
            />
          </Box>
        )}
      </Popover>
    </Box>
  );
};
