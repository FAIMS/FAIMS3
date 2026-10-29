// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockRejectedValue(new Error('no gps')),
  },
}));

vi.mock('./useContextualMapLayers', () => ({
  useContextualMapLayers: () => ({layerErrors: {}}),
  createContextualMapLayer: vi.fn(),
}));

import {InteractiveMapLayerPreview} from './InteractiveMapLayerPreview';
import {readBaseMapLayersState, writeBaseMapLayersState} from './baseMapLayers';

const theme = createTheme();

function renderPreview() {
  return render(
    <ThemeProvider theme={theme}>
      <InteractiveMapLayerPreview
        id="layer-1"
        name="Survey sites"
        url="pmtiles:layer-1"
        kind="vector-tiles"
        extent4326={[150, -34, 151, -33]}
        style={{
          stroke: '#1565c0',
          fill: '#1565c040',
          lineWidth: 2,
          pointSize: 6,
          opacity: 0.85,
        }}
        mapConfig={{
          mapSource: 'osm',
          mapSourceKey: '',
          mapStyle: 'basic',
        }}
      />
    </ThemeProvider>
  );
}

describe('InteractiveMapLayerPreview', () => {
  afterEach(() => {
    localStorage.clear();
    document.body.style.overflow = '';
  });

  it('unlocks map controls and the layers sheet', async () => {
    const user = userEvent.setup();
    renderPreview();

    await waitFor(() => {
      expect(
        screen.getByTestId('interactive-map-layer-preview')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId('interactive-map-layer-preview-canvas')
    ).toHaveStyle({height: 'clamp(380px, 55dvh, 650px)'});

    expect(screen.getByRole('button', {name: 'Zoom in'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Zoom out'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Open full screen map'})
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {name: /Map layers, 2 of 3 shown/})
    );

    expect(
      screen.getByRole('dialog', {name: 'Map layers'})
    ).toBeInTheDocument();
    expect(screen.getByText('Survey sites')).toBeInTheDocument();
    expect(screen.getByText('Streets')).toBeInTheDocument();
    expect(screen.getByText('Satellite')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {name: 'Show style for Survey sites'})
    );
    expect(screen.getByLabelText('Survey sites opacity')).toBeInTheDocument();
    expect(screen.getByLabelText('Survey sites stroke')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {name: 'Show style for Streets'})
    );
    expect(screen.getByLabelText('Streets opacity')).toBeInTheDocument();
  });

  it('does not persist styling changes from the layers sheet', async () => {
    const user = userEvent.setup();
    writeBaseMapLayersState({
      vector: {visible: true, opacity: 0.3, zIndex: 0},
      satellite: {visible: false, opacity: 1, zIndex: 1},
    });
    const storedBefore = localStorage.getItem('map-base-layer-prefs');
    renderPreview();

    await user.click(
      await screen.findByRole('button', {name: /Map layers, 2 of 3 shown/})
    );
    await user.click(screen.getByRole('button', {name: 'Hide Streets'}));

    expect(localStorage.getItem('map-base-layer-prefs')).toBe(storedBefore);
    expect(readBaseMapLayersState().vector.visible).toBe(true);
    expect(readBaseMapLayersState().vector.opacity).toBe(0.3);
  });
});
