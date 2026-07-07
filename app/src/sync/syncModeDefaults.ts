/**
 * @file syncModeDefaults.ts
 *
 * **Activation-time** defaults for record replication mode.
 *
 * When a user activates a notebook, the app must choose an initial
 * {@link SyncMode} before live PouchDB replication starts. This module applies a
 * single heuristic: compare the server's record count (from
 * `GET /api/notebooks/:id`) against {@link SYNC_PUSH_ONLY_RECORD_THRESHOLD}.
 *
 * ## Threshold
 *
 * Configured in `buildconfig.ts` as `SYNC_PUSH_ONLY_RECORD_THRESHOLD`
 * (override via `VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD`; default **500**). The
 * default is intentionally conservative — two-way sync of a few hundred
 * records is usually fine on mobile, but downloading thousands of existing
 * records can stress storage, bandwidth, and battery. Above the threshold,
 * activation defaults to **upload only** (`push`) so the device uploads new work
 * without pulling the full server dataset.
 *
 * Users can change mode later in Settings. If activation lands on `both` despite
 * a large notebook (offline/error path), the record-list
 * {@link ../gui/components/notebook/PushOnlySyncBanner} nudges them toward upload
 * only once `recordCount` is known.
 *
 * This runs **once per activation** only; ongoing sync mode changes go through
 * `setSyncMode` in `projectSlice`.
 */

import {SYNC_PUSH_ONLY_RECORD_THRESHOLD} from '../buildconfig';
import {fetchNotebookDetails} from '../context/slices/helpers/databaseHelpers';
import type {OfflineMapRegion} from '@faims3/data-model';
import type {SyncMode} from './syncMode';

/** Result of {@link resolveActivationSyncMode} for `activateProject`. */
export interface ActivationSyncModeResult {
  /** Initial replication mode to register with PouchDB. */
  syncMode: SyncMode;
  /** Server record count when the activation API call succeeded. */
  recordCount?: number;
  /** Recommended offline map region from the server when known. */
  offlineMapRegion?: OfflineMapRegion;
  /**
   * True when {@link offlineMapRegion} was read from the server during activation
   * (including when the server has no region configured).
   */
  offlineMapRegionSynced?: boolean;
  /**
   * True when sync was set to `push` because count exceeded the threshold.
   * Used to show the post-activation "Sync mode changed" snackbar.
   */
  usedPushOnlyDefault: boolean;
}

/**
 * Resolve initial sync mode when a notebook is activated.
 *
 * Fetches notebook details when online and compares `recordCount` to
 * {@link SYNC_PUSH_ONLY_RECORD_THRESHOLD}. Never throws — any failure or
 * ambiguous count falls back to two-way sync (`both`).
 *
 * @param serverUrl Base URL for the listing server
 * @param projectId Notebook id to activate
 * @param token JWT for `GET /api/notebooks/:id`
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
    const offlineMapFromServer = {
      offlineMapRegion: details.offlineMapRegion,
      offlineMapRegionSynced: true as const,
    };
    if (recordCount === undefined || Number.isNaN(recordCount)) {
      return {
        syncMode: 'both',
        usedPushOnlyDefault: false,
        ...offlineMapFromServer,
      };
    }
    if (recordCount > SYNC_PUSH_ONLY_RECORD_THRESHOLD) {
      return {
        syncMode: 'push',
        recordCount,
        usedPushOnlyDefault: true,
        ...offlineMapFromServer,
      };
    }
    return {
      syncMode: 'both',
      recordCount,
      usedPushOnlyDefault: false,
      ...offlineMapFromServer,
    };
  } catch {
    return {syncMode: 'both', usedPushOnlyDefault: false};
  }
}
