/**
 * @file projectOfflineMap.ts
 *
 * App-level orchestration for project-associated offline map downloads.
 *
 * Wraps {@link VectorTileStore} with a shared instance, stable `@project/:id`
 * tile-set names, download/cancel lifecycle, and plan-region reconciliation
 * used during activation and server metadata refresh.
 */

import type {OfflineMapRegion} from '@faims3/data-model';
import {
  deriveTileSetDownloadStatus,
  isOfflineMapDownloadCancelledError,
  offlineMapRegionToExtent3857,
  offlineMapRegionsEqual,
  projectOfflineMapSetName,
  type TileSetDownloadStatus,
  VectorTileStore,
} from '@faims3/forms';
import type {MapConfig} from '@faims3/forms';
import {getMapConfig} from '../../../buildconfig';

let sharedTileStore: VectorTileStore | undefined;
/** In-flight download promises keyed by project id (for cancel coordination). */
const activeProjectDownloads = new Map<string, Promise<void>>();

/** Lazily create the singleton tile store used for all project offline maps. */
function getSharedTileStore(
  config: MapConfig = getMapConfig()
): VectorTileStore {
  if (!sharedTileStore) {
    sharedTileStore = new VectorTileStore(config);
    void sharedTileStore.createBaselineTileSet();
  }
  return sharedTileStore;
}

/** DOM event name fired when a project download completes, is removed, or is cancelled. */
export const OFFLINE_MAP_DOWNLOAD_STATUS_CHANGED_EVENT =
  'offline-map-download-status-changed';

/** Notify listeners that a project offline map download status may have changed. */
export function notifyOfflineMapDownloadStatusChanged(projectId: string): void {
  dispatchEvent(
    new CustomEvent(OFFLINE_MAP_DOWNLOAD_STATUS_CHANGED_EVENT, {
      detail: {projectId},
    })
  );
}
/** Remove project-associated offline map tile sets from device storage. */
export async function removeProjectOfflineMaps(
  projectId: string
): Promise<void> {
  const tileStore = getSharedTileStore();
  await tileStore.tileStore.initDB();
  await tileStore.removeTileSetsForProject(projectId);
  notifyOfflineMapDownloadStatusChanged(projectId);
}

/** Start downloading the recommended offline map region for a project. */
export async function downloadProjectOfflineMap({
  projectId,
  projectName,
  region,
  config = getMapConfig(),
}: {
  /** Notebook id — used for tile-set naming and deactivation cleanup. */
  projectId: string;
  /** Notebook display name — used in the tile set label in the download list UI. */
  projectName: string;
  /** Plan region in EPSG:4326; also persisted on the tile set record. */
  region: OfflineMapRegion;
  config?: MapConfig;
}): Promise<void> {
  const tileStore = getSharedTileStore(config);
  await tileStore.tileStore.initDB();

  const extent3857 = offlineMapRegionToExtent3857(region);
  const setName = projectOfflineMapSetName(projectId);

  await tileStore.createTileSet(extent3857, setName, undefined, undefined, {
    projectId,
    label: `${projectName} default offline map`,
    replaceIfExists: true,
    offlineMapRegion: region,
  });
  const downloadPromise = tileStore.downloadTileSet(setName);
  activeProjectDownloads.set(projectId, downloadPromise);
  try {
    await downloadPromise;
    notifyOfflineMapDownloadStatusChanged(projectId);
  } finally {
    activeProjectDownloads.delete(projectId);
  }
}

/** Cancel an in-progress project download and remove any partial tile set. */
export async function cancelProjectOfflineMapDownload(
  projectId: string
): Promise<void> {
  const tileStore = getSharedTileStore();
  await tileStore.tileStore.initDB();
  const setName = projectOfflineMapSetName(projectId);

  const pendingDownload = activeProjectDownloads.get(projectId);
  if (pendingDownload) {
    tileStore.requestCancelDownloadTileSet(setName);
    try {
      await pendingDownload;
    } catch (error) {
      if (!isOfflineMapDownloadCancelledError(error)) {
        throw error;
      }
    }
    // In-flight tile writes may recreate a partial record after the download loop
    // removes it — always sweep once the download promise has settled.
    await removeProjectOfflineMaps(projectId);
    return;
  }

  const status = await getProjectOfflineMapStatus(projectId);
  if (status.state !== 'not_downloaded') {
    await removeProjectOfflineMaps(projectId);
  }
}

/** Estimated download size for a region, in megabytes (same units as {@link VectorTileStore.estimateSizeForRegion}). */
export async function estimateProjectOfflineMapSize(
  region: OfflineMapRegion,
  config: MapConfig = getMapConfig()
): Promise<number> {
  const tileStore = getSharedTileStore(config);
  const extent3857 = offlineMapRegionToExtent3857(region);
  return tileStore.estimateSizeForRegion(extent3857);
}

/** Download lifecycle for the `@project/:id` tile set on this device. */
export type ProjectOfflineMapStatus = TileSetDownloadStatus;

/** Read download status for a project-associated offline map tile set. */
export async function getProjectOfflineMapStatus(
  projectId: string,
  config: MapConfig = getMapConfig()
): Promise<ProjectOfflineMapStatus> {
  const tileStore = getSharedTileStore(config);
  await tileStore.tileStore.initDB();

  const setName = projectOfflineMapSetName(projectId);
  const tileSet = await tileStore.tileStore.tileSetDB.get([setName]);
  return deriveTileSetDownloadStatus(tileSet);
}

/** Read the offline map region stored on a completed or in-progress project download. */
export async function getDownloadedOfflineMapRegion(
  projectId: string,
  config: MapConfig = getMapConfig()
): Promise<OfflineMapRegion | undefined> {
  const tileStore = getSharedTileStore(config);
  await tileStore.tileStore.initDB();

  const setName = projectOfflineMapSetName(projectId);
  const tileSet = await tileStore.tileStore.tileSetDB.get([setName]);
  return tileSet?.offlineMapRegion;
}

export {offlineMapRegionsEqual};

/** Outcome of comparing a server plan region with local download state. */
export type OfflineMapRegionPlanChangeResult =
  | {action: 'none'}
  | {action: 'prompt'; isRegionUpdate: boolean}
  | {action: 'removed_stale_download'};

/**
 * Pure decision logic for reconciling a plan region change with local downloads.
 *
 * Does not touch storage — use {@link reconcileOfflineMapRegionPlanChange} to
 * apply side effects (remove stale tile sets) before prompting the user.
 */
export function resolveOfflineMapRegionPlanChange({
  previousRegion,
  nextRegion,
  hadDownload,
  downloadedRegion,
}: {
  previousRegion: OfflineMapRegion | undefined;
  nextRegion: OfflineMapRegion | undefined;
  hadDownload: boolean;
  downloadedRegion: OfflineMapRegion | undefined;
}): OfflineMapRegionPlanChangeResult {
  if (offlineMapRegionsEqual(previousRegion, nextRegion)) {
    return {action: 'none'};
  }

  // Plan removed the region — drop any stale local download.
  if (!nextRegion) {
    return hadDownload ? {action: 'removed_stale_download'} : {action: 'none'};
  }

  // First-time region on an activated project with no local download yet.
  if (!hadDownload) {
    if (nextRegion && !previousRegion) {
      return {action: 'prompt', isRegionUpdate: false};
    }
    return {action: 'none'};
  }

  // Local tiles already match the new plan — nothing to do.
  if (
    downloadedRegion &&
    offlineMapRegionsEqual(downloadedRegion, nextRegion)
  ) {
    return {action: 'none'};
  }

  // Region changed while a download exists — prompt for re-download.
  return {action: 'prompt', isRegionUpdate: true};
}

/**
 * Reconcile a project's offline map download with an updated plan region.
 *
 * When the plan region changes and a project-associated download exists, the
 * stale download is removed and the caller should prompt for a re-download.
 */
export async function reconcileOfflineMapRegionPlanChange({
  projectId,
  previousRegion,
  nextRegion,
}: {
  projectId: string;
  previousRegion: OfflineMapRegion | undefined;
  nextRegion: OfflineMapRegion | undefined;
}): Promise<OfflineMapRegionPlanChangeResult> {
  const status = await getProjectOfflineMapStatus(projectId);
  const hadDownload = status.state !== 'not_downloaded';
  const downloadedRegion = hadDownload
    ? await getDownloadedOfflineMapRegion(projectId)
    : undefined;

  const decision = resolveOfflineMapRegionPlanChange({
    previousRegion,
    nextRegion,
    hadDownload,
    downloadedRegion,
  });

  if (decision.action === 'removed_stale_download') {
    await removeProjectOfflineMaps(projectId);
  } else if (decision.action === 'prompt' && hadDownload) {
    await removeProjectOfflineMaps(projectId);
  }

  return decision;
}

/**
 * Whether an activation-time download prompt can be skipped.
 *
 * Returns true when a completed download exists and its stored region matches
 * the current plan region.
 */
export async function shouldSkipOfflineMapActivationPrompt(
  projectId: string,
  region: OfflineMapRegion
): Promise<boolean> {
  const status = await getProjectOfflineMapStatus(projectId);
  if (status.state !== 'downloaded') {
    return false;
  }
  const downloadedRegion = await getDownloadedOfflineMapRegion(projectId);
  return (
    downloadedRegion !== undefined &&
    offlineMapRegionsEqual(downloadedRegion, region)
  );
}
