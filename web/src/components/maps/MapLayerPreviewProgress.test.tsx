// SPDX-License-Identifier: Apache-2.0
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {MapAssetPreviewState} from '@/lib/map-asset-preview-cache';
import {
  MapLayerPreviewProgress,
  MapLayerPreviewTabProgress,
} from './MapLayerPreviewProgress';

function download(
  overrides: Partial<MapAssetPreviewState> = {}
): MapAssetPreviewState {
  return {
    status: 'downloading',
    receivedBytes: 0,
    totalBytes: 0,
    fromCache: false,
    ...overrides,
  };
}

describe('MapLayerPreviewTabProgress', () => {
  it('shows a percent while bytes are arriving', () => {
    render(
      <MapLayerPreviewTabProgress
        download={download({receivedBytes: 25, totalBytes: 100})}
      />
    );
    expect(
      screen.getByTestId('web-map-layer-preview-tab-progress').textContent
    ).toBe('25%');
  });

  it('shows an ellipsis when the size is unknown', () => {
    render(
      <MapLayerPreviewTabProgress
        download={download({receivedBytes: 10, totalBytes: 0})}
      />
    );
    expect(
      screen.getByTestId('web-map-layer-preview-tab-progress').textContent
    ).toBe('…');
  });

  it('hides the tab trigger while not downloading', () => {
    const {container} = render(
      <MapLayerPreviewTabProgress
        download={download({
          status: 'ready',
          receivedBytes: 100,
          totalBytes: 100,
        })}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('MapLayerPreviewProgress', () => {
  it('shows downloading copy, percent, and the bar when size is known', () => {
    render(
      <MapLayerPreviewProgress
        download={download({
          receivedBytes: 256 * 1024,
          totalBytes: 1024 * 1024,
        })}
      />
    );
    expect(screen.getByText('Downloading preview')).toBeDefined();
    expect(
      screen.getByText(
        'This layer is 1 MB. The file is downloaded once and reused when you return to this tab.'
      )
    ).toBeDefined();
    expect(screen.getByText('256 KB of 1 MB (25%)')).toBeDefined();
    expect(
      screen
        .getByRole('progressbar', {name: 'Preview download'})
        .getAttribute('aria-valuenow')
    ).toBe('25');
  });

  it('shows preparing copy and an indeterminate bar when size is unknown', () => {
    render(<MapLayerPreviewProgress download={download()} />);
    expect(screen.getByText('Preparing preview')).toBeDefined();
    expect(
      screen.getByText(
        'The layer file is downloaded once and reused when you return to this tab.'
      )
    ).toBeDefined();
    expect(screen.getByText('Starting download…')).toBeDefined();
    expect(
      screen.getByRole('progressbar', {name: 'Preview download'})
    ).toBeDefined();
  });

  it('hides the bar for a cached copy and uses the opening heading', () => {
    render(
      <MapLayerPreviewProgress
        download={download({
          status: 'ready',
          receivedBytes: 1024 * 1024,
          totalBytes: 1024 * 1024,
          fromCache: true,
        })}
      />
    );
    expect(screen.getByText('Opening preview')).toBeDefined();
    expect(
      screen.getByText('Using the 1 MB copy already stored in this browser.')
    ).toBeDefined();
    expect(
      screen.queryByRole('progressbar', {name: 'Preview download'})
    ).toBeNull();
  });

  it('uses the opening heading when the download is ready', () => {
    render(
      <MapLayerPreviewProgress
        download={download({
          status: 'ready',
          receivedBytes: 1024,
          totalBytes: 1024,
        })}
      />
    );
    expect(screen.getByText('Opening preview')).toBeDefined();
    expect(
      screen
        .getByRole('progressbar', {name: 'Preview download'})
        .getAttribute('aria-valuenow')
    ).toBe('100');
  });
});
