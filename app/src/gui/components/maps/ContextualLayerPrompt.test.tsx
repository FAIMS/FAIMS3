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
  markSeen: vi.fn(),
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
  markContextualLayersSeen: (...args: unknown[]) => harness.markSeen(...args),
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
    harness.markSeen.mockReset().mockResolvedValue(undefined);
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

  it('lists only layers that still need a download', async () => {
    renderPrompt();

    await waitFor(() => {
      expect(
        screen.getByTestId('map-layer-group-to-download')
      ).toBeInTheDocument();
    });

    const toDownload = screen.getByTestId('map-layer-group-to-download');

    expect(toDownload).toHaveTextContent('Available for download (2)');
    expect(toDownload).toHaveTextContent('Vegetation');
    expect(toDownload).toHaveTextContent('Tracks');
    expect(toDownload).toHaveTextContent('Vector tiles');
    expect(screen.getByTestId('map-layer-size-asset-new')).toHaveTextContent(
      '2 KB'
    );
    expect(screen.queryByText('Already on the device')).not.toBeInTheDocument();
    expect(screen.queryByText('Site boundaries')).not.toBeInTheDocument();
    expect(screen.queryByText('On this device')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs download')).not.toBeInTheDocument();
    expect(
      screen.queryByText('0.000, 0.000, 1.000, 1.000')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Keep all')).not.toBeInTheDocument();
    expect(screen.queryByText('Keep selected')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This survey has associated map layers which are available to assist with collection. Please select the layers below you'd like to download to your device. Downloaded layers will be available offline."
      )
    ).toBeInTheDocument();
  });

  it('closes without downloading when every linked layer is already on the device', async () => {
    harness.layers = [layer('asset-ready', 'Site boundaries', 'hash-a')];
    harness.stored = [stored('asset-ready', 'hash-a')];
    renderPrompt();

    await waitFor(() => {
      expect(harness.dispatch).toHaveBeenCalledWith({type: 'clear-prompt'});
    });
    expect(harness.markSeen).toHaveBeenCalledWith('survey-1', 'hash-manifest');
    expect(harness.download).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('map-layer-activation-prompt')
    ).not.toBeInTheDocument();
  });

  it('closes without starting a download', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('map-layer-prompt-close'));

    expect(harness.download).not.toHaveBeenCalled();
    expect(harness.dispatch).toHaveBeenCalledWith({type: 'clear-prompt'});
  });

  it('updates the download label when layers are unselected', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', {name: 'Unselect all'}));
    expect(
      screen.getByRole('button', {name: 'Download (0 layers)'})
    ).toBeDisabled();

    await user.click(screen.getByRole('button', {name: 'Select all'}));
    expect(
      screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
    ).toBeEnabled();

    await user.click(screen.getByTestId('map-layer-choice-asset-new'));
    expect(
      screen.getByRole('button', {name: 'Download (1 layer, 2 KB)'})
    ).toBeInTheDocument();
  });

  it('shows a current-location distance when the device is on a layer', async () => {
    harness.layers = [layer('asset-new', 'Vegetation', 'hash-b')];
    harness.stored = [];
    localStorage.setItem('last_map_center', JSON.stringify([0.5, 0.5]));
    renderPrompt();

    await waitFor(() => {
      expect(screen.getByText('0m away')).toBeInTheDocument();
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
      expect(
        screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('map-layer-download-cancel')
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
    );

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
      expect(
        screen.getByRole('button', {name: 'Download (2 layers, 4 KB)'})
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId('map-layer-activation-prompt')
    ).toBeInTheDocument();
    expect(harness.dispatch).not.toHaveBeenCalled();
    release();
  });
});
