// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import type {ContextualMapLayer} from '@faims3/forms';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const harness = vi.hoisted(() => ({
  assetId: 'asset-ready' as string | undefined,
  layer: undefined as ContextualMapLayer | undefined,
  loadError: undefined as Error | undefined,
  load: vi.fn(),
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({assetId: harness.assetId}),
  };
});

vi.mock('../../../buildconfig', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../buildconfig')>();
  return {
    ...actual,
    getMapConfig: () => ({}),
  };
});

vi.mock('@faims3/forms', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/forms')>();
  return {
    ...actual,
    StaticMapLayerPreview: () => <div data-testid="static-layer-preview" />,
    VectorTileStore: class {
      getTileLayer() {
        return {};
      }
    },
  };
});

vi.mock('./contextualLayerStore', () => ({
  loadStoredContextualLayer: harness.load,
}));

vi.mock('../ui/BackButton', () => ({
  default: () => <button type="button">Back</button>,
}));

import {ContextualLayerPreview} from './ContextualLayerPreview';

const storedLayer: ContextualMapLayer = {
  id: 'asset-ready',
  name: 'Site boundaries',
  kind: 'vector-tiles',
  url: 'blob:layer',
  visible: true,
  opacity: 1,
  zIndex: 1,
  stroke: '#1565c0',
  fill: '#1565c080',
  lineWidth: 2,
  pointSize: 6,
  extent4326: [0, 0, 1, 1],
};

function renderPreview() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <ContextualLayerPreview />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('ContextualLayerPreview', () => {
  beforeEach(() => {
    harness.assetId = 'asset-ready';
    harness.layer = storedLayer;
    harness.loadError = undefined;
    harness.load.mockReset();
    harness.load.mockImplementation(async () => {
      if (harness.loadError) {
        throw harness.loadError;
      }
      return harness.layer;
    });
  });

  it('renders a stored layer', async () => {
    renderPreview();

    await waitFor(() => {
      expect(screen.getByText('Site boundaries')).toBeInTheDocument();
    });
    expect(screen.getByTestId('static-layer-preview')).toBeInTheDocument();
    expect(
      screen.queryByTestId('map-layer-preview-error')
    ).not.toBeInTheDocument();
  });

  it('shows a missing-layer error when the file is not on the device', async () => {
    harness.layer = undefined;
    renderPreview();

    await waitFor(() => {
      expect(screen.getByTestId('map-layer-preview-error')).toHaveTextContent(
        'This map layer is not on the device.'
      );
    });
  });

  it('shows a load error', async () => {
    harness.loadError = new Error('Could not open the layer.');
    renderPreview();

    await waitFor(() => {
      expect(screen.getByTestId('map-layer-preview-error')).toHaveTextContent(
        'Could not open the layer.'
      );
    });
  });
});
