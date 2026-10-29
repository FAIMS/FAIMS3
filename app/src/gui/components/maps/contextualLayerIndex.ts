// SPDX-License-Identifier: Apache-2.0
/**
 * Reference counts for on-device map layers.
 * One record per asset id. A file is deleted only when no survey still lists it.
 */

export type StoredLayerRef = {
  assetId: string;
  contentHash: string;
  filename: string;
  projectIds: string[];
};

export type LayerFileIndex<T extends StoredLayerRef> = Record<string, T>;

/** Filenames present before and absent after an index update. */
export function filenamesToDelete<T extends StoredLayerRef>(
  previous: LayerFileIndex<T>,
  next: LayerFileIndex<T>
): string[] {
  const kept = new Set(Object.values(next).map(file => file.filename));
  const removed: string[] = [];
  for (const file of Object.values(previous)) {
    if (!kept.has(file.filename) && !removed.includes(file.filename)) {
      removed.push(file.filename);
    }
  }
  return removed;
}

/**
 * Store one copy of an asset. A new content hash replaces that copy.
 * Other surveys that already reference the asset keep their reference.
 */
export function assignDownloadedLayer<T extends StoredLayerRef>(
  files: LayerFileIndex<T>,
  projectId: string,
  incoming: T
): LayerFileIndex<T> {
  const existing = files[incoming.assetId];
  const projectIds = existing
    ? Array.from(new Set([...existing.projectIds, projectId]))
    : [projectId];
  return {
    ...files,
    [incoming.assetId]: {...incoming, projectIds},
  };
}

/**
 * Drop this survey from assets absent from the ready listing.
 * That listing omits pending, replacing, and failed assets on purpose: a
 * withdrawn overlay is not kept as last-good. A file shared with another
 * survey stays.
 */
export function retainListedLayers<T extends StoredLayerRef>(
  files: LayerFileIndex<T>,
  projectId: string,
  listedAssetIds: Iterable<string>
): LayerFileIndex<T> {
  const listed = new Set(listedAssetIds);
  const next: LayerFileIndex<T> = {...files};
  for (const file of Object.values(files)) {
    if (!file.projectIds.includes(projectId) || listed.has(file.assetId)) {
      continue;
    }
    const projectIds = file.projectIds.filter(id => id !== projectId);
    if (projectIds.length === 0) {
      delete next[file.assetId];
    } else {
      next[file.assetId] = {...file, projectIds};
    }
  }
  return next;
}

/** Drop every reference from one survey. Delete a file only when it was the last. */
export function releaseProjectLayers<T extends StoredLayerRef>(
  files: LayerFileIndex<T>,
  projectId: string
): LayerFileIndex<T> {
  return retainListedLayers(files, projectId, []);
}

/** How a listed layer compares with the copy stored on this device, if any. */
export type LayerDeviceStatus = 'on-device' | 'update' | 'not-downloaded';

/**
 * Whether this listed layer is already stored, needs a newer file, or is
 * missing from the device.
 */
export function layerDeviceStatus(
  layer: {id: string; contentHash: string},
  storedById: ReadonlyMap<string, {contentHash: string}>
): LayerDeviceStatus {
  const file = storedById.get(layer.id);
  if (!file) {
    return 'not-downloaded';
  }
  return file.contentHash === layer.contentHash ? 'on-device' : 'update';
}
