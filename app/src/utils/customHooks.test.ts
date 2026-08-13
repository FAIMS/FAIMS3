import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {syncStateService} from '../context/slices/helpers/syncStateService';
import type {SyncMode} from '../sync/syncMode';
import {useIsRecordDownloadUnderway} from './customHooks';

// The hook reads the sync state service, not the redux store, but importing
// its module pulls the store in, which initialises its slices in the wrong
// order from a test entry point.
vi.mock('../context/store', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));

/**
 * The failure is silent in both directions: false too early presents a
 * half-downloaded notebook as a complete one, true forever means an offline
 * device never shows the data it already has.
 */
describe('useIsRecordDownloadUnderway', () => {
  const serverId = 'server';
  const projectId = 'project';

  /** Longer than the hook's poll interval, so one tick has certainly run. */
  const PAST_ONE_POLL_MS = 1500;

  beforeEach(() => {
    vi.useFakeTimers();
    syncStateService.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderForSyncMode = (syncMode: SyncMode) =>
    renderHook(() =>
      useIsRecordDownloadUnderway({serverId, projectId, syncMode})
    );

  /** Let the hook's poll pick up a change made outside React. */
  const poll = () =>
    act(() => {
      vi.advanceTimersByTime(PAST_ONE_POLL_MS);
    });

  const pullBatch = (pending: number | undefined) =>
    syncStateService.recordChange(serverId, projectId, {
      pending,
      docsRead: 1,
      docsWritten: 1,
      direction: 'pull',
    });

  it('reads as downloading from the very first render of a pulling project', () => {
    // Nothing heard from replication yet: when a consumer is most likely to
    // mistake an empty local database for an empty notebook.
    const {result} = renderForSyncMode('both');
    expect(result.current).toBe(true);
  });

  it('stops reading as downloading once the pull reports nothing pending', () => {
    const {result} = renderForSyncMode('both');
    pullBatch(0);
    poll();
    expect(result.current).toBe(false);
  });

  it('reads as downloading again when a later bulk pull arrives', () => {
    // Starts from caught up, so this is the fall-behind transition rather
    // than the not-yet-heard-from state of the first render.
    const {result} = renderForSyncMode('pull');
    pullBatch(0);
    poll();
    expect(result.current).toBe(false);
    pullBatch(40);
    poll();
    expect(result.current).toBe(true);
    pullBatch(0);
    poll();
    expect(result.current).toBe(false);
  });

  it('never reads as downloading when the project cannot pull', () => {
    // Sync off or push-only: waiting on a download that will not come would
    // blank the consumer permanently.
    for (const syncMode of ['none', 'push'] as const) {
      const {result} = renderForSyncMode(syncMode);
      expect(result.current).toBe(false);
      poll();
      expect(result.current).toBe(false);
    }
  });

  it('reads as not downloading on a sync error, so an offline device still shows its data', () => {
    const {result} = renderForSyncMode('both');
    expect(result.current).toBe(true);
    syncStateService.setError(serverId, projectId, new Error('offline'));
    poll();
    expect(result.current).toBe(false);
  });

  it('reads as not downloading when sync is denied', () => {
    const {result} = renderForSyncMode('both');
    syncStateService.setDenied(serverId, projectId, new Error('forbidden'));
    poll();
    expect(result.current).toBe(false);
  });

  it('stops polling once unmounted', () => {
    // A notebook opened and closed repeatedly would otherwise accumulate one
    // live poll per visit.
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const clearInterval = vi.spyOn(globalThis, 'clearInterval');
    const {unmount} = renderForSyncMode('both');
    const intervalId = setInterval.mock.results[0].value;
    unmount();
    expect(clearInterval).toHaveBeenCalledWith(intervalId);
    setInterval.mockRestore();
    clearInterval.mockRestore();
  });
});
