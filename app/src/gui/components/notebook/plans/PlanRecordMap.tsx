/**
 * @file The Map Collection plan's record map: every planned entry's geometry
 * plotted from the plan itself (no record hydration, so it works offline and
 * before any record exists), green once its record is created and amber while
 * it is pending. Tapping a feature offers to open or create the record.
 *
 * A sibling of the notebook's OverviewMap, which plots saved record geometry;
 * both sit on @faims3/forms' MapComponent.
 */
import {type MapCollectionPlanEntry} from '@faims3/data-model';
import {MapComponent} from '@faims3/forms';
import {Alert, Box, Button, Popover, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {Extent} from 'ol/extent';
import {FeatureLike} from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useCallback, useEffect, useRef, useState} from 'react';
import {getMapConfig} from '../../../../buildconfig';
import {
  type PlanRecordFeatureCollection,
  type PlanRecordFeatureProps,
} from './planRecordMapFeatures';

/** Short time guarding the popover button and bounding a tap. */
const SHORT_WAIT_CONSTANT = 400;
const TAP_MAX_MOVEMENT_PX = 15;

export type PlanRecordMapProps = {
  features: PlanRecordFeatureCollection;
  /** The entries, to describe the tapped one. */
  entries: Record<string, MapCollectionPlanEntry>;
  /** What one record is called, e.g. the form's label. */
  recordLabel: string;
  canCreateRecord: boolean;
  onCreate: (reference: string) => void;
  onOpen: (planReference: string) => void;
};

/** The styles for a plotted feature, by whether its record exists and is selected. */
const featureStyle = ({color, selected}: {color: string; selected: boolean}) =>
  selected
    ? new Style({
        stroke: new Stroke({color: '#ffffff', width: 5}),
        fill: new Fill({color: color + 'cc'}),
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({color}),
          stroke: new Stroke({color: '#ffffff', width: 4}),
        }),
      })
    : new Style({
        stroke: new Stroke({color, width: 4}),
        fill: new Fill({color: color + '80'}),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({color}),
          stroke: new Stroke({color: '#fff', width: 2}),
        }),
      });

export const PlanRecordMap = ({
  features,
  entries,
  recordLabel,
  canCreateRecord,
  onCreate,
  onOpen,
}: PlanRecordMapProps) => {
  const theme = useTheme();
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [selected, setSelected] = useState<PlanRecordFeatureProps | null>(null);
  const [anchor, setAnchor] = useState<{left: number; top: number} | null>(
    null
  );
  const [featuresExtent, setFeaturesExtent] = useState<Extent | undefined>();
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectedRef = useRef<PlanRecordFeatureProps | null>(null);
  const popoverOpenedAtRef = useRef<number>(0);

  const colors = {
    created: theme.palette.success.main,
    pending: theme.palette.warning.main,
  };

  // Keep the ref in sync so the layer's style function can highlight the selection
  useEffect(() => {
    selectedRef.current = selected;
    vectorLayerRef.current?.changed();
    if (!selected) return;
    // The tap that opened the popover must not also press its button
    setButtonsEnabled(false);
    const id = setTimeout(() => setButtonsEnabled(true), SHORT_WAIT_CONSTANT);
    return () => clearTimeout(id);
  }, [selected]);

  const addFeaturesToMap = useCallback(
    (theMap: Map, collection: PlanRecordFeatureCollection) => {
      if (vectorLayerRef.current) {
        theMap.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }
      const source = new VectorSource();
      const layer = new VectorLayer({
        source,
        style: (olFeature: FeatureLike) => {
          const created = Boolean(olFeature.get('created'));
          const reference = olFeature.get('reference') as string | undefined;
          return featureStyle({
            color: created ? colors.created : colors.pending,
            selected: selectedRef.current?.reference === reference,
          });
        },
      });

      if (collection.features.length > 0) {
        try {
          const parsed = new GeoJSON().readFeatures(collection, {
            dataProjection: 'EPSG:4326',
            featureProjection: theMap.getView().getProjection(),
          });
          source.addFeatures(parsed);
          const sourceExtent = source.getExtent();
          if (sourceExtent && !sourceExtent.some(v => !isFinite(v))) {
            const extent = transformExtent(
              sourceExtent,
              theMap.getView().getProjection(),
              'EPSG:4326'
            );
            if (!extent.some(v => !isFinite(v))) setFeaturesExtent(extent);
          }
        } catch (error) {
          console.error('Failed to parse plan features:', error);
        }
      }

      theMap.addLayer(layer);
      vectorLayerRef.current = layer;
    },
    [colors.created, colors.pending]
  );

  useEffect(() => {
    if (!map || features.features.length === 0) return;
    addFeaturesToMap(map, features);

    const selectFeatureAtPixel = (pixel: number[]) => {
      const hit = map.forEachFeatureAtPixel(
        pixel,
        olFeature => {
          const props = olFeature.getProperties();
          return props.planReference
            ? (props as PlanRecordFeatureProps)
            : undefined;
        },
        {hitTolerance: 10}
      );
      if (hit) {
        popoverOpenedAtRef.current = Date.now();
        const rect = map.getTargetElement().getBoundingClientRect();
        setAnchor({left: rect.left + pixel[0], top: rect.top + pixel[1]});
        setSelected({
          reference: hit.reference,
          planReference: hit.planReference,
          created: hit.created,
        });
      }
    };

    // Tap detection on pointerdown/up, as the overview map does: on many
    // Android browsers the pan interaction consumes the gesture so click
    // fails to fire.
    let pointerDown: {pixel: number[]; time: number; id: number} | null = null;
    const handlePointerDown = (evt: PointerEvent) => {
      pointerDown = {
        pixel: map.getEventPixel(evt).slice(),
        time: Date.now(),
        id: evt.pointerId,
      };
    };
    const handlePointerUp = (evt: PointerEvent) => {
      const upPixel = map.getEventPixel(evt);
      if (!pointerDown || pointerDown.id !== evt.pointerId) return;
      const dt = Date.now() - pointerDown.time;
      const dx = Math.abs(upPixel[0] - pointerDown.pixel[0]);
      const dy = Math.abs(upPixel[1] - pointerDown.pixel[1]);
      const isTap =
        dt <= SHORT_WAIT_CONSTANT &&
        dx <= TAP_MAX_MOVEMENT_PX &&
        dy <= TAP_MAX_MOVEMENT_PX;
      pointerDown = null;
      if (isTap) selectFeatureAtPixel(upPixel);
    };

    const mapEl = map.getTargetElement();
    mapEl.addEventListener('pointerdown', handlePointerDown);
    mapEl.addEventListener('pointerup', handlePointerUp);
    return () => {
      mapEl.removeEventListener('pointerdown', handlePointerDown);
      mapEl.removeEventListener('pointerup', handlePointerUp);
      if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }
    };
  }, [map, features, addFeaturesToMap]);

  const handleClose = (
    _event: object,
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // On touch the opening tap is often reported as a backdropClick too
    if (
      reason === 'backdropClick' &&
      Date.now() - popoverOpenedAtRef.current < SHORT_WAIT_CONSTANT
    ) {
      return;
    }
    setSelected(null);
    setAnchor(null);
  };

  if (features.features.length === 0) {
    return (
      <Box sx={{p: 2}}>
        <Alert severity="info">This plan has no planned records to map.</Alert>
      </Box>
    );
  }

  const selectedEntry = selected ? entries[selected.reference] : undefined;

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
      data-testid="plan-record-map"
    >
      <Box sx={{display: 'flex', gap: 2, mb: 1, fontSize: '0.85rem'}}>
        <Legend color={colors.created} label="Created" />
        <Legend color={colors.pending} label="Not yet created" />
      </Box>
      <MapComponent
        parentSetMap={setMap}
        extent={featuresExtent}
        config={getMapConfig()}
        autoFlyToCurrentLocation={false}
      />
      <Popover
        open={!!selected && !!anchor}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={anchor ?? {left: 0, top: 0}}
        transformOrigin={{vertical: 'bottom', horizontal: 'center'}}
        marginThreshold={24}
        slotProps={{
          paper: {
            sx: {maxWidth: 'min(320px, calc(100vw - 48px))', minWidth: 0},
          },
        }}
      >
        {selected && selectedEntry && (
          <Box sx={{p: 1.5, minWidth: 200}}>
            <Typography variant="subtitle1" sx={{fontWeight: 600}}>
              {recordLabel}: {selected.reference}
            </Typography>
            <Typography variant="body2" component="div" sx={{mt: 0.5}}>
              {Object.entries(selectedEntry.fields).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong> {String(value)}
                </div>
              ))}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{display: 'block', mt: 0.5}}
            >
              {selected.created ? 'Record created' : 'Not yet created'}
            </Typography>
            {selected.created ? (
              <Button
                variant="contained"
                size="small"
                sx={{mt: 1.5}}
                disabled={!buttonsEnabled}
                onClick={() => onOpen(selected.planReference)}
              >
                View record
              </Button>
            ) : (
              canCreateRecord && (
                <Button
                  variant="contained"
                  size="small"
                  sx={{mt: 1.5}}
                  disabled={!buttonsEnabled}
                  onClick={() => onCreate(selected.reference)}
                >
                  Create record
                </Button>
              )
            )}
          </Box>
        )}
      </Popover>
    </Box>
  );
};

const Legend = ({color, label}: {color: string; label: string}) => (
  <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
        border: '2px solid #fff',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
      }}
    />
    <span>{label}</span>
  </Box>
);
