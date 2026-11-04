// SPDX-License-Identifier: Apache-2.0
/**
 * Device catalog for on-device map layers.
 * One record per asset id. A file is deleted only when no activated survey
 * still lists it.
 */

export type StoredLayerRef = {
  assetId: string;
  contentHash: string;
  filename: string;
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
 * Survey membership is the listing, not this record.
 */
export function assignDownloadedLayer<T extends StoredLayerRef>(
  files: LayerFileIndex<T>,
  incoming: T
): LayerFileIndex<T> {
  return {
    ...files,
    [incoming.assetId]: incoming,
  };
}

/**
 * Keep only assets in the ready listing union.
 * That listing omits pending, replacing, and failed assets on purpose: a
 * withdrawn overlay is not kept as last-good.
 */
export function retainListedLayers<T extends StoredLayerRef>(
  files: LayerFileIndex<T>,
  listedAssetIds: Iterable<string>
): LayerFileIndex<T> {
  const listed = new Set(listedAssetIds);
  const next: LayerFileIndex<T> = {};
  for (const file of Object.values(files)) {
    if (listed.has(file.assetId)) {
      next[file.assetId] = file;
    }
  }
  return next;
}

/**
 * Union of listed asset ids. An omitted listing (`undefined`) means the
 * keep-set is unknown — callers must not delete files from an uncertain set.
 */
export function unionListedAssetIds(
  listings: ReadonlyArray<readonly string[] | undefined>
): {keepIds: string[]; uncertain: boolean} {
  const keep = new Set<string>();
  let uncertain = false;
  for (const listing of listings) {
    if (!listing) {
      uncertain = true;
      continue;
    }
    for (const id of listing) {
      keep.add(id);
    }
  }
  return {keepIds: [...keep], uncertain};
}

export type ActivatedSurveyLayerSource = {
  projectId: string;
  contextualLayers?: ReadonlyArray<{id: string}>;
};

/**
 * Device keep-set from activated surveys. `listingByProjectId` overrides the
 * survey's last-known listing (directory refresh). A present override of
 * `undefined` is an omitted attach and makes the set uncertain.
 */
export function collectActivatedLayerKeepSet(
  surveys: Iterable<ActivatedSurveyLayerSource>,
  listingByProjectId?: ReadonlyMap<string, readonly string[] | undefined>
): {keepIds: string[]; uncertain: boolean} {
  const listings: Array<readonly string[] | undefined> = [];
  for (const survey of surveys) {
    if (listingByProjectId?.has(survey.projectId)) {
      listings.push(listingByProjectId.get(survey.projectId));
    } else {
      listings.push(survey.contextualLayers?.map(layer => layer.id));
    }
  }
  return unionListedAssetIds(listings);
}

/** Flatten activated surveys from every server. */
export function activatedSurveysFromServers(
  servers: Record<
    string,
    {activated: Record<string, ActivatedSurveyLayerSource>}
  >
): ActivatedSurveyLayerSource[] {
  const surveys: ActivatedSurveyLayerSource[] = [];
  for (const server of Object.values(servers)) {
    surveys.push(...Object.values(server.activated));
  }
  return surveys;
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
