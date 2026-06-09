import {SYNC_PUSH_ONLY_RECORD_THRESHOLD} from '../buildconfig';
import {fetchNotebookDetails} from '../context/slices/helpers/databaseHelpers';
import type {SyncMode} from './syncMode';

export interface ActivationSyncModeResult {
  syncMode: SyncMode;
  recordCount?: number;
  usedPushOnlyDefault: boolean;
}

/**
 * Resolve initial sync mode at notebook activation from server record count.
 * Offline or API failure → two-way sync (`both`).
 */
export async function resolveActivationSyncMode({
  serverUrl,
  projectId,
  token,
}: {
  serverUrl: string;
  projectId: string;
  token: string;
}): Promise<ActivationSyncModeResult> {
  if (!navigator.onLine) {
    return {syncMode: 'both', usedPushOnlyDefault: false};
  }

  try {
    const details = await fetchNotebookDetails({
      serverUrl,
      projectId,
      token,
    });
    const recordCount = details.recordCount;
    if (recordCount === undefined || Number.isNaN(recordCount)) {
      return {syncMode: 'both', usedPushOnlyDefault: false};
    }
    if (recordCount > SYNC_PUSH_ONLY_RECORD_THRESHOLD) {
      return {
        syncMode: 'push',
        recordCount,
        usedPushOnlyDefault: true,
      };
    }
    return {syncMode: 'both', recordCount, usedPushOnlyDefault: false};
  } catch {
    return {syncMode: 'both', usedPushOnlyDefault: false};
  }
}
