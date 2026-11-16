// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
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
    watchPosition: vi.fn().mockResolvedValue('watch-1'),
    clearWatch: vi.fn().mockResolvedValue(undefined),
    getCurrentPosition: vi.fn().mockRejectedValue(new Error('no gps')),
  },
}));

vi.mock('../../hooks/useLocation', () => ({
  useCurrentLocation: () => ({data: undefined}),
  getCoordinates: () => undefined,
}));

vi.mock('./tileDB/TileStore', () => ({
  createTileStore: () => {
    const layer = new TileLayer({source: new OSM()});
    return {
      getTileLayer: () => layer,
      hasSatellite: () => false,
      getSatelliteLayer: () => undefined,
      getAttribution: () => '',
      getSatelliteAttribution: () => '',
    };
  },
}));

import {MapComponent} from './MapComponent';

const theme = createTheme();

function renderMap() {
  const parentSetMap = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <div style={{height: 400, width: 400}}>
          <MapComponent
            config={{
              mapSource: 'osm',
              mapSourceKey: '',
              mapStyle: 'basic',
            }}
            parentSetMap={parentSetMap}
            enableFullscreen
            autoFlyToCurrentLocation={false}
          />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
  return {parentSetMap};
}

describe('MapComponent fullscreen', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('expands the mounted map into a lightbox and closes it', async () => {
    const user = userEvent.setup();
    const {parentSetMap} = renderMap();

    await waitFor(() => expect(parentSetMap).toHaveBeenCalled());

    await user.click(
      await screen.findByRole('button', {name: 'Open full screen map'})
    );

    expect(
      screen.getByRole('dialog', {name: 'Full screen map'})
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(
      screen.getByRole('button', {name: 'Close full screen map'})
    );

    expect(
      screen.queryByRole('dialog', {name: 'Full screen map'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Open full screen map'})
    ).toBeInTheDocument();
  });
});
