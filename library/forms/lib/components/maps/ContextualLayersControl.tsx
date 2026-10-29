// SPDX-License-Identifier: Apache-2.0
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {alpha, useTheme, type Theme} from '@mui/material/styles';
import Map from 'ol/Map';
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {mapAssetKindLabel} from '@faims3/data-model';
import {
  BASE_MAP_SATELLITE_NAME,
  type BaseMapLayerPatch,
  type BaseMapPanelLayer,
} from './baseMapLayers';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
  type ContextualMapLayerPatch,
} from './contextualMapLayers';
import {LayerLocationHint} from './LayerLocationHint';
import {moveStackedLayer, sortLayersTopFirst} from './layerOrder';
import {opacityFromColor, rgbHexFromColor, withColorOpacity} from './mapColor';
import {placementExtent} from './previewExtent';
import {defaultMapControlPalette} from './mapTheme';
import {
  RECORD_FORM_LAYER_KIND,
  type RecordFormLayer,
  type RecordFormLayerPatch,
} from './recordFormLayers';
import {useOccasionalDeviceLocation} from './useOccasionalDeviceLocation';

type PanelLayerKind = ContextualMapLayer['kind'] | 'basemap' | 'record-form';

type PanelLayer = {
  id: string;
  name: string;
  kind: PanelLayerKind;
  source: 'contextual' | 'basemap' | 'record';
  visible: boolean;
  opacity: number;
  zIndex: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  extent4326?: ContextualMapLayer['extent4326'];
  extent3857?: ContextualMapLayer['extent3857'];
  canPan: boolean;
  available: boolean;
  unavailableHint?: string;
  error?: string;
};

/**
 * Layers sheet: visibility, stack order, paint, and pan-into-view.
 * Lists streets/satellite, downloaded overlays, and per-form record geometry.
 *
 * While the sheet is open a scrim covers the map. A press on that scrim closes
 * the sheet and is swallowed, so the same gesture does not pan or click the map.
 */
export function ContextualLayersControl({
  map,
  baseLayers = [],
  onUpdateBaseLayer,
  onResetBaseLayers,
  recordLayers = [],
  onUpdateRecordLayer,
  onResetRecordLayers,
  layerErrors = {},
}: {
  map: Map;
  baseLayers?: BaseMapPanelLayer[];
  onUpdateBaseLayer?: (id: string, patch: BaseMapLayerPatch) => void;
  onResetBaseLayers?: () => void;
  recordLayers?: RecordFormLayer[];
  onUpdateRecordLayer?: (id: string, patch: RecordFormLayerPatch) => void;
  onResetRecordLayers?: () => void;
  /** Create failures from the overlay hook. */
  layerErrors?: Record<string, string>;
}) {
  const {layers, updateLayer, resetLayers} = useContext(
    ContextualMapLayersContext
  );
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [panelMaxHeight, setPanelMaxHeight] = useState(320);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useOccasionalDeviceLocation(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    const mapElement = map.getTargetElement();
    if (!mapElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    const update = () => {
      const button = buttonRef.current;
      if (!button) {
        return;
      }
      const available =
        mapElement.getBoundingClientRect().bottom -
        button.getBoundingClientRect().bottom -
        12;
      setPanelMaxHeight(Math.max(160, Math.floor(available)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(mapElement);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [map, open, layers.length, baseLayers.length, recordLayers.length]);

  const panelLayers = toPanelLayers(
    layers,
    baseLayers,
    recordLayers,
    layerErrors
  );
  if (panelLayers.length === 0) {
    return null;
  }

  const ordered = sortLayersTopFirst(panelLayers);
  const visibleCount = panelLayers.filter(layer => layer.visible).length;
  const failedCount = panelLayers.filter(layer => layer.error).length;

  const patchLayer = (layer: PanelLayer, patch: ContextualMapLayerPatch) => {
    if (layer.source === 'basemap') {
      onUpdateBaseLayer?.(layer.id, patch);
      return;
    }
    if (layer.source === 'record') {
      onUpdateRecordLayer?.(layer.id, patch);
      return;
    }
    updateLayer(layer.id, patch);
  };

  const setAllVisible = (visible: boolean) => {
    for (const layer of panelLayers) {
      if (!layer.available && visible) {
        continue;
      }
      if (layer.visible !== visible) {
        patchLayer(layer, {visible});
      }
    }
  };

  const resetToDefaults = () => {
    resetLayers();
    onResetBaseLayers?.();
    onResetRecordLayers?.();
  };

  const movePanelLayer = (layer: PanelLayer, direction: 'up' | 'down') => {
    const next = moveStackedLayer(panelLayers, layer.id, direction);
    if (next === panelLayers) {
      return;
    }
    for (const item of next) {
      const previous = panelLayers.find(entry => entry.id === item.id);
      if (previous && previous.zIndex !== item.zIndex) {
        patchLayer(item, {zIndex: item.zIndex});
      }
    }
  };

  const panLayerIntoView = (layer: PanelLayer) => {
    if (!layer.canPan) {
      return;
    }
    const extent = placementExtent(layer.extent4326, layer.extent3857);
    if (!extent) {
      return;
    }
    map.getView().fit(extent, {
      padding: [24, 24, 24, 24],
      duration: 400,
      maxZoom: 16,
    });
  };

  return (
    <>
      {open && (
        <Box
          data-testid="contextual-layers-scrim"
          aria-hidden
          onPointerDown={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerUp={event =>
            closeWithoutMapInteraction(event, () => setOpen(false))
          }
          onClick={event =>
            closeWithoutMapInteraction(event, () => setOpen(false))
          }
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'auto',
            touchAction: 'none',
            bgcolor: theme =>
              theme.palette.mapControl?.scrim ?? defaultMapControlPalette.scrim,
          }}
        />
      )}
      <Box
        sx={{
          position: 'relative',
          zIndex: 3,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: open ? 'min(100%, 360px)' : 'fit-content',
          maxWidth: '100%',
        }}
      >
        <ButtonBase
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            failedCount > 0
              ? `Map layers, ${visibleCount} of ${panelLayers.length} shown, ${failedCount} failed to load`
              : `Map layers, ${visibleCount} of ${panelLayers.length} shown`
          }
          onClick={() => setOpen(value => !value)}
          sx={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            pl: 1.25,
            pr: 1,
            minHeight: 40,
            borderRadius: 3,
            bgcolor: theme =>
              theme.palette.mapControl?.groupBackground ??
              defaultMapControlPalette.groupBackground,
            color: 'text.primary',
            boxShadow: theme =>
              theme.palette.mapControl?.groupShadow ??
              defaultMapControlPalette.groupShadow,
            border: '1px solid',
            borderColor: open ? 'primary.main' : 'transparent',
          }}
        >
          <LayersOutlinedIcon fontSize="small" />
          <Typography component="span" variant="body2" sx={{fontWeight: 700}}>
            Layers
          </Typography>
          {failedCount > 0 ? (
            <ErrorOutlineIcon
              fontSize="small"
              sx={{color: 'error.main'}}
              aria-hidden
            />
          ) : null}
          <Box
            component="span"
            sx={{
              minWidth: 28,
              height: 22,
              px: 0.75,
              borderRadius: 999,
              bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              typography: 'caption',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {visibleCount}/{panelLayers.length}
          </Box>
        </ButtonBase>
        {open && (
          <Box sx={{pt: 1, width: '100%', pointerEvents: 'auto'}}>
            <Box
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Map layers"
              sx={{
                width: '100%',
                maxHeight: panelMaxHeight,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: theme =>
                  theme.palette.mapControl?.groupBackground ??
                  defaultMapControlPalette.groupBackground,
                borderRadius: 3.5,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: theme =>
                  theme.palette.mapControl?.sheetShadow ??
                  defaultMapControlPalette.sheetShadow,
              }}
            >
              <Stack
                direction="row"
                sx={{
                  alignItems: 'center',
                  gap: 0.75,
                  pl: 1,
                  pr: 0.5,
                  py: 0.75,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Stack spacing={0.75} sx={{flex: '1 1 auto', minWidth: 0}}>
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={resetToDefaults}
                    sx={{
                      textTransform: 'none',
                      minHeight: 32,
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    Reset to defaults
                  </Button>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    sx={{flexWrap: 'wrap'}}
                  >
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      disabled={
                        visibleCount ===
                        panelLayers.filter(layer => layer.available).length
                      }
                      startIcon={<VisibilityOutlinedIcon />}
                      onClick={() => setAllVisible(true)}
                      sx={{
                        flex: '1 1 88px',
                        minWidth: 0,
                        textTransform: 'none',
                        minHeight: 32,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Show all
                    </Button>
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      disabled={visibleCount === 0}
                      startIcon={<VisibilityOffOutlinedIcon />}
                      onClick={() => setAllVisible(false)}
                      sx={{
                        flex: '1 1 88px',
                        minWidth: 0,
                        textTransform: 'none',
                        minHeight: 32,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Hide all
                    </Button>
                  </Stack>
                </Stack>
                <IconButton
                  type="button"
                  aria-label="Close map layers"
                  onClick={() => setOpen(false)}
                  sx={layerActionSx({alignSelf: 'center'})}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
              <Box
                sx={{
                  overflow: 'auto',
                  minHeight: 0,
                  overscrollBehavior: 'contain',
                }}
              >
                {ordered.map((layer, index) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    location={location}
                    divided={index > 0}
                    expanded={expandedId === layer.id}
                    raiseDisabled={index === 0}
                    lowerDisabled={index === ordered.length - 1}
                    onToggleExpanded={() =>
                      setExpandedId(current =>
                        current === layer.id ? null : layer.id
                      )
                    }
                    onToggleVisible={() =>
                      patchLayer(layer, {visible: !layer.visible})
                    }
                    onPanIntoView={() => panLayerIntoView(layer)}
                    onMove={direction => movePanelLayer(layer, direction)}
                    onPatch={patch => patchLayer(layer, patch)}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
}

/**
 * Merge base, contextual, and record overlays into one panel list.
 * Only contextual/record rows can pan; unavailable satellite stays listed.
 */
function toPanelLayers(
  layers: ContextualMapLayer[],
  baseLayers: BaseMapPanelLayer[],
  recordLayers: RecordFormLayer[],
  layerErrors: Record<string, string>
): PanelLayer[] {
  return [
    ...baseLayers.map(layer => ({
      id: layer.id,
      name: layer.name,
      kind: 'basemap' as const,
      source: 'basemap' as const,
      visible: layer.visible,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      stroke: '#4a7cbf',
      fill: '#4a7cbf80',
      lineWidth: 2,
      pointSize: 6,
      canPan: false,
      available: layer.available ?? true,
      unavailableHint: layer.unavailableHint,
    })),
    ...layers.map(layer => ({
      ...layer,
      source: 'contextual' as const,
      canPan: true,
      available: true,
      error: layerErrors[layer.id],
    })),
    ...recordLayers.map(layer => ({
      ...layer,
      source: 'record' as const,
      canPan: Boolean(layer.extent4326),
      available: true,
    })),
  ];
}

/** Phone layouts keep a 2×2; tablet and up (`sm`) spread the controls in one row. */
function layerActionSx(
  extra: Record<string, unknown> = {},
  wide: Record<string, unknown> = {}
) {
  return (theme: Theme) => ({
    width: 40,
    height: 40,
    p: 0,
    flexShrink: 0,
    ...extra,
    [theme.breakpoints.up('sm')]: {
      width: 36,
      height: 36,
      ...wide,
    },
  });
}

/** Subtitle under the layer name: tiles kind, Records, or base-map hint. */
function layerKindLabel(layer: PanelLayer): string {
  if (layer.kind === 'raster-tiles' || layer.kind === 'vector-tiles') {
    return mapAssetKindLabel(layer.kind);
  }
  if (layer.kind === RECORD_FORM_LAYER_KIND) {
    return 'Records';
  }
  return layer.available ? 'Base map' : (layer.unavailableHint ?? 'Base map');
}

/** One expandable row: visibility, pan, stack, and paint controls. */
function LayerRow({
  layer,
  location,
  divided,
  expanded,
  raiseDisabled,
  lowerDisabled,
  onToggleExpanded,
  onToggleVisible,
  onPanIntoView,
  onMove,
  onPatch,
}: {
  layer: PanelLayer;
  location?: [number, number];
  divided: boolean;
  expanded: boolean;
  raiseDisabled: boolean;
  lowerDisabled: boolean;
  onToggleExpanded: () => void;
  onToggleVisible: () => void;
  onPanIntoView: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onPatch: (patch: ContextualMapLayerPatch) => void;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const vectorPaint =
    layer.kind === 'vector-tiles' || layer.kind === RECORD_FORM_LAYER_KIND;
  const revealSection = () => {
    const node = sectionRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }
  };

  return (
    <Box
      ref={sectionRef}
      sx={{
        borderTop: divided ? '1px solid' : 'none',
        borderColor: 'divider',
        minWidth: 0,
      }}
    >
      <Box
        sx={theme => ({
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          columnGap: 0.5,
          pl: 0.5,
          pr: 0.5,
          py: 0.75,
          minWidth: 0,
          bgcolor: expanded
            ? alpha(theme.palette.primary.main, 0.06)
            : 'transparent',
          [theme.breakpoints.up('sm')]: {
            py: 0.5,
          },
        })}
      >
        <Stack
          direction="row"
          spacing={0.25}
          sx={{
            alignItems: 'center',
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          <IconButton
            type="button"
            aria-label={
              !layer.available
                ? `${layer.name} unavailable`
                : layer.visible
                  ? `Hide ${layer.name}`
                  : `Show ${layer.name}`
            }
            aria-pressed={layer.visible}
            disabled={!layer.available}
            onClick={onToggleVisible}
            sx={layerActionSx({
              color: layer.visible ? 'primary.main' : 'text.disabled',
              bgcolor: (theme: Theme) =>
                layer.visible
                  ? alpha(theme.palette.primary.main, 0.12)
                  : 'transparent',
            })}
          >
            {layer.visible ? (
              <VisibilityOutlinedIcon fontSize="small" />
            ) : (
              <VisibilityOffOutlinedIcon fontSize="small" />
            )}
          </IconButton>
          <Box
            aria-hidden
            sx={{
              width: 10,
              height: 10,
              flexShrink: 0,
              borderRadius: vectorPaint ? '50%' : '2px',
              bgcolor: (theme: Theme) =>
                vectorPaint
                  ? rgbHexForInput(layer.stroke, theme)
                  : layer.kind === 'basemap'
                    ? basemapSwatchColor(theme, layer.name)
                    : 'text.disabled',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
          <Box sx={{flex: 1, minWidth: 0, px: 0.5, overflow: 'hidden'}}>
            <Typography
              noWrap
              variant="body2"
              sx={{
                fontWeight: 600,
                lineHeight: 1.3,
                color: layer.visible ? 'text.primary' : 'text.secondary',
              }}
            >
              {layer.name}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 0,
                overflow: 'hidden',
                lineHeight: 1.2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{lineHeight: 1.2}}
              >
                {layerKindLabel(layer)}
              </Typography>
              {layer.source === 'contextual' || layer.source === 'record' ? (
                <LayerLocationHint
                  extent={layer.extent4326}
                  location={location}
                />
              ) : null}
            </Box>
            {layer.error ? (
              <Typography
                variant="caption"
                color="error"
                sx={{display: 'block', lineHeight: 1.3, whiteSpace: 'normal'}}
              >
                {layer.error}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        <Box
          sx={theme => ({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 40px)',
            gridTemplateRows: 'repeat(2, 40px)',
            flex: '0 0 auto',
            [theme.breakpoints.up('sm')]: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0.5,
              gridTemplateColumns: 'unset',
              gridTemplateRows: 'unset',
            },
          })}
        >
          <IconButton
            type="button"
            size="small"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} style for ${layer.name}`}
            onClick={onToggleExpanded}
            sx={layerActionSx(
              {
                gridColumn: 1,
                gridRow: 1,
                color: expanded ? 'primary.main' : 'text.secondary',
                bgcolor: (theme: Theme) =>
                  expanded
                    ? alpha(theme.palette.primary.main, 0.16)
                    : 'transparent',
                border: '1px solid',
                borderColor: expanded ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: (theme: Theme) =>
                    alpha(theme.palette.primary.main, expanded ? 0.22 : 0.08),
                },
              },
              {
                gridColumn: 'auto',
                gridRow: 'auto',
              }
            )}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
          {layer.canPan ? (
            <IconButton
              type="button"
              size="small"
              aria-label={`Pan ${layer.name} into view`}
              onClick={onPanIntoView}
              sx={layerActionSx(
                {
                  gridColumn: 2,
                  gridRow: 1,
                },
                {
                  gridColumn: 'auto',
                  gridRow: 'auto',
                }
              )}
            >
              <CenterFocusStrongIcon fontSize="small" />
            </IconButton>
          ) : (
            <Box
              aria-hidden
              sx={theme => ({
                gridColumn: 2,
                gridRow: 1,
                [theme.breakpoints.up('sm')]: {display: 'none'},
              })}
            />
          )}
          <IconButton
            type="button"
            size="small"
            disabled={raiseDisabled}
            aria-label={`Raise ${layer.name}`}
            onClick={() => onMove('up')}
            sx={layerActionSx(
              {
                gridColumn: 1,
                gridRow: 2,
              },
              {
                gridColumn: 'auto',
                gridRow: 'auto',
              }
            )}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            type="button"
            size="small"
            disabled={lowerDisabled}
            aria-label={`Lower ${layer.name}`}
            onClick={() => onMove('down')}
            sx={layerActionSx(
              {
                gridColumn: 2,
                gridRow: 2,
              },
              {
                gridColumn: 'auto',
                gridRow: 'auto',
              }
            )}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Collapse
        in={expanded}
        timeout="auto"
        unmountOnExit
        onEntered={revealSection}
      >
        <Stack
          spacing={1}
          sx={{
            px: 1.5,
            pt: 1.25,
            pb: 1.5,
            bgcolor: theme => alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <LabeledSlider
            label="Opacity"
            ariaLabel={`${layer.name} opacity`}
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            display={`${Math.round(layer.opacity * 100)}%`}
            onChange={opacity => onPatch({opacity})}
          />
          {vectorPaint && (
            <>
              <Stack
                direction="row"
                spacing={1.5}
                useFlexGap
                sx={{flexWrap: 'wrap'}}
              >
                <ColorSwatch
                  label="Stroke"
                  ariaLabel={`${layer.name} stroke`}
                  opacityAriaLabel={`${layer.name} line opacity`}
                  value={layer.stroke}
                  onChange={stroke => onPatch({stroke})}
                />
                <ColorSwatch
                  label="Fill"
                  ariaLabel={`${layer.name} fill`}
                  opacityAriaLabel={`${layer.name} fill opacity`}
                  value={layer.fill}
                  onChange={fill => onPatch({fill})}
                />
              </Stack>
              <LabeledSlider
                label="Line width"
                ariaLabel={`${layer.name} line width`}
                min={1}
                max={12}
                step={1}
                value={layer.lineWidth}
                display={String(layer.lineWidth)}
                onChange={lineWidth => onPatch({lineWidth})}
              />
              <LabeledSlider
                label="Point size"
                ariaLabel={`${layer.name} point size`}
                min={1}
                max={24}
                step={1}
                value={layer.pointSize}
                display={String(layer.pointSize)}
                onChange={pointSize => onPatch({pointSize})}
              />
            </>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

/** Caption + value + small slider for opacity, width, or point size. */
function LabeledSlider({
  label,
  ariaLabel,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <Box>
      <Stack
        direction="row"
        sx={{alignItems: 'baseline', justifyContent: 'space-between'}}
      >
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" sx={{fontWeight: 700}}>
          {display}
        </Typography>
      </Stack>
      <Slider
        size="small"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(_event, next) => {
          if (typeof next === 'number') {
            onChange(next);
          }
        }}
        sx={{
          mt: 0.5,
          py: 0.5,
        }}
      />
    </Box>
  );
}

/** Native color input, hex label, and a mini opacity slider for stroke or fill. */
function ColorSwatch({
  label,
  ariaLabel,
  opacityAriaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  opacityAriaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const fallback = colorPickerFallback(theme);
  const hex = rgbHexFromColor(value) ?? fallback;
  const opacity = opacityFromColor(value);
  const painted = withColorOpacity(hex, opacity, fallback);
  return (
    <Stack
      spacing={0.5}
      sx={{
        flex: '1 1 100%',
        minWidth: 0,
        [theme.breakpoints.up('sm')]: {
          flex: '1 1 140px',
        },
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1.5,
          minWidth: 0,
          [theme.breakpoints.up('sm')]: {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0.75,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{alignItems: 'center', minWidth: 0, flexShrink: 0}}
        >
          <Box
            component="label"
            sx={{
              position: 'relative',
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: '#fff',
              backgroundImage: [
                'linear-gradient(45deg, #d0d0d0 25%, transparent 25%)',
                'linear-gradient(-45deg, #d0d0d0 25%, transparent 25%)',
                'linear-gradient(45deg, transparent 75%, #d0d0d0 75%)',
                'linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)',
              ].join(', '),
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundColor: painted,
              }}
            />
            <Box
              component="input"
              type="color"
              value={hex}
              aria-label={ariaLabel}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange(
                  withColorOpacity(event.target.value, opacity, fallback)
                )
              }
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                border: 0,
                p: 0,
              }}
            />
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{fontFamily: 'ui-monospace, monospace'}}
          >
            {hex}
          </Typography>
        </Stack>
        <Box sx={{flex: 1, minWidth: 72, maxWidth: {sm: '100%'}}}>
          <Stack
            direction="row"
            sx={{alignItems: 'baseline', justifyContent: 'space-between'}}
          >
            <Typography variant="caption" color="text.secondary">
              Opacity
            </Typography>
            <Typography variant="caption" sx={{fontWeight: 700}}>
              {`${Math.round(opacity * 100)}%`}
            </Typography>
          </Stack>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            aria-label={opacityAriaLabel}
            onChange={(_event, next) => {
              if (typeof next === 'number') {
                onChange(withColorOpacity(value, next, fallback));
              }
            }}
            sx={{
              mt: 0.25,
              py: 0.25,
            }}
          />
        </Box>
      </Box>
    </Stack>
  );
}

/** Streets/satellite swatch from the map-control palette. */
function basemapSwatchColor(theme: Theme, name: string): string {
  const palette = theme.palette.mapControl;
  if (name === BASE_MAP_SATELLITE_NAME) {
    return palette?.satelliteSwatch ?? defaultMapControlPalette.satelliteSwatch;
  }
  return palette?.vectorSwatch ?? defaultMapControlPalette.vectorSwatch;
}

/** `<input type="color">` only accepts #rrggbb. */
function rgbHexForInput(color: string, theme?: Theme): string {
  return rgbHexFromColor(color) ?? colorPickerFallback(theme);
}

function colorPickerFallback(theme?: Theme): string {
  return (
    theme?.palette.mapControl?.colorPickerFallback ??
    defaultMapControlPalette.colorPickerFallback
  );
}

/**
 * Close the sheet without letting the gesture reach the map.
 * The scrim unmounts on the next commit, which can retarget the following
 * click onto the canvas. A one-shot capture listener swallows that click.
 */
function closeWithoutMapInteraction(
  event: {preventDefault: () => void; stopPropagation: () => void},
  close: () => void
) {
  event.preventDefault();
  event.stopPropagation();
  const swallow = (clickEvent: Event) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    document.removeEventListener('click', swallow, true);
  };
  document.addEventListener('click', swallow, true);
  window.setTimeout(() => {
    document.removeEventListener('click', swallow, true);
  }, 500);
  close();
}
