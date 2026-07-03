import type {OfflineMapRegion} from '@faims3/data-model';
import {
  offlineMapRegionToExtent4326,
  projectOfflineMapSetName,
  VectorTileStore,
} from '@faims3/forms';
import {transformExtent} from 'ol/proj';
import type {MapConfig} from '@faims3/forms';
import {getMapConfig} from '../../../buildconfig';

let sharedTileStore: VectorTileStore | undefined;

function getSharedTileStore(config: MapConfig = getMapConfig()): VectorTileStore {
  if (!sharedTileStore) {
    sharedTileStore = new VectorTileStore(config);
    void sharedTileStore.createBaselineTileSet();
  }
  return sharedTileStore;
}

/** Remove project-associated offline map tile sets from device storage. */
export async function removeProjectOfflineMaps(projectId: string): Promise<void> {
  const tileStore = getSharedTileStore();
  await tileStore.tileStore.initDB();
  await tileStore.removeTileSetsForProject(projectId);
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
  });
  await tileStore.downloadTileSet(setName);
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
