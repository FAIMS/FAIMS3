// SPDX-License-Identifier: Apache-2.0
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
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
import {alpha} from '@mui/material/styles';
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
  ContextualMapLayersContext,
  type ContextualMapLayer,
  type ContextualMapLayerPatch,
} from './contextualMapLayers';

/**
 * Layers sheet: visibility, stack order, paint, and pan-into-view.
 * Rendered over the map when the notebook has downloaded contextual layers.
 *
 * While the sheet is open a scrim covers the map. A press on that scrim closes
 * the sheet and is swallowed, so the same gesture does not pan or click the map.
 */
export function ContextualLayersControl({map}: {map: Map}) {
  const {layers, updateLayer, moveLayer} = useContext(
    ContextualMapLayersContext
  );
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [panelMaxHeight, setPanelMaxHeight] = useState(320);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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
  }, [map, open, layers.length]);

  if (layers.length === 0) {
    return null;
  }

  const ordered = [...layers].sort((a, b) => b.zIndex - a.zIndex);
  const visibleCount = layers.filter(layer => layer.visible).length;

  const setAllVisible = (visible: boolean) => {
    for (const layer of layers) {
      if (layer.visible !== visible) {
        updateLayer(layer.id, {visible});
      }
    }
  };

  const panLayerIntoView = (layer: ContextualMapLayer) => {
    const extent = layer.extent3857
      ? layer.extent3857
      : transformExtent(layer.extent4326, 'EPSG:4326', 'EPSG:3857');
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
          aria-label={`Map layers, ${visibleCount} of ${layers.length} shown`}
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
            {visibleCount}/{layers.length}
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
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Box sx={{minWidth: 0}}>
                  <Typography
                    sx={{fontWeight: 700, fontSize: 15, lineHeight: 1.25}}
                  >
                    Map layers
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Upper layers draw on top
                  </Typography>
                </Box>
                <IconButton
                  type="button"
                  size="small"
                  aria-label="Close map layers"
                  onClick={() => setOpen(false)}
                  sx={{flexShrink: 0}}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  disabled={visibleCount === layers.length}
                  startIcon={<VisibilityOutlinedIcon />}
                  onClick={() => setAllVisible(true)}
                  sx={{flex: 1, textTransform: 'none', minHeight: 32}}
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
                  sx={{flex: 1, textTransform: 'none', minHeight: 32}}
                >
                  Hide all
                </Button>
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
                      updateLayer(layer.id, {visible: !layer.visible})
                    }
                    onPanIntoView={() => panLayerIntoView(layer)}
                    onMove={direction => moveLayer(layer.id, direction)}
                    onPatch={patch => updateLayer(layer.id, patch)}
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

function LayerRow({
  layer,
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
  layer: ContextualMapLayer;
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
      }}
    >
      <Stack
        direction="row"
        spacing={0.25}
        sx={{alignItems: 'center', pl: 0.5, pr: 0.75, py: 0.5}}
      >
        <IconButton
          type="button"
          aria-label={
            layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`
          }
          aria-pressed={layer.visible}
          onClick={onToggleVisible}
          sx={{
            width: 40,
            height: 40,
            color: layer.visible ? 'primary.main' : 'text.disabled',
            bgcolor: theme =>
              layer.visible
                ? alpha(theme.palette.primary.main, 0.12)
                : 'transparent',
          }}
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
            borderRadius: layer.kind === 'image' ? '2px' : '50%',
            bgcolor:
              layer.kind === 'geojson'
                ? toColorInput(layer.stroke)
                : 'text.disabled',
            border: '1px solid',
            borderColor: 'divider',
          }}
        />
        <Box sx={{flex: 1, minWidth: 0, px: 0.5}}>
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
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{lineHeight: 1.2}}
          >
            {layer.kind === 'image' ? 'Image' : 'Vector'}
          </Typography>
        </Box>
        <IconButton
          type="button"
          size="small"
          aria-label={`Pan ${layer.name} into view`}
          onClick={onPanIntoView}
          sx={{width: 36, height: 36}}
        >
          <CenterFocusStrongIcon sx={{fontSize: 20}} />
        </IconButton>
        <IconButton
          type="button"
          size="small"
          disabled={raiseDisabled}
          aria-label={`Raise ${layer.name}`}
          onClick={() => onMove('up')}
          sx={{width: 36, height: 36}}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
        <IconButton
          type="button"
          size="small"
          disabled={lowerDisabled}
          aria-label={`Lower ${layer.name}`}
          onClick={() => onMove('down')}
          sx={{width: 36, height: 36}}
        >
          <KeyboardArrowDownIcon />
        </IconButton>
      </Stack>
      <ButtonBase
        type="button"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} style for ${layer.name}`}
        onClick={onToggleExpanded}
        sx={{
          width: '100%',
          minHeight: 40,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: expanded ? 'primary.main' : 'text.secondary',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: theme =>
            expanded ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        }}
      >
        <Typography variant="caption" sx={{fontWeight: 700}}>
          Style
        </Typography>
        {expanded ? (
          <ExpandLessIcon sx={{fontSize: 18}} />
        ) : (
          <ExpandMoreIcon sx={{fontSize: 18}} />
        )}
      </ButtonBase>
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
            bgcolor: theme => alpha(theme.palette.text.primary, 0.04),
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
          {layer.kind === 'geojson' && (
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
