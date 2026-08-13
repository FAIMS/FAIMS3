/**
 * Singleton service to manage sync state for projects.
 * Keeps sync status in-memory without Redux overhead.
 */

export interface SyncState {
  status: 'initial' | 'active' | 'paused' | 'error' | 'denied';
  lastUpdated: number;
  pendingRecords: number;
  /**
   * Has the pull side caught up with the remote since this state was created?
   * False through the initial download, true once a pull reports nothing
   * pending or pauses cleanly. Lets consumers tell "records may still be
   * arriving" from "local data is as complete as sync can make it".
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
   * Record that the PULL side paused, the only pause that may raise the
   * pull-catch-up marker: a clean pull pause means nothing is left to fetch,
   * while one carrying an error is retrying, not finished.
   *
   * Kept out of {@link setPaused} because the aggregate `paused` of a two-way
   * sync arrives with the child's error stripped, so an offline device would
   * look finished. Moves only the marker; status stays with {@link setPaused}.
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
      /** Undefined when the source did not report it, which is not zero. */
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
    // Only a pull batch moves the marker; push batches say nothing about the
    // pull side. An unreported `pending` stays behind rather than reading as
    // zero, which would let the first batch of a bulk download declare
    // catch-up; a genuinely idle pull raises it via {@link recordPullPause}.
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
