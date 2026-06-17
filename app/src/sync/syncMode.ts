/** Record replication direction for an activated notebook. */
export type SyncMode = 'none' | 'push' | 'pull' | 'both';

export type ReplicatingSyncMode = Exclude<SyncMode, 'none'>;

export const SYNC_MODES_WITH_REPLICATION: SyncMode[] = ['push', 'pull', 'both'];

export function isReplicating(
  syncMode: SyncMode
): syncMode is ReplicatingSyncMode {
  return syncMode !== 'none';
}

export function syncModeIncludesPull(syncMode: SyncMode): boolean {
  return syncMode === 'pull' || syncMode === 'both';
}

export function syncModeIncludesPush(syncMode: SyncMode): boolean {
  return syncMode === 'push' || syncMode === 'both';
}

/** Migrate legacy persisted `isSyncing` boolean to {@link SyncMode}. */
export function syncModeFromLegacyIsSyncing(isSyncing: boolean): SyncMode {
  return isSyncing ? 'both' : 'none';
}

export const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  none: 'Sync off (local device only)',
  push: 'Upload only',
  pull: 'Download only',
  both: 'Upload and download',
};
