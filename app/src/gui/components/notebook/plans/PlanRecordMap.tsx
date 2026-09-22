/**
 * @file The Map Collection plan's record map: every planned entry's geometry
 * plotted from the plan itself (no record hydration, so it works offline and
 * before any record exists), green once its record is created and amber while
 * it is pending. Tapping a feature offers to open or create the record.
 *
 * A sibling of the notebook's OverviewMap, which plots saved record geometry;
 * both sit on @faims3/forms' MapComponent and share mapFeatureLayer's layer,
 * styling and tap handling.
 */
import {type MapCollectionPlanEntry} from '@faims3/data-model';
import {MapComponent} from '@faims3/forms';
import {Alert, Box, Button, Popover, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {Extent} from 'ol/extent';
import {FeatureLike} from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import {useEffect, useRef, useState} from 'react';
import {getMapConfig} from '../../../../buildconfig';
import {
  addFeatureLayerToMap,
  featureStyle,
  isOpeningTapBackdropClick,
  listenForMapTaps,
  popoverAnchorForPixel,
  SHORT_WAIT_CONSTANT,
} from '../mapFeatureLayer';
import {
  type PlanRecordFeatureCollection,
  type PlanRecordFeatureProps,
} from './planRecordMapFeatures';

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

  useEffect(() => {
    if (!map || features.features.length === 0) return;

    const {layer, extent} = addFeatureLayerToMap({
      map,
      collection: features,
      style: (olFeature: FeatureLike) =>
        featureStyle({
          color: olFeature.get('created') ? colors.created : colors.pending,
          selected:
            selectedRef.current?.reference === olFeature.get('reference'),
        }),
    });
    vectorLayerRef.current = layer;
    if (extent) setFeaturesExtent(extent);

    const stopListening = listenForMapTaps({
      map,
      onTap: pixel => {
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
        if (!hit) return;
        popoverOpenedAtRef.current = Date.now();
        setAnchor(popoverAnchorForPixel({map, pixel}));
        setSelected({
          reference: hit.reference,
          planReference: hit.planReference,
          created: hit.created,
        });
      },
    });

    return () => {
      stopListening();
      if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
      }
    };
  }, [map, features, colors.created, colors.pending]);

  const handleClose = (
    _event: object,
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    if (
      isOpeningTapBackdropClick({
        reason,
        openedAt: popoverOpenedAtRef.current,
      })
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
