// SPDX-License-Identifier: Apache-2.0
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CloseIcon from '@mui/icons-material/Close';
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
  TextField,
  Typography,
} from '@mui/material';
import {alpha, type Theme} from '@mui/material/styles';
import {transformExtent} from 'ol/proj';
import Map from 'ol/Map';
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {INPUT_LIMITS} from '@faims3/data-model';
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
  labelField?: string;
  extent4326?: ContextualMapLayer['extent4326'];
  extent3857?: ContextualMapLayer['extent3857'];
  canPan: boolean;
  available: boolean;
  unavailableHint?: string;
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
}: {
  map: Map;
  baseLayers?: BaseMapPanelLayer[];
  onUpdateBaseLayer?: (id: string, patch: BaseMapLayerPatch) => void;
  onResetBaseLayers?: () => void;
  recordLayers?: RecordFormLayer[];
  onUpdateRecordLayer?: (id: string, patch: RecordFormLayerPatch) => void;
  onResetRecordLayers?: () => void;
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

  const panelLayers = toPanelLayers(layers, baseLayers, recordLayers);
  if (panelLayers.length === 0) {
    return null;
  }

  const ordered = sortLayersTopFirst(panelLayers);
  const visibleCount = panelLayers.filter(layer => layer.visible).length;

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
    const extent = layer.extent3857
      ? layer.extent3857
      : layer.extent4326
        ? transformExtent(layer.extent4326, 'EPSG:4326', 'EPSG:3857')
        : undefined;
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
            bgcolor: 'rgba(15, 23, 42, 0.12)',
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
          aria-label={`Map layers, ${visibleCount} of ${panelLayers.length} shown`}
          onClick={() => setOpen(value => !value)}
          sx={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            pl: 1.25,
            pr: 1,
            minHeight: 40,
            borderRadius: '12px',
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: '0 1px 4px rgba(15, 23, 42, 0.28)',
            border: '1px solid',
            borderColor: open ? 'primary.main' : 'transparent',
          }}
        >
          <LayersOutlinedIcon sx={{fontSize: 18}} />
          <Typography component="span" variant="body2" sx={{fontWeight: 700}}>
            Layers
          </Typography>
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
                bgcolor: 'background.paper',
                borderRadius: '14px',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)',
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
                  size="small"
                  aria-label="Close map layers"
                  onClick={() => setOpen(false)}
                  sx={{flexShrink: 0, alignSelf: 'center'}}
                >
                  <CloseIcon fontSize="small" />
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

function toPanelLayers(
  layers: ContextualMapLayer[],
  baseLayers: BaseMapPanelLayer[],
  recordLayers: RecordFormLayer[]
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
    })),
    ...recordLayers.map(layer => ({
      ...layer,
      source: 'record' as const,
      canPan: Boolean(layer.extent4326),
      available: true,
    })),
  ];
}

/** Phone layouts keep a 2×2; tablet and up spread the controls in one row. */
const LAYER_CONTROLS_WIDE = '@media (min-width: 600px)';

function layerActionSx(extra: Record<string, unknown> = {}) {
  const wideExtra = extra[LAYER_CONTROLS_WIDE];
  const rest = {...extra};
  delete rest[LAYER_CONTROLS_WIDE];
  return {
    width: 40,
    height: 40,
    p: 0,
    flexShrink: 0,
    ...rest,
    [LAYER_CONTROLS_WIDE]: {
      width: 36,
      height: 36,
      ...(wideExtra && typeof wideExtra === 'object' ? wideExtra : {}),
    },
  };
}

function layerKindLabel(layer: PanelLayer): string {
  if (layer.kind === 'raster-tiles') {
    return 'Image tiles';
  }
  if (layer.kind === 'vector-tiles') {
    return 'Vector tiles';
  }
  if (layer.kind === RECORD_FORM_LAYER_KIND) {
    return 'Records';
  }
  return layer.available ? 'Base map' : (layer.unavailableHint ?? 'Base map');
}

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
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          columnGap: 0.5,
          pl: 0.5,
          pr: 0.5,
          py: 0.75,
          minWidth: 0,
          bgcolor: theme =>
            expanded ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          [LAYER_CONTROLS_WIDE]: {
            py: 0.5,
          },
        }}
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
              <VisibilityOutlinedIcon sx={{fontSize: 20}} />
            ) : (
              <VisibilityOffOutlinedIcon sx={{fontSize: 20}} />
            )}
          </IconButton>
          <Box
            aria-hidden
            sx={{
              width: 10,
              height: 10,
              flexShrink: 0,
              borderRadius: vectorPaint ? '50%' : '2px',
              bgcolor: vectorPaint
                ? toColorInput(layer.stroke)
                : layer.kind === 'basemap'
                  ? layer.name === BASE_MAP_SATELLITE_NAME
                    ? '#6b8f4e'
                    : '#4a7cbf'
                  : 'text.disabled',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
          <Box sx={{flex: 1, minWidth: 0, px: 0.5, overflow: 'hidden'}}>
            <Typography
              noWrap
              sx={{
                fontWeight: 600,
                fontSize: 14,
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
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 40px)',
            gridTemplateRows: 'repeat(2, 40px)',
            flex: '0 0 auto',
            [LAYER_CONTROLS_WIDE]: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0.5,
              gridTemplateColumns: 'unset',
              gridTemplateRows: 'unset',
            },
          }}
        >
          <IconButton
            type="button"
            size="small"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} style for ${layer.name}`}
            onClick={onToggleExpanded}
            sx={layerActionSx({
              gridColumn: 1,
              gridRow: 1,
              [LAYER_CONTROLS_WIDE]: {
                gridColumn: 'auto',
                gridRow: 'auto',
              },
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
            })}
          >
            <SettingsOutlinedIcon sx={{fontSize: 18}} />
          </IconButton>
          {layer.canPan ? (
            <IconButton
              type="button"
              size="small"
              aria-label={`Pan ${layer.name} into view`}
              onClick={onPanIntoView}
              sx={layerActionSx({
                gridColumn: 2,
                gridRow: 1,
                [LAYER_CONTROLS_WIDE]: {
                  gridColumn: 'auto',
                  gridRow: 'auto',
                },
              })}
            >
              <CenterFocusStrongIcon sx={{fontSize: 18}} />
            </IconButton>
          ) : (
            <Box
              aria-hidden
              sx={{
                gridColumn: 2,
                gridRow: 1,
                [LAYER_CONTROLS_WIDE]: {display: 'none'},
              }}
            />
          )}
          <IconButton
            type="button"
            size="small"
            disabled={raiseDisabled}
            aria-label={`Raise ${layer.name}`}
            onClick={() => onMove('up')}
            sx={layerActionSx({
              gridColumn: 1,
              gridRow: 2,
              [LAYER_CONTROLS_WIDE]: {
                gridColumn: 'auto',
                gridRow: 'auto',
              },
            })}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            type="button"
            size="small"
            disabled={lowerDisabled}
            aria-label={`Lower ${layer.name}`}
            onClick={() => onMove('down')}
            sx={layerActionSx({
              gridColumn: 2,
              gridRow: 2,
              [LAYER_CONTROLS_WIDE]: {
                gridColumn: 'auto',
                gridRow: 'auto',
              },
            })}
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
                  value={layer.stroke}
                  onChange={stroke => onPatch({stroke})}
                />
                <ColorSwatch
                  label="Fill"
                  ariaLabel={`${layer.name} fill`}
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
              <TextField
                size="small"
                fullWidth
                label="Label field"
                placeholder="Attribute name"
                value={layer.labelField ?? ''}
                onChange={event =>
                  onPatch({labelField: event.target.value || undefined})
                }
                slotProps={{
                  htmlInput: {
                    'aria-label': `${layer.name} label field`,
                    maxLength: INPUT_LIMITS.ID_MAX_LENGTH,
                  },
                }}
              />
            </>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

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
          '& .MuiSlider-thumb': {width: 18, height: 18},
          '& .MuiSlider-rail, & .MuiSlider-track': {height: 4},
        }}
      />
    </Box>
  );
}

function ColorSwatch({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hex = toColorInput(value);
  return (
    <Stack spacing={0.5} sx={{flex: '1 1 140px', minWidth: 0}}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{alignItems: 'center', minWidth: 0}}
      >
        <Box
          component="label"
          sx={{
            position: 'relative',
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '10px',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: hex,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <Box
            component="input"
            type="color"
            value={hex}
            aria-label={ariaLabel}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange(event.target.value)
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
    </Stack>
  );
}

/** `<input type="color">` only accepts #rrggbb. */
function toColorInput(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return color.slice(0, 7);
  }
  return '#1565c0';
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
