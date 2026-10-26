// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type Map from 'ol/Map';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {saveLastLocation} from './lastKnownLocation';

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockRejectedValue(new Error('no gps')),
  },
}));
import {
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  type BaseMapLayerPatch,
  type BaseMapPanelLayer,
} from './baseMapLayers';
import {ContextualLayersControl} from './ContextualLayersControl';
import {MapControlThemeProvider} from './mapTheme';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from './contextualMapLayers';
import {
  RECORD_FORM_LAYER_KIND,
  type RecordFormLayer,
  type RecordFormLayerPatch,
} from './recordFormLayers';

const theme = createTheme();

function layer(
  patch: Partial<ContextualMapLayer> & Pick<ContextualMapLayer, 'id' | 'name'>
): ContextualMapLayer {
  return {
    kind: 'vector-tiles',
    url: 'blob:layer',
    visible: true,
    opacity: 0.8,
    zIndex: 1,
    stroke: '#1565c0',
    fill: '#1565c080',
    lineWidth: 2,
    pointSize: 6,
    extent4326: [0, 0, 1, 1],
    ...patch,
  };
}

function recordLayer(
  patch: Partial<RecordFormLayer> &
    Pick<RecordFormLayer, 'id' | 'formId' | 'name'>
): RecordFormLayer {
  return {
    kind: RECORD_FORM_LAYER_KIND,
    visible: true,
    opacity: 1,
    zIndex: 980,
    stroke: '#2171b5',
    fill: '#2171b580',
    lineWidth: 4,
    pointSize: 7,
    extent4326: [0, 0, 1, 1],
    ...patch,
  };
}

function renderControl(
  layers: ContextualMapLayer[],
  updateLayer = vi.fn(),
  moveLayer = vi.fn(),
  {
    baseLayers = [],
    onUpdateBaseLayer = vi.fn<(id: string, patch: BaseMapLayerPatch) => void>(),
    onResetBaseLayers = vi.fn(),
    recordLayers = [],
    onUpdateRecordLayer = vi.fn<
      (id: string, patch: RecordFormLayerPatch) => void
    >(),
    onResetRecordLayers = vi.fn(),
    resetLayers = vi.fn(),
    layerErrors = {},
  }: {
    baseLayers?: BaseMapPanelLayer[];
    onUpdateBaseLayer?: (id: string, patch: BaseMapLayerPatch) => void;
    onResetBaseLayers?: () => void;
    recordLayers?: RecordFormLayer[];
    onUpdateRecordLayer?: (id: string, patch: RecordFormLayerPatch) => void;
    onResetRecordLayers?: () => void;
    resetLayers?: () => void;
    layerErrors?: Record<string, string>;
  } = {}
) {
  const fit = vi.fn();
  const map = {
    getView: () => ({fit}),
    getTargetElement: () => document.createElement('div'),
  } as unknown as Map;
  render(
    <ThemeProvider theme={theme}>
      <MapControlThemeProvider>
        <ContextualMapLayersContext.Provider
          value={{layers, updateLayer, moveLayer, resetLayers}}
        >
          <ContextualLayersControl
            map={map}
            baseLayers={baseLayers}
            onUpdateBaseLayer={onUpdateBaseLayer}
            onResetBaseLayers={onResetBaseLayers}
            recordLayers={recordLayers}
            onUpdateRecordLayer={onUpdateRecordLayer}
            onResetRecordLayers={onResetRecordLayers}
            layerErrors={layerErrors}
          />
        </ContextualMapLayersContext.Provider>
      </MapControlThemeProvider>
    </ThemeProvider>
  );
  return {
    fit,
    updateLayer,
    moveLayer,
    resetLayers,
    onUpdateBaseLayer,
    onResetBaseLayers,
    onUpdateRecordLayer,
    onResetRecordLayers,
  };
}

describe('ContextualLayersControl', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps style controls collapsed until the section is opened', async () => {
    const user = userEvent.setup();
    renderControl([layer({id: 'boundary', name: 'Site boundary'})]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );

    expect(
      screen.queryByRole('slider', {name: 'Site boundary opacity'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Style')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Show style for Site boundary'})
    ).toHaveAttribute('aria-expanded', 'false');

    await user.click(
      screen.getByRole('button', {name: 'Show style for Site boundary'})
    );

    expect(
      screen.getByRole('button', {name: 'Hide style for Site boundary'})
    ).toHaveAttribute('aria-expanded', 'true');

    expect(
      screen.getByRole('slider', {name: 'Site boundary opacity'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Site boundary line width'})
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Site boundary label field')
    ).not.toBeInTheDocument();
  });

  it('closes on a press outside the sheet and swallows the following click', async () => {
    const user = userEvent.setup();
    renderControl([layer({id: 'boundary', name: 'Site boundary'})]);
    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );
    expect(
      screen.getByRole('dialog', {name: 'Map layers'})
    ).toBeInTheDocument();

    const mapClick = vi.fn();
    document.body.addEventListener('click', mapClick);
    fireEvent.pointerUp(screen.getByTestId('contextual-layers-scrim'));
    fireEvent.click(document.body);
    document.body.removeEventListener('click', mapClick);

    expect(
      screen.queryByRole('dialog', {name: 'Map layers'})
    ).not.toBeInTheDocument();
    expect(mapClick).not.toHaveBeenCalled();
  });

  it('toggles visibility without framing, and pans only from the action button', async () => {
    const user = userEvent.setup();
    const {fit, updateLayer} = renderControl([
      layer({id: 'lower', name: 'Tracks', zIndex: 1, visible: false}),
      layer({id: 'upper', name: 'Boundary', zIndex: 2}),
    ]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 2 shown/i})
    );
    await user.click(screen.getByRole('button', {name: 'Show Tracks'}));
    expect(updateLayer).toHaveBeenCalledWith('lower', {visible: true});
    expect(fit).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {name: 'Pan Tracks into view'})
    );
    expect(fit).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', {name: 'Raise Tracks'}));
    expect(updateLayer).toHaveBeenCalledWith('lower', {zIndex: 2});
    expect(updateLayer).toHaveBeenCalledWith('upper', {zIndex: 1});
  });

  it('shows or hides every layer from the panel header', async () => {
    const user = userEvent.setup();
    const {updateLayer, fit} = renderControl([
      layer({id: 'lower', name: 'Tracks', zIndex: 1, visible: false}),
      layer({id: 'upper', name: 'Boundary', zIndex: 2, visible: true}),
    ]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 2 shown/i})
    );

    await user.click(screen.getByRole('button', {name: 'Show all'}));
    expect(updateLayer).toHaveBeenCalledTimes(1);
    expect(updateLayer).toHaveBeenCalledWith('lower', {visible: true});
    expect(fit).not.toHaveBeenCalled();

    updateLayer.mockClear();
    await user.click(screen.getByRole('button', {name: 'Hide all'}));
    expect(updateLayer).toHaveBeenCalledTimes(1);
    expect(updateLayer).toHaveBeenCalledWith('upper', {visible: false});
    expect(fit).not.toHaveBeenCalled();
  });

  it('lists streets and satellite as ordinary layers', async () => {
    const user = userEvent.setup();
    const {onUpdateBaseLayer, updateLayer} = renderControl(
      [],
      vi.fn(),
      vi.fn(),
      {
        baseLayers: [
          {
            id: BASE_MAP_VECTOR_ID,
            name: 'Streets',
            visible: true,
            opacity: 1,
            zIndex: 0,
          },
          {
            id: BASE_MAP_SATELLITE_ID,
            name: 'Satellite',
            visible: false,
            opacity: 0.8,
            zIndex: 1,
          },
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 2 shown/i})
    );
    expect(screen.getByText('Streets')).toBeInTheDocument();
    expect(screen.getByText('Satellite')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Pan Streets into view'})
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Show Satellite'}));
    expect(onUpdateBaseLayer).toHaveBeenCalledWith(BASE_MAP_SATELLITE_ID, {
      visible: true,
    });
    expect(updateLayer).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {name: 'Show style for Streets'})
    );
    expect(
      screen.getByRole('slider', {name: 'Streets opacity'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('slider', {name: 'Streets line width'})
    ).not.toBeInTheDocument();
  });

  it('raises a layer that shares a stack slot with the row above it', async () => {
    const user = userEvent.setup();
    const {updateLayer} = renderControl(
      [
        layer({id: 'tracks', name: 'Tracks', zIndex: 10}),
        layer({id: 'boundary', name: 'Boundary', zIndex: 10}),
      ],
      vi.fn(),
      vi.fn(),
      {
        baseLayers: [
          {
            id: BASE_MAP_VECTOR_ID,
            name: 'Streets',
            visible: true,
            opacity: 1,
            zIndex: 0,
          },
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 3 of 3 shown/i})
    );
    await user.click(screen.getByRole('button', {name: 'Raise Boundary'}));

    const zIndexFor = (id: string) =>
      updateLayer.mock.calls.find(call => call[0] === id)?.[1]?.zIndex;
    expect(zIndexFor('boundary')).toBeGreaterThan(
      zIndexFor('tracks') as number
    );
  });

  it('reorders a base map against an overlay', async () => {
    const user = userEvent.setup();
    const {onUpdateBaseLayer, updateLayer} = renderControl(
      [layer({id: 'boundary', name: 'Site boundary', zIndex: 10})],
      vi.fn(),
      vi.fn(),
      {
        baseLayers: [
          {
            id: BASE_MAP_VECTOR_ID,
            name: 'Streets',
            visible: true,
            opacity: 1,
            zIndex: 0,
          },
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 2 of 2 shown/i})
    );
    await user.click(screen.getByRole('button', {name: 'Raise Streets'}));
    expect(onUpdateBaseLayer).toHaveBeenCalledWith(BASE_MAP_VECTOR_ID, {
      zIndex: 10,
    });
    expect(updateLayer).toHaveBeenCalledWith('boundary', {zIndex: 0});
  });

  it('does not show an unavailable satellite layer from Show all', async () => {
    const user = userEvent.setup();
    const {onUpdateBaseLayer} = renderControl([], vi.fn(), vi.fn(), {
      baseLayers: [
        {
          id: BASE_MAP_VECTOR_ID,
          name: 'Streets',
          visible: false,
          opacity: 1,
          zIndex: 0,
        },
        {
          id: BASE_MAP_SATELLITE_ID,
          name: 'Satellite',
          visible: false,
          opacity: 1,
          zIndex: 1,
          available: false,
          unavailableHint: 'Needs a network connection',
        },
      ],
    });

    await user.click(
      screen.getByRole('button', {name: /map layers, 0 of 2 shown/i})
    );
    expect(
      screen.getByRole('button', {name: 'Satellite unavailable'})
    ).toBeDisabled();
    expect(screen.getByText('Needs a network connection')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Show all'}));
    expect(onUpdateBaseLayer).toHaveBeenCalledTimes(1);
    expect(onUpdateBaseLayer).toHaveBeenCalledWith(BASE_MAP_VECTOR_ID, {
      visible: true,
    });
  });

  it('shows a blue location dot when the device is on the layer', async () => {
    const user = userEvent.setup();
    saveLastLocation([0.5, 0.5]);
    renderControl([layer({id: 'boundary', name: 'Site boundary'})]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );

    expect(
      screen.getByRole('img', {name: 'Current location is on this layer'})
    ).toBeInTheDocument();
    expect(screen.getByText('On map')).toBeInTheDocument();
  });

  it('shows a bearing arrow and coarse distance when the device is outside the layer', async () => {
    const user = userEvent.setup();
    saveLastLocation([10, 10]);
    renderControl([layer({id: 'boundary', name: 'Site boundary'})]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );

    expect(
      screen.getByRole('img', {name: /of this layer/i})
    ).toBeInTheDocument();
    expect(screen.queryByText('On map')).not.toBeInTheDocument();
  });

  it('keeps stroke controls for vector tiles', async () => {
    const user = userEvent.setup();
    renderControl([layer({id: 'tiles', name: 'Tracks', kind: 'vector-tiles'})]);
    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );
    expect(screen.getByText('Vector tiles')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {name: 'Show style for Tracks'})
    );
    expect(
      screen.getByRole('slider', {name: 'Tracks line width'})
    ).toBeInTheDocument();
  });

  it('lists record form layers with the same vector paint controls', async () => {
    const user = userEvent.setup();
    const {onUpdateRecordLayer, updateLayer, fit} = renderControl(
      [],
      vi.fn(),
      vi.fn(),
      {
        recordLayers: [
          recordLayer({
            id: 'record-form:Site',
            formId: 'Site',
            name: 'Sites',
            visible: false,
            zIndex: 980,
          }),
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 0 of 1 shown/i})
    );
    expect(screen.getByText('Sites')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Show Sites'}));
    expect(onUpdateRecordLayer).toHaveBeenCalledWith('record-form:Site', {
      visible: true,
    });
    expect(updateLayer).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {name: 'Show style for Sites'})
    );
    expect(
      screen.getByRole('slider', {name: 'Sites opacity'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Sites line width'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Sites point size'})
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Pan Sites into view'}));
    expect(fit).toHaveBeenCalledOnce();
  });

  it('resets overlays, base maps, and record layers from the panel header', async () => {
    const user = userEvent.setup();
    const {
      resetLayers,
      onResetBaseLayers,
      onResetRecordLayers,
      updateLayer,
      onUpdateBaseLayer,
      onUpdateRecordLayer,
    } = renderControl(
      [layer({id: 'boundary', name: 'Site boundary', zIndex: 40})],
      vi.fn(),
      vi.fn(),
      {
        baseLayers: [
          {
            id: BASE_MAP_VECTOR_ID,
            name: 'Streets',
            visible: false,
            opacity: 0.4,
            zIndex: 12,
          },
          {
            id: BASE_MAP_SATELLITE_ID,
            name: 'Satellite',
            visible: true,
            opacity: 0.5,
            zIndex: 13,
          },
        ],
        recordLayers: [
          recordLayer({
            id: 'record-form:Site',
            formId: 'Site',
            name: 'Sites',
            visible: false,
            zIndex: 2,
          }),
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 2 of 4 shown/i})
    );
    await user.click(screen.getByRole('button', {name: 'Reset to defaults'}));

    expect(resetLayers).toHaveBeenCalledOnce();
    expect(onResetBaseLayers).toHaveBeenCalledOnce();
    expect(onResetRecordLayers).toHaveBeenCalledOnce();
    expect(updateLayer).not.toHaveBeenCalled();
    expect(onUpdateBaseLayer).not.toHaveBeenCalled();
    expect(onUpdateRecordLayer).not.toHaveBeenCalled();
  });

  it('reorders a record form layer against an overlay', async () => {
    const user = userEvent.setup();
    const {onUpdateRecordLayer, updateLayer} = renderControl(
      [layer({id: 'boundary', name: 'Site boundary', zIndex: 10})],
      vi.fn(),
      vi.fn(),
      {
        recordLayers: [
          recordLayer({
            id: 'record-form:Site',
            formId: 'Site',
            name: 'Sites',
            zIndex: 980,
          }),
        ],
      }
    );

    await user.click(
      screen.getByRole('button', {name: /map layers, 2 of 2 shown/i})
    );
    await user.click(screen.getByRole('button', {name: 'Lower Sites'}));
    expect(onUpdateRecordLayer).toHaveBeenCalledWith('record-form:Site', {
      zIndex: 10,
    });
    expect(updateLayer).toHaveBeenCalledWith('boundary', {zIndex: 980});
  });

  it('shows a create failure on the overlay row', async () => {
    const user = userEvent.setup();
    renderControl(
      [layer({id: 'boundary', name: 'Site boundary'})],
      vi.fn(),
      vi.fn(),
      {
        layerErrors: {
          boundary: 'Layer Site boundary has no tile reader.',
        },
      }
    );

    expect(
      screen.getByRole('button', {
        name: /map layers, 1 of 1 shown, 1 failed to load/i,
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: /map layers, 1 of 1 shown, 1 failed to load/i,
      })
    );

    expect(
      screen.getByText('Layer Site boundary has no tile reader.')
    ).toBeInTheDocument();
  });
});
