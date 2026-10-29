// SPDX-License-Identifier: Apache-2.0
import {
  buildContextualLayersHash,
  MAP_ASSET_NORMALIZED_ATTACHMENT,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {attachmentStorageService} from '../src/buildconfig';
import {getMapAssetsDB} from '../src/couchdb';
import {
  attachContextualLayers,
  attachLinkCounts,
  contextualLayersForProject,
  createMapAsset,
  getMapAsset,
  linkMapAsset,
  listLinkProjectIds,
  unlinkMapAsset,
} from '../src/couchdb/mapAssets/store';
import {resetDatabases} from './mocks';

async function clearMapAssetDocs() {
  const db = getMapAssetsDB();
  const all = await db.allDocs();
  for (const row of all.rows) {
    if (row.id.startsWith('_design')) {
      continue;
    }
    await db.remove(row.id, row.value.rev);
  }
}

async function createPendingAsset(name = 'Site boundary') {
  return createMapAsset({
    name,
    description: '',
    createdBy: 'admin',
    files: [
      {
        filename: 'layer.geojson',
        bytes: Buffer.from('{"type":"FeatureCollection","features":[]}'),
      },
    ],
    primaryFilename: 'layer.geojson',
  });
}

async function markReady(
  assetId: string,
  extras: {
    contentHash?: string;
    extent4326?: [number, number, number, number];
  } = {}
) {
  const bytes = Buffer.from('pmtiles-fixture');
  const location = await attachmentStorageService.upload({
    key: attachmentStorageService.objectKey(
      assetId,
      MAP_ASSET_NORMALIZED_ATTACHMENT
    ),
    body: bytes,
    contentType: 'application/vnd.pmtiles',
    contentLength: bytes.length,
  });
  const asset = await getMapAsset(assetId);
  const next = {
    ...asset,
    status: 'ready' as const,
    kind: 'vector-tiles' as const,
    contentHash: extras.contentHash ?? 'abc123hash',
    extent4326:
      extras.extent4326 ?? ([0, 0, 1, 1] as [number, number, number, number]),
    byteSize: bytes.length,
    storedAttachments: {
      ...(asset.storedAttachments ?? {}),
      normalized: location,
    },
  };
  delete next.processingStage;
  delete next.processingProgress;
  await getMapAssetsDB().put(next);
  return getMapAsset(assetId);
}

describe('map asset survey links', () => {
  beforeEach(async () => {
    await resetDatabases();
    await clearMapAssetDocs();
  });

  it('linkMapAsset is idempotent and unlinkMapAsset ignores a missing link', async () => {
    const asset = await createPendingAsset();
    const first = await linkMapAsset({
      assetId: asset._id,
      projectId: 'survey-1',
      linkedBy: 'admin',
    });
    expect(first.docType).toBe('link');
    expect(first.assetId).toBe(asset._id);
    expect(first.projectId).toBe('survey-1');
    expect(first._id).toBe(`link-${asset._id}-survey-1`);

    const second = await linkMapAsset({
      assetId: asset._id,
      projectId: 'survey-1',
      linkedBy: 'someone-else',
    });
    expect(second._rev).toBe(first._rev);
    expect(second.linkedBy).toBe('admin');
    expect(await listLinkProjectIds(asset._id)).toEqual(['survey-1']);

    await unlinkMapAsset({assetId: asset._id, projectId: 'survey-1'});
    expect(await listLinkProjectIds(asset._id)).toEqual([]);
    await unlinkMapAsset({assetId: asset._id, projectId: 'survey-1'});
    expect(await listLinkProjectIds(asset._id)).toEqual([]);
  });

  it('attachLinkCounts reports zero or more survey links per asset', async () => {
    const unlinked = await createPendingAsset('Unlinked layer');
    const linked = await createPendingAsset('Linked layer');
    await linkMapAsset({
      assetId: linked._id,
      projectId: 'survey-1',
      linkedBy: 'admin',
    });
    await linkMapAsset({
      assetId: linked._id,
      projectId: 'survey-2',
      linkedBy: 'admin',
    });

    const counted = await attachLinkCounts([unlinked, linked]);
    expect(counted.map(asset => asset.linkCount)).toEqual([0, 2]);
  });

  it('linkMapAsset 404s when the asset is missing', async () => {
    await expect(
      linkMapAsset({
        assetId: 'asset-missing',
        projectId: 'survey-1',
        linkedBy: 'admin',
      })
    ).rejects.toThrow(/was not found/);
  });

  it('contextualLayersForProject lists only ready linked assets, sorted by id', async () => {
    const pending = await createPendingAsset('Pending layer');
    const readyA = await markReady(
      (await createPendingAsset('Alpha layer'))._id,
      {
        contentHash: 'hash-a',
      }
    );
    const readyB = await markReady(
      (await createPendingAsset('Beta layer'))._id,
      {
        contentHash: 'hash-b',
      }
    );
    await linkMapAsset({
      assetId: pending._id,
      projectId: 'survey-1',
      linkedBy: 'admin',
    });
    await linkMapAsset({
      assetId: readyA._id,
      projectId: 'survey-1',
      linkedBy: 'admin',
    });
    await linkMapAsset({
      assetId: readyB._id,
      projectId: 'survey-1',
      linkedBy: 'admin',
    });

    const listing = await contextualLayersForProject('survey-1');
    expect(listing.contextualLayers.map(layer => layer.id)).toEqual(
      [readyA._id, readyB._id].sort()
    );
    expect(
      listing.contextualLayers.every(layer => layer.kind === 'vector-tiles')
    ).toBe(true);
    expect(listing.contextualLayersHash).toBe(
      await buildContextualLayersHash(listing.contextualLayers)
    );

    const empty = await contextualLayersForProject('survey-none');
    expect(empty.contextualLayers).toEqual([]);
    expect(empty.contextualLayersHash).toBe(
      await buildContextualLayersHash([])
    );
  });

  it('attachContextualLayers spreads empty manifests and omits fields on failure', async () => {
    const projects = [{_id: 'survey-empty'}, {_id: 'survey-other'}];
    const attached = await attachContextualLayers(projects);
    expect(attached).toHaveLength(2);
    for (const row of attached) {
      expect(row.contextualLayers).toEqual([]);
      expect(row.contextualLayersHash).toBe(
        await buildContextualLayersHash([])
      );
    }

    const db = getMapAssetsDB();
    const query = vi
      .spyOn(db, 'query')
      .mockRejectedValue(new Error('view down'));
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const failed = await attachContextualLayers(projects);
      expect(failed).toEqual(projects);
      expect(failed[0]).not.toHaveProperty('contextualLayers');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      query.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
