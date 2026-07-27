/**
 * Singleton service to manage sync state for projects.
 * Keeps sync status in-memory without Redux overhead.
 */

export interface SyncState {
  status: 'initial' | 'active' | 'paused' | 'error' | 'denied';
  lastUpdated: number;
  pendingRecords: number;
  /**
   * Has the pull side caught up with the remote since this state was created
   * (activation or app start)? False from creation through the initial
   * download, whatever order push and pull batches interleave in; true after
   * a pull change event reports nothing pending or replication pauses
   * cleanly; false again while a later bulk pull works through its batches.
   * Consumers use this to tell "records may still be arriving" from "local
   * data is as complete as sync can make it".
   */
  isPullCaughtUp: boolean;
  errorMessage?: string;
  lastChangeStats?: {
    docsRead: number;
    docsWritten: number;
    direction: 'push' | 'pull';
  };
}

export type SyncStateKey = `${string}:${string}`; // serverId:projectId

class SyncStateService {
  private static instance: SyncStateService;
  private syncStates: Map<SyncStateKey, SyncState> = new Map();

  private constructor() {}

  static getInstance(): SyncStateService {
    if (!SyncStateService.instance) {
      SyncStateService.instance = new SyncStateService();
    }
    return SyncStateService.instance;
  }

  private buildKey(serverId: string, projectId: string): SyncStateKey {
    return `${serverId}:${projectId}`;
  }

  /**
   * Get the current sync state for a project
   */
  getSyncState(serverId: string, projectId: string): SyncState | undefined {
    return this.syncStates.get(this.buildKey(serverId, projectId));
  }

  /**
   * Get sync state, returning a default initial state if none exists
   */
  getSyncStateOrDefault(serverId: string, projectId: string): SyncState {
    return (
      this.getSyncState(serverId, projectId) ?? this.createInitialSyncState()
    );
  }

  /**
   * Update sync state for a project (partial update, merges with existing)
   */
  updateSyncState(
    serverId: string,
    projectId: string,
    update: Partial<SyncState>
  ): SyncState {
    const key = this.buildKey(serverId, projectId);
    const current = this.syncStates.get(key) ?? this.createInitialSyncState();
    const updated: SyncState = {
      ...current,
      ...update,
      lastUpdated: Date.now(),
    };
    this.syncStates.set(key, updated);
    return updated;
  }

  /**
   * Set sync state to active
   */
  setActive(serverId: string, projectId: string): SyncState {
    return this.updateSyncState(serverId, projectId, {
      status: 'active',
      errorMessage: undefined,
    });
  }

  /**
   * Set sync state to paused
   */
  setPaused(serverId: string, projectId: string, error?: Error): SyncState {
    if (error) {
      return this.updateSyncState(serverId, projectId, {
        status: 'error',
        errorMessage: error.message,
      });
    }
    return this.updateSyncState(serverId, projectId, {
      status: 'paused',
      errorMessage: undefined,
    });
  }

  /**
   * Record that the PULL side paused, which is the only pause that may raise
   * the pull-catch-up marker.
   *
   * A clean pull pause means the pull is idle with nothing left to fetch, so
   * the pull is caught up even if it never emitted a change event (nothing to
   * pull). A pull that paused with an error is retrying, not finished, so it
   * leaves the marker where it is.
   *
   * Deliberately NOT folded into {@link setPaused}: in two-way mode the
   * aggregate `paused` event arrives with the child's error stripped by
   * PouchDB's sync wrapper, so a device that went offline mid-download is
   * indistinguishable there from one that finished. Reading that as a
   * catch-up is exactly the false "no records here" state consumers must
   * never see. Status stays owned by {@link setPaused}; this moves only the
   * marker.
   */
  recordPullPause(serverId: string, projectId: string, error?: Error): void {
    if (error) {
      return;
    }
    this.updateSyncState(serverId, projectId, {isPullCaughtUp: true});
  }

  /**
   * Set sync state to error
   */
  setError(serverId: string, projectId: string, error: Error): SyncState {
    return this.updateSyncState(serverId, projectId, {
      status: 'error',
      errorMessage: error.message,
    });
  }

  /**
   * Set sync state to denied
   */
  setDenied(serverId: string, projectId: string, error: Error): SyncState {
    return this.updateSyncState(serverId, projectId, {
      status: 'denied',
      errorMessage: error.message,
    });
  }

  /**
   * Record a change event
   */
  recordChange(
    serverId: string,
    projectId: string,
    info: {
      /**
       * Documents the remote still has queued for this direction, or
       * undefined when the replication did not report it (PouchDB only fills
       * `pending` in when the source supplies it).
       */
      pending: number | undefined;
      docsRead: number;
      docsWritten: number;
      direction: 'push' | 'pull';
    }
  ): SyncState {
    const update: Partial<SyncState> = {
      status: 'active',
      pendingRecords: info.pending ?? 0,
      errorMessage: undefined,
      lastChangeStats: {
        docsRead: info.docsRead,
        docsWritten: info.docsWritten,
        direction: info.direction,
      },
    };
    // Only a pull batch moves the pull-catch-up marker: caught up when the
    // batch reports nothing pending, behind while a bulk pull still has
    // batches to go. Push batches say nothing about the pull side, so they
    // leave the marker alone (in 'both' mode the two interleave through the
    // same event stream).
    //
    // An unreported `pending` is "unknown", NOT "nothing pending": reading it
    // as zero would let the first batch of a bulk download declare the pull
    // caught up, which is precisely the mid-download blindness this marker
    // exists to remove. Staying behind is safe because replication is live
    // with retry, so a genuinely idle pull raises the marker via the clean
    // pull pause in {@link recordPullPause}.
    if (info.direction === 'pull') {
      update.isPullCaughtUp = info.pending === 0;
    }
    return this.updateSyncState(serverId, projectId, update);
  }

  /**
   * Remove sync state for a project (call on deactivate/remove)
   */
  removeSyncState(serverId: string, projectId: string): void {
    this.syncStates.delete(this.buildKey(serverId, projectId));
  }

  /**
   * Remove all sync states for a server
   */
  removeServerSyncStates(serverId: string): void {
    const prefix = `${serverId}:`;
    for (const key of this.syncStates.keys()) {
      if (key.startsWith(prefix)) {
        this.syncStates.delete(key);
      }
    }
  }

  /**
   * Clear all sync states
   */
  clear(): void {
    this.syncStates.clear();
  }

  /**
   * Create initial sync state
   */
  private createInitialSyncState(): SyncState {
    return {
      status: 'initial',
      lastUpdated: Date.now(),
      pendingRecords: 0,
      isPullCaughtUp: false,
    };
  }
}

export const syncStateService = SyncStateService.getInstance();
