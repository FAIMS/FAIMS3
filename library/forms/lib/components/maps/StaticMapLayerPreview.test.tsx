// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {beforeAll, describe, expect, it, vi} from 'vitest';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

vi.mock('./useContextualMapLayers', () => ({
  createContextualMapLayer: vi.fn(async () => {
    return new VectorLayer({source: new VectorSource()});
  }),
}));

import {StaticMapLayerPreview} from './StaticMapLayerPreview';

const theme = createTheme();
const style = {
  stroke: '#1565c0',
  fill: '#1565c040',
  lineWidth: 2,
  pointSize: 6,
  opacity: 0.85,
};
const mapConfig = {
  mapSource: 'osm' as const,
  mapSourceKey: '',
  mapStyle: 'basic' as const,
};

describe('StaticMapLayerPreview', () => {
  it('shows an error when the layer has no extent to fit', async () => {
    render(
      <ThemeProvider theme={theme}>
        <StaticMapLayerPreview
          url=""
          kind="vector-tiles"
          style={style}
          mapConfig={mapConfig}
        />
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(
        screen.getByText('This layer has no extent to fit.')
      ).toBeInTheDocument();
    });
  });

  it('renders a fitted canvas when an extent is supplied', async () => {
    const {container} = render(
      <ThemeProvider theme={theme}>
        <StaticMapLayerPreview
          url="pmtiles:layer-1"
          kind="vector-tiles"
          extent4326={[150, -34, 151, -33]}
          style={style}
          mapConfig={mapConfig}
        />
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(
        screen.queryByText('This layer has no extent to fit.')
      ).not.toBeInTheDocument();
    });
    expect(container.querySelector('.ol-viewport')).toBeTruthy();
  });
});
