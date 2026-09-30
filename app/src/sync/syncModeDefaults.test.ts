// SPDX-License-Identifier: Apache-2.0
import type {OfflineMapRegion} from '@faims3/data-model';
import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';

vi.mock('../context/slices/helpers/databaseHelpers', () => ({
  fetchNotebookDetails: vi.fn(),
}));

import {fetchNotebookDetails} from '../context/slices/helpers/databaseHelpers';
import {resolveActivationSyncMode} from './syncModeDefaults';

const mockFetchNotebookDetails = vi.mocked(fetchNotebookDetails);

const sampleOfflineMapRegion: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [150.0, -34.0],
      [151.0, -34.0],
      [151.0, -33.0],
      [150.0, -33.0],
      [150.0, -34.0],
    ],
  ],
};

describe('resolveActivationSyncMode', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {onLine: true});
    mockFetchNotebookDetails.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('still fetches details when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', {onLine: false});
    const details = {
      recordCount: 10,
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>;
    mockFetchNotebookDetails.mockResolvedValue(details);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(mockFetchNotebookDetails).toHaveBeenCalledWith({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });
    expect(result.details).toBe(details);
    expect(result.syncMode).toBe('both');
  });

  it('defaults to both when the API throws', async () => {
    mockFetchNotebookDetails.mockRejectedValue(new Error('network error'));

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('both');
    expect(result.usedPushOnlyDefault).toBe(false);
    expect(result.details).toBeUndefined();
  });

  it('uses push when record count exceeds threshold', async () => {
    const details = {
      recordCount: 999999,
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>;
    mockFetchNotebookDetails.mockResolvedValue(details);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('push');
    expect(result.usedPushOnlyDefault).toBe(true);
    expect(result.recordCount).toBe(999999);
    expect(result.details).toBe(details);
  });

  it('uses both when record count is below threshold', async () => {
    const details = {
      recordCount: 10,
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>;
    mockFetchNotebookDetails.mockResolvedValue(details);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('both');
    expect(result.usedPushOnlyDefault).toBe(false);
    expect(result.details).toBe(details);
  });

  it('passes through the full GET details payload on success', async () => {
    const details = {
      name: 'Survey One',
      recordCount: 3,
      uiDefinition: {uiSpec: {fields: {}}},
      uiSpecProperties: {schemaVersion: '1.0.0', hash: 'a'.repeat(64)},
      schemaCompatibility: {tier: 'compatible'},
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>;
    mockFetchNotebookDetails.mockResolvedValue(details);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.details).toBe(details);
    expect(result.details?.uiDefinition).toEqual(details.uiDefinition);
    expect(result.details?.uiSpecProperties).toEqual(details.uiSpecProperties);
  });

  it.each([
    {label: 'undefined', recordCount: undefined},
    {label: 'NaN', recordCount: Number.NaN},
  ])(
    'includes offline map region when record count is $label',
    async ({recordCount}) => {
      mockFetchNotebookDetails.mockResolvedValue({
        recordCount,
        offlineMapRegion: sampleOfflineMapRegion,
      } as Awaited<ReturnType<typeof fetchNotebookDetails>>);

      const result = await resolveActivationSyncMode({
        serverUrl: 'https://example.com',
        projectId: 'p1',
        token: 'token',
      });

      expect(result.syncMode).toBe('both');
      expect(result.usedPushOnlyDefault).toBe(false);
      expect(result.recordCount).toBeUndefined();
      expect(result.details).toEqual({
        recordCount,
        offlineMapRegion: sampleOfflineMapRegion,
      });
      expect(result.offlineMapRegion).toEqual(sampleOfflineMapRegion);
      expect(result.offlineMapRegionSynced).toBe(true);
    }
  );
});
