// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import type {ContextualLayerListing} from '@faims3/data-model';
import {DEFAULT_MAP_ASSET_STYLE} from '@faims3/data-model';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {StoredContextualLayerSummary} from './contextualLayerStore';

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockRejectedValue(new Error('no gps')),
  },
}));

const harness = vi.hoisted(() => ({
  dispatch: vi.fn(),
  prompt: {projectId: 'survey-1', serverId: 'server-1'},
  stored: [] as StoredContextualLayerSummary[],
  layers: [] as ContextualLayerListing[],
  download: vi.fn(),
}));

vi.mock('../../../context/store', () => ({
  useAppDispatch: () => harness.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({projects: {}}),
}));

vi.mock('../../../context/slices/authSlice', () => ({
  selectActiveUser: () => ({
    serverId: 'server-1',
    token: 'token',
  }),
}));

vi.mock('../../../context/slices/projectSlice', () => ({
  selectPendingContextualLayerPrompt: () => harness.prompt,
  selectProjectByIdentity: () => ({
    projectId: 'survey-1',
    name: 'Creek survey',
    contextualLayersHash: 'hash-manifest',
    contextualLayers: harness.layers,
  }),
  serverById: () => ({
    serverId: 'server-1',
    serverUrl: 'http://localhost:8080',
  }),
  clearPendingContextualLayerPrompt: () => ({type: 'clear-prompt'}),
}));

vi.mock('./contextualLayerStore', () => ({
  listStoredContextualLayers: () => Promise.resolve(harness.stored),
  downloadContextualLayers: (...args: unknown[]) => harness.download(...args),
  forgetUnselectedContextualLayers: vi.fn(),
  markContextualLayersSeen: vi.fn(),
  notifyContextualLayersChanged: vi.fn(),
  isContextualLayerDownloadCancelledError: (error: unknown) =>
    error instanceof Error &&
    error.name === 'ContextualLayerDownloadCancelledError',
}));

import {ContextualLayerPrompt} from './ContextualLayerPrompt';

function layer(
  id: string,
  name: string,
  contentHash: string
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
  contentHash: string
): StoredContextualLayerSummary {
  return {
    assetId,
    name: assetId,
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    projectIds: ['survey-1'],
    extent4326: [0, 0, 1, 1],
  };
}

function renderPrompt() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ContextualLayerPrompt />
    </ThemeProvider>
  );
}

describe('ContextualLayerPrompt', () => {
  afterEach(() => {
    localStorage.clear();
  });

  beforeEach(() => {
    harness.dispatch.mockReset();
    harness.download.mockReset().mockResolvedValue(undefined);
    harness.prompt = {projectId: 'survey-1', serverId: 'server-1'};
    harness.layers = [
      layer('asset-ready', 'Site boundaries', 'hash-a'),
      layer('asset-new', 'Vegetation', 'hash-b'),
      layer('asset-stale', 'Tracks', 'hash-new'),
    ];
    harness.stored = [
      stored('asset-ready', 'hash-a'),
      stored('asset-stale', 'hash-old'),
    ];
  });

  it('groups already-downloaded layers apart from layers that still need a download', async () => {
    renderPrompt();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-group-on-device')
      ).toBeInTheDocument();
    });

    const onDevice = screen.getByTestId('map-layer-group-on-device');
    const toDownload = screen.getByTestId('map-layer-group-to-download');

    expect(onDevice).toHaveTextContent('Already on the device (1)');
    expect(onDevice).toHaveTextContent('Site boundaries');
    expect(onDevice).toHaveTextContent('Vector tiles');
    expect(screen.getByTestId('map-layer-size-asset-ready')).toHaveTextContent(
      '2 KB'
    );
    expect(screen.queryByText('On this device')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs download')).not.toBeInTheDocument();
    expect(
      screen.queryByText('0.000, 0.000, 1.000, 1.000')
    ).not.toBeInTheDocument();

    expect(toDownload).toHaveTextContent('Not yet downloaded (2)');
    expect(toDownload).toHaveTextContent('Vegetation');
    expect(toDownload).toHaveTextContent('Tracks');
    expect(
      screen.getByText(
        'This survey has contextual layers available for download. In order to view these layers in the map, you must download them to the device.'
      )
    ).toBeInTheDocument();
  });

  it('labels the selected action as keep when every ticked layer is already on the device', async () => {
    harness.layers = [layer('asset-ready', 'Site boundaries', 'hash-a')];
    harness.stored = [stored('asset-ready', 'hash-a')];
    renderPrompt();

    await waitFor(() => {
      expect(screen.getByText('Keep selected')).toBeInTheDocument();
    });
    expect(screen.getByText('Keep all')).toBeInTheDocument();
    expect(screen.queryByText('Not yet downloaded')).not.toBeInTheDocument();
  });

  it('shows a current-location dot when the device is on a layer', async () => {
    harness.layers = [layer('asset-ready', 'Site boundaries', 'hash-a')];
    harness.stored = [stored('asset-ready', 'hash-a')];
    localStorage.setItem('last_map_center', JSON.stringify([0.5, 0.5]));
    renderPrompt();

    await waitFor(() => {
      expect(screen.getByText('On map')).toBeInTheDocument();
      expect(
        screen.getByRole('img', {name: 'Current location is on this layer'})
      ).toBeInTheDocument();
    });
  });

  it('shows a cancel control while downloading and keeps the prompt open', async () => {
    const user = userEvent.setup();
    let release!: (error?: Error) => void;
    const held = new Promise<void>((resolve, reject) => {
      release = error => (error ? reject(error) : resolve());
    });
    harness.download.mockImplementation(
      ({signal}: {signal?: AbortSignal}) =>
        new Promise<void>((resolve, reject) => {
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
          void held.then(resolve).catch(reject);
        })
    );

    renderPrompt();
    await waitFor(() => {
      expect(screen.getByText('Download selected')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('map-layer-download-cancel')
    ).not.toBeInTheDocument();

    await user.click(screen.getByText('Download selected'));

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-download-progress')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('map-layer-download-cancel')
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('map-layer-download-cancel'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('map-layer-download-progress')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Download selected')).toBeInTheDocument();
    });
    expect(
      screen.getByTestId('map-layer-activation-prompt')
    ).toBeInTheDocument();
    expect(harness.dispatch).not.toHaveBeenCalled();
    release();
  });
});
