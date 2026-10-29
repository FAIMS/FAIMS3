// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import type {ContextualLayerListing} from '@faims3/data-model';
import {DEFAULT_MAP_ASSET_STYLE} from '@faims3/data-model';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {StoredContextualLayerSummary} from './contextualLayerStore';

const harness = vi.hoisted(() => ({
  stored: [] as StoredContextualLayerSummary[],
  layers: [] as ContextualLayerListing[],
  listError: undefined as Error | undefined,
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@faims3/forms', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/forms')>();
  return {
    ...actual,
    useOccasionalDeviceLocation: () => undefined,
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
                contextualLayers: harness.layers,
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
  CONTEXTUAL_LAYERS_CHANGED_EVENT: 'contextual-layers-changed',
  listStoredContextualLayers: () =>
    harness.listError
      ? Promise.reject(harness.listError)
      : Promise.resolve([...harness.stored]),
  downloadContextualLayers: harness.download,
  removeContextualLayerFromDevice: harness.remove,
  isContextualLayerDownloadCancelledError: (error: unknown) =>
    error instanceof Error &&
    error.name === 'ContextualLayerDownloadCancelledError',
}));

vi.mock('../ui/BackButton', () => ({
  default: () => <button type="button">Back</button>,
}));

import {ContextualLayerManager} from './ContextualLayerManager';

function layer(
  id: string,
  name: string,
  contentHash = 'hash-a'
): ContextualLayerListing {
  return {
    id,
    name,
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    extent: [0, 0, 1, 1],
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
  };
}

function stored(
  assetId: string,
  name: string,
  contentHash = 'hash-a'
): StoredContextualLayerSummary {
  return {
    assetId,
    name,
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    projectIds: ['survey-1'],
    extent4326: [0, 0, 1, 1],
  };
}

function renderManager() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <ContextualLayerManager />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('ContextualLayerManager', () => {
  beforeEach(() => {
    harness.stored = [];
    harness.layers = [];
    harness.listError = undefined;
    harness.download.mockReset().mockResolvedValue(undefined);
    harness.remove.mockReset().mockResolvedValue(undefined);
  });

  it('shows empty states when nothing is stored or available', async () => {
    renderManager();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-on-device-empty')
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId('map-layer-not-downloaded-empty')
    ).toBeInTheDocument();
    expect(
      screen.getByText('You currently have no map layers downloaded.')
    ).toBeInTheDocument();
  });

  it('lists stored layers', async () => {
    harness.stored = [stored('asset-ready', 'Site boundaries')];
    harness.layers = [layer('asset-ready', 'Site boundaries')];
    renderManager();

    await waitFor(() => {
      expect(screen.getByText('Site boundaries')).toBeInTheDocument();
    });
    expect(screen.getByText('Used by Creek survey')).toBeInTheDocument();
    expect(
      screen.getByTestId('map-layer-remove-asset-ready')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('map-layer-on-device-empty')
    ).not.toBeInTheDocument();
  });

  it('downloads a missing layer', async () => {
    const user = userEvent.setup();
    harness.layers = [layer('asset-new', 'Vegetation')];
    harness.download.mockImplementation(async ({layers}) => {
      harness.stored = layers.map((item: ContextualLayerListing) =>
        stored(item.id, item.name, item.contentHash)
      );
    });
    renderManager();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-download-asset-new')
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('map-layer-download-asset-new'));

    await waitFor(() => {
      expect(harness.download).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'survey-1',
          token: 'token',
          layers: [expect.objectContaining({id: 'asset-new'})],
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Vegetation')).toBeInTheDocument();
      expect(
        screen.queryByTestId('map-layer-download-asset-new')
      ).not.toBeInTheDocument();
    });
  });

  it('cancels an in-progress download and leaves the layer available', async () => {
    const user = userEvent.setup();
    harness.layers = [layer('asset-new', 'Vegetation')];
    harness.download.mockImplementation(
      ({signal}: {signal?: AbortSignal}) =>
        new Promise<void>((_resolve, reject) => {
          const onAbort = () => {
            const error = new Error('Map layer download cancelled.');
            error.name = 'ContextualLayerDownloadCancelledError';
            reject(error);
          };
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener('abort', onAbort, {once: true});
        })
    );
    renderManager();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-download-asset-new')
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('map-layer-download-asset-new'));

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-download-cancel')
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('map-layer-download-cancel'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('map-layer-download-cancel')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('map-layer-download-asset-new')
      ).toBeInTheDocument();
    });
  });

  it('confirms delete before removing a stored layer', async () => {
    const user = userEvent.setup();
    harness.stored = [stored('asset-ready', 'Site boundaries')];
    harness.remove.mockImplementation(async () => {
      harness.stored = [];
    });
    renderManager();

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
    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-on-device-empty')
      ).toBeInTheDocument();
    });
  });

  it('shows an error when stored layers cannot be loaded', async () => {
    harness.listError = new Error('Could not read map layers.');
    renderManager();

    await waitFor(() => {
      expect(
        screen.getByText('Could not read map layers.')
      ).toBeInTheDocument();
    });
  });
});
