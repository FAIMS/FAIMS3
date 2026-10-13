// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type Map from 'ol/Map';
import {describe, expect, it, vi} from 'vitest';
import {INPUT_LIMITS} from '@faims3/data-model';
import {ContextualLayersControl} from './ContextualLayersControl';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from './contextualMapLayers';

const theme = createTheme();

function layer(
  patch: Partial<ContextualMapLayer> & Pick<ContextualMapLayer, 'id' | 'name'>
): ContextualMapLayer {
  return {
    kind: 'geojson',
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

function renderControl(
  layers: ContextualMapLayer[],
  updateLayer = vi.fn(),
  moveLayer = vi.fn()
) {
  const fit = vi.fn();
  const map = {
    getView: () => ({fit}),
    getTargetElement: () => document.createElement('div'),
  } as unknown as Map;
  render(
    <ThemeProvider theme={theme}>
      <ContextualMapLayersContext.Provider
        value={{layers, updateLayer, moveLayer}}
      >
        <ContextualLayersControl map={map} />
      </ContextualMapLayersContext.Provider>
    </ThemeProvider>
  );
  return {fit, updateLayer, moveLayer};
}

describe('ContextualLayersControl', () => {
  it('keeps style controls collapsed until the section is opened', async () => {
    const user = userEvent.setup();
    renderControl([layer({id: 'boundary', name: 'Site boundary'})]);

    await user.click(
      screen.getByRole('button', {name: /map layers, 1 of 1 shown/i})
    );

    expect(
      screen.queryByRole('slider', {name: 'Site boundary opacity'})
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {name: 'Show style for Site boundary'})
    );

    expect(
      screen.getByRole('slider', {name: 'Site boundary opacity'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Site boundary line width'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Site boundary label field')).toHaveAttribute(
      'maxLength',
      String(INPUT_LIMITS.ID_MAX_LENGTH)
    );
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
    const {fit, updateLayer, moveLayer} = renderControl([
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
    expect(moveLayer).toHaveBeenCalledWith('lower', 'up');
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
});
