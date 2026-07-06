import type {OfflineMapRegion} from '@faims3/data-model';
import {
  isOfflineMapDownloadCancelledError,
  offlineMapRegionToExtent4326,
  offlineMapRegionsEqual,
  projectOfflineMapSetName,
  VectorTileStore,
} from '@faims3/forms';
import {transformExtent} from 'ol/proj';
import type {MapConfig} from '@faims3/forms';
import {getMapConfig} from '../../../buildconfig';

let sharedTileStore: VectorTileStore | undefined;
const activeProjectDownloads = new Map<string, Promise<void>>();

function getSharedTileStore(
  config: MapConfig = getMapConfig()
): VectorTileStore {
  if (!sharedTileStore) {
    sharedTileStore = new VectorTileStore(config);
    void sharedTileStore.createBaselineTileSet();
  }
  return sharedTileStore;
}

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
  projectId: string;
  projectName: string;
  region: OfflineMapRegion;
  config?: MapConfig;
}): Promise<void> {
  const tileStore = getSharedTileStore(config);
  await tileStore.tileStore.initDB();

  const extent4326 = offlineMapRegionToExtent4326(region);
  const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  const setName = projectOfflineMapSetName(projectId);

  await tileStore.createTileSet(extent3857, setName, undefined, undefined, {
    projectId,
    label: projectName,
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

export async function estimateProjectOfflineMapSize(
  region: OfflineMapRegion,
  config: MapConfig = getMapConfig()
): Promise<number> {
  const tileStore = getSharedTileStore(config);
  const extent4326 = offlineMapRegionToExtent4326(region);
  const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  return tileStore.estimateSizeForRegion(extent3857);
}

export function formatOfflineMapSizeMb(sizeMb: number): string {
  if (sizeMb > 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb.toFixed(2)} MB`;
}

export function formatOfflineMapSizeBytes(sizeBytes: number): string {
  return formatOfflineMapSizeMb(sizeBytes / 1024 / 1024);
}

export type ProjectOfflineMapStatus =
  | {state: 'not_downloaded'}
  | {state: 'downloading'; progress: number}
  | {state: 'downloaded'; sizeBytes: number};

/** Read download status for a project-associated offline map tile set. */
export async function getProjectOfflineMapStatus(
  projectId: string,
  config: MapConfig = getMapConfig()
): Promise<ProjectOfflineMapStatus> {
  const tileStore = getSharedTileStore(config);
  await tileStore.tileStore.initDB();

  const setName = projectOfflineMapSetName(projectId);
  const tileSet = await tileStore.tileStore.tileSetDB.get([setName]);
  if (!tileSet) {
    return {state: 'not_downloaded'};
  }

  if (
    tileSet.expectedTileCount > 0 &&
    tileSet.tileKeys.length >= tileSet.expectedTileCount
  ) {
    return {state: 'downloaded', sizeBytes: tileSet.size};
  }

  if (tileSet.expectedTileCount > 0) {
    return {
      state: 'downloading',
      progress: tileSet.tileKeys.length / tileSet.expectedTileCount,
    };
  }

  return {state: 'not_downloaded'};
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

export type OfflineMapRegionPlanChangeResult =
  | {action: 'none'}
  | {action: 'prompt'; isRegionUpdate: boolean}
  | {action: 'removed_stale_download'};

/** Pure decision logic for reconciling a plan region change with local downloads. */
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

  if (!nextRegion) {
    return hadDownload ? {action: 'removed_stale_download'} : {action: 'none'};
  }

  if (!hadDownload) {
    return {action: 'none'};
  }

  if (
    downloadedRegion &&
    offlineMapRegionsEqual(downloadedRegion, nextRegion)
  ) {
    return {action: 'none'};
  }

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

  if (
    decision.action === 'removed_stale_download' ||
    decision.action === 'prompt'
  ) {
    await removeProjectOfflineMaps(projectId);
  }

  return decision;
}

/** Whether an activation-time download prompt can be skipped. */
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
