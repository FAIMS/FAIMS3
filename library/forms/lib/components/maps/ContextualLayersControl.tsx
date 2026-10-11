// SPDX-License-Identifier: Apache-2.0
import {Box, ButtonBase, Slider, Stack, Typography} from '@mui/material';
import {transformExtent} from 'ol/proj';
import Map from 'ol/Map';
import {useContext, useState} from 'react';
import {ContextualMapLayersContext} from './contextualMapLayers';

/**
 * Layers tab: visibility, opacity, stack order, and basic vector paint.
 * Rendered over the map when the notebook has downloaded contextual layers.
 */
export function ContextualLayersControl({map}: {map: Map}) {
  const {layers, updateLayer, moveLayer} = useContext(
    ContextualMapLayersContext
  );
  const [open, setOpen] = useState(false);
  if (layers.length === 0) {
    return null;
  }

  const ordered = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <Box sx={{pointerEvents: 'auto', maxWidth: 320}}>
      <ButtonBase
        onClick={() => setOpen(value => !value)}
        sx={{
          px: 1.25,
          py: 0.75,
          borderRadius: 1,
          bgcolor: 'background.paper',
          boxShadow: 1,
          typography: 'body2',
        }}
      >
        Layers ({layers.filter(layer => layer.visible).length}/{layers.length})
      </ButtonBase>
      {open && (
        <Stack
          spacing={1.5}
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: 2,
            maxHeight: 360,
            overflow: 'auto',
          }}
        >
          {ordered.map(layer => (
            <Box key={layer.id}>
              <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  aria-label={`Show ${layer.name}`}
                  onChange={event => {
                    const visible = event.target.checked;
                    updateLayer(layer.id, {visible});
                    if (visible) {
                      const extent = layer.extent3857
                        ? layer.extent3857
                        : transformExtent(
                            layer.extent4326,
                            'EPSG:4326',
                            'EPSG:3857'
                          );
                      map.getView().fit(extent, {
                        padding: [24, 24, 24, 24],
                        duration: 400,
                        maxZoom: 16,
                      });
                    }
                  }}
                />
                <Typography variant="body2" sx={{flex: 1}}>
                  {layer.name}
                </Typography>
                <ButtonBase
                  aria-label={`Raise ${layer.name}`}
                  onClick={() => moveLayer(layer.id, 'up')}
                  sx={{px: 0.5}}
                >
                  ↑
                </ButtonBase>
                <ButtonBase
                  aria-label={`Lower ${layer.name}`}
                  onClick={() => moveLayer(layer.id, 'down')}
                  sx={{px: 0.5}}
                >
                  ↓
                </ButtonBase>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Opacity
              </Typography>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={layer.opacity}
                aria-label={`${layer.name} opacity`}
                onChange={(_event, value) => {
                  if (typeof value === 'number') {
                    updateLayer(layer.id, {opacity: value});
                  }
                }}
              />
              {layer.kind === 'geojson' && (
                <Stack spacing={0.5}>
                  <label>
                    <Typography variant="caption">Stroke </Typography>
                    <input
                      type="color"
                      value={toColorInput(layer.stroke)}
                      aria-label={`${layer.name} stroke`}
                      onChange={event =>
                        updateLayer(layer.id, {stroke: event.target.value})
                      }
                    />
                  </label>
                  <label>
                    <Typography variant="caption">Fill </Typography>
                    <input
                      type="color"
                      value={toColorInput(layer.fill)}
                      aria-label={`${layer.name} fill`}
                      onChange={event =>
                        updateLayer(layer.id, {fill: event.target.value})
                      }
                    />
                  </label>
                  <label>
                    <Typography variant="caption">Line width </Typography>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={layer.lineWidth}
                      aria-label={`${layer.name} line width`}
                      onChange={event =>
                        updateLayer(layer.id, {
                          lineWidth: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </label>
                  <label>
                    <Typography variant="caption">Point size </Typography>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={layer.pointSize}
                      aria-label={`${layer.name} point size`}
                      onChange={event =>
                        updateLayer(layer.id, {
                          pointSize: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </label>
                  <label>
                    <Typography variant="caption">Label field </Typography>
                    <input
                      type="text"
                      value={layer.labelField ?? ''}
                      aria-label={`${layer.name} label field`}
                      onChange={event =>
                        updateLayer(layer.id, {
                          labelField: event.target.value || undefined,
                        })
                      }
                    />
                  </label>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
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
