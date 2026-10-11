// SPDX-License-Identifier: Apache-2.0
/**
 * mapAssets documents, links, and the survey listing manifest.
 */

import {createHash} from 'crypto';
import {
  buildContextualLayersHash,
  companionAttachmentName,
  ContextualLayerListing,
  DEFAULT_MAP_ASSET_STYLE,
  ExistingMapAsset,
  ExistingMapAssetLink,
  MAP_ASSET_DOC_TYPE,
  MAP_ASSET_LINK_DOC_TYPE,
  MAP_ASSET_LINKS_BY_ASSET,
  MAP_ASSET_LINKS_BY_PROJECT,
  MAP_ASSET_NORMALIZED_ATTACHMENT,
  MAP_ASSET_ORIGINAL_ATTACHMENT,
  MAP_ASSETS_BY_CREATOR,
  MAP_ASSETS_BY_TEAM,
  MapAssetFields,
  MapAssetLinkFields,
  MapAssetStyle,
} from '@faims3/data-model';
import {randomUUID} from 'crypto';
import {getMapAssetsDB} from '..';
import * as Exceptions from '../../exceptions';
import {normalizeMapUpload, UploadedMapFile} from './normalize';

type AttachmentDb = {
  getAttachment(docId: string, attachmentId: string): Promise<Buffer | Blob>;
};

function attachmentDb() {
  return getMapAssetsDB() as unknown as AttachmentDb;
}

async function asBuffer(data: Buffer | Blob): Promise<Buffer> {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  return Buffer.from(await data.arrayBuffer());
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

function isAsset(doc: {
  _id?: string;
  docType?: string;
}): doc is ExistingMapAsset {
  return doc.docType === MAP_ASSET_DOC_TYPE;
}

function isLink(doc: {docType?: string}): doc is ExistingMapAssetLink {
  return doc.docType === MAP_ASSET_LINK_DOC_TYPE;
}

export async function getMapAsset(assetId: string): Promise<ExistingMapAsset> {
  try {
    const doc = await getMapAssetsDB().get(assetId);
    if (!isAsset(doc)) {
      throw new Exceptions.ItemNotFoundException(
        `Map asset ${assetId} was not found.`
      );
    }
    return doc;
  } catch (error) {
    if (error instanceof Exceptions.ItemNotFoundException) {
      throw error;
    }
    const status = (error as {status?: number}).status;
    if (status === 404) {
      throw new Exceptions.ItemNotFoundException(
        `Map asset ${assetId} was not found.`
      );
    }
    throw error;
  }
}

async function queryIds(view: string, key: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<number | string>(view, {
    key,
    include_docs: false,
  });
  return result.rows
    .map(row => row.id)
    .filter((id): id is string => Boolean(id));
}

export async function listAssetsByTeam(
  teamId: string
): Promise<ExistingMapAsset[]> {
  const ids = await queryIds(MAP_ASSETS_BY_TEAM, teamId);
  return loadAssets(ids);
}

export async function listAssetsByCreator(
  userId: string
): Promise<ExistingMapAsset[]> {
  const ids = await queryIds(MAP_ASSETS_BY_CREATOR, userId);
  return loadAssets(ids);
}

async function loadAssets(ids: string[]): Promise<ExistingMapAsset[]> {
  const assets: ExistingMapAsset[] = [];
  for (const id of ids) {
    try {
      assets.push(await getMapAsset(id));
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  return assets;
}

export async function listLinkProjectIds(assetId: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<string>(
    MAP_ASSET_LINKS_BY_ASSET,
    {
      key: assetId,
      include_docs: false,
    }
  );
  return result.rows
    .map(row => row.value)
    .filter((value): value is string => typeof value === 'string');
}

export async function listLinkAssetIds(projectId: string): Promise<string[]> {
  const result = await getMapAssetsDB().query<string>(
    MAP_ASSET_LINKS_BY_PROJECT,
    {key: projectId, include_docs: false}
  );
  return result.rows
    .map(row => row.value)
    .filter((value): value is string => typeof value === 'string');
}

export function linkDocumentId(assetId: string, projectId: string): string {
  return `link-${assetId}-${projectId}`;
}

async function putOriginalFiles({
  assetId,
  rev,
  files,
  primaryFilename,
}: {
  assetId: string;
  rev: string;
  files: UploadedMapFile[];
  primaryFilename: string;
}): Promise<string> {
  const db = getMapAssetsDB();
  const primary =
    files.find(file => file.filename === primaryFilename) ?? files[0];
  let response = await db.putAttachment(
    assetId,
    MAP_ASSET_ORIGINAL_ATTACHMENT,
    rev,
    primary.bytes,
    'application/octet-stream'
  );
  for (const file of files) {
    if (file.filename === primary.filename) {
      continue;
    }
    response = await db.putAttachment(
      assetId,
      companionAttachmentName(file.filename),
      response.rev,
      file.bytes,
      'application/octet-stream'
    );
  }
  return response.rev;
}

export async function createMapAsset({
  name,
  description,
  ownedByTeamId,
  createdBy,
  files,
  primaryFilename,
  style,
}: {
  name: string;
  description: string;
  ownedByTeamId?: string;
  createdBy: string;
  files: UploadedMapFile[];
  primaryFilename: string;
  style?: MapAssetStyle;
}): Promise<ExistingMapAsset> {
  const db = getMapAssetsDB();
  const now = Date.now();
  const assetId = `asset-${randomUUID()}`;
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const fields: MapAssetFields = {
    docType: MAP_ASSET_DOC_TYPE,
    name,
    description,
    ...(ownedByTeamId ? {ownedByTeamId} : {}),
    createdBy,
    originalFilename: primaryFilename,
    ...(companions.length > 0 ? {companionFilenames: companions} : {}),
    byteSize: 0,
    status: 'processing',
    defaultStyle: style ?? DEFAULT_MAP_ASSET_STYLE,
    createdAt: now,
    updatedAt: now,
  };
  const created = await db.put({_id: assetId, ...fields});
  await putOriginalFiles({
    assetId,
    rev: created.rev,
    files,
    primaryFilename,
  });
  return getMapAsset(assetId);
}

export async function updateMapAssetDetails({
  assetId,
  name,
  description,
}: {
  assetId: string;
  name: string;
  description: string;
}): Promise<ExistingMapAsset> {
  const current = await getMapAsset(assetId);
  await getMapAssetsDB().put({
    ...current,
    name,
    description,
    updatedAt: Date.now(),
  });
  return getMapAsset(assetId);
}

export async function replaceMapAssetFiles({
  assetId,
  files,
  primaryFilename,
}: {
  assetId: string;
  files: UploadedMapFile[];
  primaryFilename: string;
}): Promise<ExistingMapAsset> {
  const current = await getMapAsset(assetId);
  if (current.status === 'processing') {
    throw new Exceptions.InvalidRequestException(
      'This map layer is still processing.'
    );
  }
  const companions = files
    .map(file => file.filename)
    .filter(filename => filename !== primaryFilename);
  const updated = await getMapAssetsDB().put({
    ...current,
    originalFilename: primaryFilename,
    companionFilenames: companions.length > 0 ? companions : undefined,
    status: 'processing',
    failureReason: undefined,
    contentHash: undefined,
    kind: undefined,
    extent4326: undefined,
    extent3857: undefined,
    byteSize: 0,
    updatedAt: Date.now(),
  });
  await putOriginalFiles({
    assetId,
    rev: updated.rev,
    files,
    primaryFilename,
  });
  return getMapAsset(assetId);
}

async function readUploadFiles(
  asset: ExistingMapAsset
): Promise<UploadedMapFile[]> {
  const original = await asBuffer(
    await attachmentDb().getAttachment(asset._id, MAP_ASSET_ORIGINAL_ATTACHMENT)
  );
  const files: UploadedMapFile[] = [
    {filename: asset.originalFilename, bytes: original},
  ];
  for (const filename of asset.companionFilenames ?? []) {
    const bytes = await asBuffer(
      await attachmentDb().getAttachment(
        asset._id,
        companionAttachmentName(filename)
      )
    );
    files.push({filename, bytes});
  }
  return files;
}

/** Runs GDAL and stores the normalized attachment. Safe to call from the job queue. */
export async function processMapAsset(assetId: string): Promise<void> {
  const db = getMapAssetsDB();
  const asset = await getMapAsset(assetId);
  try {
    const files = await readUploadFiles(asset);
    const normalized = await normalizeMapUpload(files);
    const latest = await getMapAsset(assetId);
    const attached = await db.putAttachment(
      assetId,
      MAP_ASSET_NORMALIZED_ATTACHMENT,
      latest._rev,
      normalized.bytes,
      normalized.mediaType
    );
    const afterAttach = await getMapAsset(assetId);
    await db.put({
      ...afterAttach,
      _rev: attached.rev,
      status: 'ready',
      kind: normalized.kind,
      contentHash: sha256(normalized.bytes),
      byteSize: normalized.bytes.length,
      extent4326: normalized.extent4326,
      extent3857: normalized.extent3857,
      failureReason: undefined,
      updatedAt: Date.now(),
    });
  } catch (error) {
    const latest = await getMapAsset(assetId).catch(() => asset);
    const message =
      error instanceof Error ? error.message : 'Map layer processing failed.';
    await db.put({
      ...latest,
      status: 'failed',
      failureReason: message,
      updatedAt: Date.now(),
    });
  }
}

let processingQueue: Promise<void> = Promise.resolve();

/** Serialise GDAL work so one large raster does not overlap the next. */
export function enqueueMapAssetProcessing(assetId: string): void {
  processingQueue = processingQueue
    .then(() => processMapAsset(assetId))
    .catch(error => {
      console.error(`[map-assets] processing failed for ${assetId}`, error);
    });
}

/** Test helper: wait until queued processing has finished. */
export function waitForMapAssetProcessing(): Promise<void> {
  return processingQueue;
}

export async function readNormalizedAttachment(
  assetId: string
): Promise<{bytes: Buffer; mediaType: string; filename: string}> {
  const asset = await getMapAsset(assetId);
  if (asset.status !== 'ready' || !asset.kind) {
    throw new Exceptions.InvalidRequestException(
      'This map layer is not ready to download.'
    );
  }
  const bytes = await asBuffer(
    await attachmentDb().getAttachment(assetId, MAP_ASSET_NORMALIZED_ATTACHMENT)
  );
  const extension = asset.kind === 'geojson' ? 'geojson' : 'png';
  return {
    bytes,
    mediaType: asset.kind === 'geojson' ? 'application/geo+json' : 'image/png',
    filename: `${asset.name}.${extension}`,
  };
}

export async function linkMapAsset({
  assetId,
  projectId,
  linkedBy,
}: {
  assetId: string;
  projectId: string;
  linkedBy: string;
}): Promise<ExistingMapAssetLink> {
  await getMapAsset(assetId);
  const db = getMapAssetsDB();
  const _id = linkDocumentId(assetId, projectId);
  try {
    const existing = await db.get(_id);
    if (isLink(existing)) {
      return existing;
    }
  } catch (error) {
    const status = (error as {status?: number}).status;
    if (status !== 404) {
      throw error;
    }
  }
  const fields: MapAssetLinkFields = {
    docType: 'link',
    assetId,
    projectId,
    linkedBy,
    createdAt: Date.now(),
  };
  const created = await db.put({_id, ...fields});
  return {_id, _rev: created.rev, ...fields};
}

export async function unlinkMapAsset({
  assetId,
  projectId,
}: {
  assetId: string;
  projectId: string;
}): Promise<void> {
  const db = getMapAssetsDB();
  const _id = linkDocumentId(assetId, projectId);
  try {
    const existing = await db.get(_id);
    await db.remove(existing);
  } catch (error) {
    const status = (error as {status?: number}).status;
    if (status === 404) {
      return;
    }
    throw error;
  }
}

export async function deleteMapAsset(assetId: string): Promise<void> {
  const db = getMapAssetsDB();
  const asset = await getMapAsset(assetId);
  const result = await db.query<string>(MAP_ASSET_LINKS_BY_ASSET, {
    key: assetId,
    include_docs: false,
  });
  for (const row of result.rows) {
    if (!row.id) {
      continue;
    }
    const link = await db.get(row.id);
    if (isLink(link)) {
      await db.remove(link);
    }
  }
  const latest = await getMapAsset(asset._id);
  await db.remove(latest);
}

function toListing(
  asset: ExistingMapAsset
): ContextualLayerListing | undefined {
  if (
    asset.status !== 'ready' ||
    !asset.kind ||
    !asset.contentHash ||
    !asset.extent4326
  ) {
    return undefined;
  }
  return {
    id: asset._id,
    name: asset.name,
    kind: asset.kind,
    byteSize: asset.byteSize,
    contentHash: asset.contentHash,
    extent: asset.extent4326,
    ...(asset.extent3857 ? {extent3857: asset.extent3857} : {}),
    defaultStyle: asset.defaultStyle,
  };
}

/** Ready layers linked to one survey, plus the manifest hash. */
export async function contextualLayersForProject(projectId: string): Promise<{
  contextualLayers: ContextualLayerListing[];
  contextualLayersHash: string;
}> {
  const assetIds = await listLinkAssetIds(projectId);
  const layers: ContextualLayerListing[] = [];
  for (const assetId of assetIds) {
    try {
      const listing = toListing(await getMapAsset(assetId));
      if (listing) {
        layers.push(listing);
      }
    } catch (error) {
      if (!(error instanceof Exceptions.ItemNotFoundException)) {
        throw error;
      }
    }
  }
  layers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    contextualLayers: layers,
    contextualLayersHash: await buildContextualLayersHash(layers),
  };
}

/**
 * Attaches the survey manifest onto listing rows.
 * A read failure leaves the fields off the row so a device does not treat a
 * transient error as "this survey no longer has layers" and delete local files.
 */
export async function attachContextualLayers<T extends {_id: string}>(
  projects: T[]
): Promise<
  (T & {
    contextualLayers?: ContextualLayerListing[];
    contextualLayersHash?: string;
  })[]
> {
  try {
    return await Promise.all(
      projects.map(async project => {
        const manifest = await contextualLayersForProject(project._id);
        return {...project, ...manifest};
      })
    );
  } catch (error) {
    console.error('[map-assets] failed to attach survey layers', error);
    return projects;
  }
}
