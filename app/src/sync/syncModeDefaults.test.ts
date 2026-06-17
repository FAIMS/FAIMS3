import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';

vi.mock('../context/slices/helpers/databaseHelpers', () => ({
  fetchNotebookDetails: vi.fn(),
}));

import {fetchNotebookDetails} from '../context/slices/helpers/databaseHelpers';
import {resolveActivationSyncMode} from './syncModeDefaults';

const mockFetchNotebookDetails = vi.mocked(fetchNotebookDetails);

describe('resolveActivationSyncMode', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {onLine: true});
    mockFetchNotebookDetails.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to both when offline without calling the API', async () => {
    vi.stubGlobal('navigator', {onLine: false});

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('both');
    expect(mockFetchNotebookDetails).not.toHaveBeenCalled();
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
  });

  it('uses push when record count exceeds threshold', async () => {
    mockFetchNotebookDetails.mockResolvedValue({
      recordCount: 999999,
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('push');
    expect(result.usedPushOnlyDefault).toBe(true);
    expect(result.recordCount).toBe(999999);
  });

  it('uses both when record count is below threshold', async () => {
    mockFetchNotebookDetails.mockResolvedValue({
      recordCount: 10,
    } as Awaited<ReturnType<typeof fetchNotebookDetails>>);

    const result = await resolveActivationSyncMode({
      serverUrl: 'https://example.com',
      projectId: 'p1',
      token: 'token',
    });

    expect(result.syncMode).toBe('both');
    expect(result.usedPushOnlyDefault).toBe(false);
  });
});
