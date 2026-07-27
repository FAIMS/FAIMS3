import {beforeEach, describe, expect, it} from 'vitest';
import {syncStateService} from './syncStateService';

/**
 * The pull-catch-up marker tells consumers (useIsRecordDownloadUnderway)
 * whether records may still be arriving from the server. It must stay false
 * through the initial download whatever order push and pull batches
 * interleave in, and only a pull's own signals may raise it. Each of the
 * three ways to get that wrong has bitten this code and has a test below:
 * deriving it from the last change event goes blind whenever a push batch or
 * a stale previous cycle holds the stats slot; reading an unreported
 * `pending` as zero lets the first batch of a bulk download declare victory;
 * and trusting the AGGREGATE pause event believes an offline device has
 * finished, because PouchDB.sync strips the child's error before re-emitting.
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
    // PouchDB omits `pending` whenever the source does not supply it. Reading
    // that as zero would let the first batch of a bulk download declare the
    // pull caught up, reinstating the mid-download blindness the marker
    // exists to remove.
    syncStateService.recordChange(
      serverId,
      projectId,
      changeInfo('pull', undefined)
    );
    expect(marker()).toBe(false);
  });

  it('still catches up via the clean pause when pending is never reported', () => {
    // The safety net for the case above: live replication with retry pauses
    // cleanly once it is idle, so an unreported `pending` delays the
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
    // The display counter has no "unknown" to show, so it keeps its old
    // zero default; only the catch-up marker distinguishes the two.
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
    // PouchDB.sync's wrapper re-emits its children's pause with the error
    // stripped, so a device that went offline mid-download reaches the
    // aggregate `paused` handler looking exactly like an idle, finished one.
    // Only the pull side's own pause may raise the marker.
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
    // The marker means "the pull has caught up at least once since this state
    // was created"; a later retryable blip does not make already-downloaded
    // records disappear.
    syncStateService.recordPullPause(serverId, projectId);
    expect(marker()).toBe(true);
    syncStateService.recordPullPause(serverId, projectId, new Error('offline'));
    expect(marker()).toBe(true);
  });

  it('push batches never mask an incomplete pull (both-mode interleaving)', () => {
    // Initial download in 'both' mode: push runs first, then the pull works
    // through its batches. The marker must not read caught-up until the pull
    // itself finishes.
    syncStateService.setActive(serverId, projectId);
    syncStateService.recordChange(serverId, projectId, changeInfo('push', 0));
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 10));
    syncStateService.recordChange(serverId, projectId, changeInfo('push', 0));
    expect(marker()).toBe(false);
    syncStateService.recordChange(serverId, projectId, changeInfo('pull', 0));
    expect(marker()).toBe(true);
  });
});
