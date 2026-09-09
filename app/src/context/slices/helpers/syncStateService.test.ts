import {beforeEach, describe, expect, it} from 'vitest';
import {syncStateService} from './syncStateService';

/**
 * The pull-catch-up marker tells consumers (useIsRecordDownloadUnderway)
 * whether records may still be arriving. It must stay false through the
 * initial download whatever order push and pull batches interleave in, and
 * only a pull's own signals may raise it.
 */
describe('syncStateService pull-catch-up marker', () => {
  const serverId = 'server';
  const projectId = 'project';

  const changeInfo = (
    direction: 'push' | 'pull',
    pending: number | undefined
  ) => ({
    pending,
    docsRead: 1,
    docsWritten: 1,
    direction,
  });

  const marker = () =>
    syncStateService.getSyncStateOrDefault(serverId, projectId).isPullCaughtUp;

  beforeEach(() => {
    syncStateService.clear();
  });

  it('starts not caught up', () => {
    expect(marker()).toBe(false);
  });

  it('stays not caught up through active and push batches', () => {
    syncStateService.setActive(serverId, projectId);
    expect(marker()).toBe(false);
    syncStateService.recordChange(serverId, projectId, changeInfo('push', 0));
    expect(marker()).toBe(false);
  });

  it('stays not caught up while a pull still has batches pending', () => {
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 42));
    expect(marker()).toBe(false);
  });

  it('catches up when a pull batch reports nothing pending', () => {
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 0));
    expect(marker()).toBe(true);
  });

  it('stays not caught up when a pull batch does not report pending at all', () => {
    syncStateService.recordChange(
      serverId,
      projectId,
      changeInfo('pull', undefined)
    );
    expect(marker()).toBe(false);
  });

  it('still catches up via the clean pause when pending is never reported', () => {
    // The safety net for the case above: an unreported `pending` delays the
    // catch-up rather than withholding it forever.
    syncStateService.recordChange(
      serverId,
      projectId,
      changeInfo('pull', undefined)
    );
    syncStateService.recordPullPause(serverId, projectId);
    expect(marker()).toBe(true);
  });

  it('reports an unknown pending count as zero pending records', () => {
    // The display counter has no "unknown" to show, so it keeps its old zero
    // default.
    syncStateService.recordChange(
      serverId,
      projectId,
      changeInfo('pull', undefined)
    );
    expect(
      syncStateService.getSyncStateOrDefault(serverId, projectId).pendingRecords
    ).toBe(0);
  });

  it('catches up on a clean pause, even with nothing to pull', () => {
    syncStateService.setActive(serverId, projectId);
    syncStateService.recordPullPause(serverId, projectId);
    expect(marker()).toBe(true);
  });

  it('falls behind again while a later bulk pull works through batches', () => {
    syncStateService.recordPullPause(serverId, projectId);
    expect(marker()).toBe(true);
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 7));
    expect(marker()).toBe(false);
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 0));
    expect(marker()).toBe(true);
  });

  it('keeps the marker across errors: an errored pause reports the error, not a catch-up', () => {
    syncStateService.setPaused(serverId, projectId, new Error('offline'));
    const state = syncStateService.getSyncStateOrDefault(serverId, projectId);
    expect(state.status).toBe('error');
    expect(state.isPullCaughtUp).toBe(false);
  });

  it('an aggregate clean pause never raises the marker', () => {
    // The aggregate arrives with the error stripped, so an offline device
    // looks exactly like an idle, finished one there.
    syncStateService.setActive(serverId, projectId);
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 25));
    syncStateService.setPaused(serverId, projectId);
    expect(marker()).toBe(false);
  });

  it('an errored pull pause leaves the marker behind (retrying, not finished)', () => {
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 25));
    syncStateService.recordPullPause(serverId, projectId, new Error('offline'));
    expect(marker()).toBe(false);
  });

  it('an errored pull pause does not undo an earlier catch-up', () => {
    // A retryable blip does not make already-downloaded records disappear.
    syncStateService.recordPullPause(serverId, projectId);
    expect(marker()).toBe(true);
    syncStateService.recordPullPause(serverId, projectId, new Error('offline'));
    expect(marker()).toBe(true);
  });

  it('push batches never mask an incomplete pull (both-mode interleaving)', () => {
    // Initial download in 'both' mode: push runs first, then the pull works
    // through its batches.
    syncStateService.setActive(serverId, projectId);
    syncStateService.recordChange(serverId, projectId, changeInfo('push', 0));
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 10));
    syncStateService.recordChange(serverId, projectId, changeInfo('push', 0));
    expect(marker()).toBe(false);
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 0));
    expect(marker()).toBe(true);
  });
});
