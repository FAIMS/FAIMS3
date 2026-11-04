// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import {
  DEFAULT_MAP_ASSET_STYLE,
  type ContextualLayerListing,
} from '@faims3/data-model';
import type {ContextualMapLayer} from '@faims3/forms';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {StoredContextualLayerSummary} from './contextualLayerStore';

const harness = vi.hoisted(() => ({
  assetId: 'asset-ready' as string | undefined,
  layer: undefined as ContextualMapLayer | undefined,
  loadError: undefined as Error | undefined,
  load: vi.fn(),
  summaries: [] as StoredContextualLayerSummary[],
  listings: [] as ContextualLayerListing[],
  download: vi.fn(),
  remove: vi.fn(),
  previewProps: undefined as
    | {
        style: {opacity: number};
        baseLayer: unknown;
        satelliteLayer: unknown;
      }
    | undefined,
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
    InteractiveMapLayerPreview: (props: {
      style: {opacity: number};
      baseLayer: unknown;
      satelliteLayer: unknown;
    }) => {
      harness.previewProps = props;
      return <div data-testid="interactive-layer-preview" />;
    },
    VectorTileStore: class {
      getTileLayer() {
        return {name: 'cached-streets'};
      }
      hasSatellite() {
        return false;
      }
      getSatelliteLayer() {
        return undefined;
      }
    },
  };
});

vi.mock('../../../context/store', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      projects: {
        servers: {
          'server-1': {
            serverId: 'server-1',
            serverUrl: 'http://localhost:8080',
            listed: {},
            activated: {
              'survey-1': {
                projectId: 'survey-1',
                name: 'Creek survey',
                contextualLayers: harness.listings,
              },
            },
          },
        },
      },
      auth: {
        isAuthenticated: true,
        servers: {},
        activeUser: {serverId: 'server-1', token: 'token'},
      },
    }),
}));

vi.mock('../../../context/slices/authSlice', () => ({
  selectActiveUser: (state: {auth: {activeUser: unknown}}) =>
    state.auth.activeUser,
  isTokenValid: () => true,
}));

vi.mock('./contextualLayerStore', () => ({
  loadStoredContextualLayer: harness.load,
  listStoredContextualLayers: () => Promise.resolve([...harness.summaries]),
  downloadContextualLayers: harness.download,
  removeContextualLayerFromDevice: harness.remove,
  isContextualLayerDownloadCancelledError: (error: unknown) =>
    error instanceof Error &&
    error.name === 'ContextualLayerDownloadCancelledError',
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

function summary(contentHash = 'hash-a'): StoredContextualLayerSummary {
  return {
    assetId: 'asset-ready',
    name: 'Site boundaries',
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    extent4326: [0, 0, 1, 1],
  };
}

function listing(contentHash: string): ContextualLayerListing {
  return {
    id: 'asset-ready',
    name: 'Site boundaries',
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    extent: [0, 0, 1, 1],
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
  };
}

describe('ContextualLayerPreview', () => {
  beforeEach(() => {
    harness.assetId = 'asset-ready';
    harness.layer = storedLayer;
    harness.loadError = undefined;
    harness.summaries = [summary()];
    harness.listings = [listing('hash-a')];
    harness.previewProps = undefined;
    harness.download.mockReset().mockResolvedValue(undefined);
    harness.remove.mockReset().mockResolvedValue(undefined);
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
    expect(screen.getByTestId('interactive-layer-preview')).toBeInTheDocument();
    // Cached streets are the base layer; with no satellite source configured
    // the preview explicitly offers no satellite layer. The overlay opens at
    // the stored layer's (default) opacity.
    expect(harness.previewProps?.baseLayer).toEqual({
      name: 'cached-streets',
    });
    expect(harness.previewProps?.satelliteLayer).toBeNull();
    expect(harness.previewProps?.style.opacity).toBe(storedLayer.opacity);
    expect(
      screen.queryByTestId('map-layer-preview-error')
    ).not.toBeInTheDocument();
  });

  it('shows details and the remove action for a stored layer', async () => {
    renderPreview();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-remove-asset-ready')
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Linked to: 'Creek survey'")).toBeInTheDocument();
    // No newer listing, so no update action.
    expect(
      screen.queryByTestId('map-layer-update-asset-ready')
    ).not.toBeInTheDocument();
  });

  it('confirms delete before removing a stored layer', async () => {
    const user = userEvent.setup();
    renderPreview();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-remove-asset-ready')
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('map-layer-remove-asset-ready'));
    expect(screen.getByText('Remove map layer')).toBeInTheDocument();
    await user.click(screen.getByTestId('map-layer-delete-confirm'));

    await waitFor(() => {
      expect(harness.remove).toHaveBeenCalledWith('asset-ready');
    });
  });

  it('offers and downloads an update when a newer file is listed', async () => {
    const user = userEvent.setup();
    harness.listings = [listing('hash-b')];
    renderPreview();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-update-asset-ready')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('A newer file is available.')).toBeInTheDocument();
    await user.click(screen.getByTestId('map-layer-update-asset-ready'));

    await waitFor(() => {
      expect(harness.download).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'survey-1',
          token: 'token',
          layers: [expect.objectContaining({id: 'asset-ready'})],
        })
      );
    });
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
