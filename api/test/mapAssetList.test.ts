// SPDX-License-Identifier: Apache-2.0
import {
  DEFAULT_MAP_ASSET_STYLE,
  MAP_ASSET_DOC_TYPE,
  MAP_ASSET_LINK_DOC_TYPE,
  MAP_ASSET_LINKS_BY_PROJECT,
} from '@faims3/data-model';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMapAssetsDB} from '../src/couchdb';
import {
  attachContextualLayers,
  contextualLayersForProject,
  createMapAsset,
  linkDocumentId,
  linkMapAsset,
  listAssetsByProject,
  listAssetsByTeam,
} from '../src/couchdb/mapAssets/store';
import {resetDatabases} from './mocks';

async function createAsset(ownedByTeamId?: string) {
  return createMapAsset({
    name: 'Layer',
    description: '',
    createdBy: 'user-1',
    ownedByTeamId,
    files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
    primaryFilename: 'layer.geojson',
  });
}

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

describe('map asset bulk listing', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await clearMapAssetDocs();
  });

  it('lists assets for a team from the team view', async () => {
    const inTeam = await createAsset('team-1');
    const otherTeam = await createAsset('team-2');
    await createAsset();
    const listed = await listAssetsByTeam('team-1');
    expect(listed.map(asset => asset._id)).toEqual([inTeam._id]);
    expect(listed.some(asset => asset._id === otherTeam._id)).toBe(false);
  });

  it('loads linked survey assets and skips dangling link ids', async () => {
    const linked = await createAsset();
    const unlinked = await createAsset();
    await linkMapAsset({
      assetId: linked._id,
      projectId: 'survey-1',
      linkedBy: 'user-1',
    });
    await getMapAssetsDB().put({
      _id: linkDocumentId('missing-asset', 'survey-1'),
      docType: MAP_ASSET_LINK_DOC_TYPE,
      assetId: 'missing-asset',
      projectId: 'survey-1',
      linkedBy: 'user-1',
      createdAt: Date.now(),
    });
    const listed = await listAssetsByProject('survey-1');
    expect(listed.map(asset => asset._id)).toEqual([linked._id]);
    expect(listed.some(asset => asset._id === unlinked._id)).toBe(false);
  });
});

async function putReadyAsset(id: string, name: string) {
  const now = Date.now();
  await getMapAssetsDB().put({
    _id: id,
    docType: MAP_ASSET_DOC_TYPE,
    name,
    description: '',
    createdBy: 'user-1',
    originalFilename: 'layer.geojson',
    byteSize: 12,
    contentHash: `hash-${id}`,
    status: 'ready',
    kind: 'vector-tiles',
    extent4326: [0, 0, 1, 1],
    minZoom: 0,
    maxZoom: 1,
    tileSize: 256,
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    createdAt: now,
    updatedAt: now,
  });
}

describe('attachContextualLayers', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await clearMapAssetDocs();
  });

  it('attaches ready linked layers and omits pending, dangling, and unlinked assets', async () => {
    await putReadyAsset('asset-ready', 'Ready');
    await putReadyAsset('asset-shared', 'Shared');
    await putReadyAsset('asset-other', 'Other survey');
    const pending = await createAsset();
    await linkMapAsset({
      assetId: 'asset-ready',
      projectId: 'survey-a',
      linkedBy: 'user-1',
    });
    await linkMapAsset({
      assetId: 'asset-shared',
      projectId: 'survey-a',
      linkedBy: 'user-1',
    });
    await linkMapAsset({
      assetId: 'asset-shared',
      projectId: 'survey-b',
      linkedBy: 'user-1',
    });
    await linkMapAsset({
      assetId: pending._id,
      projectId: 'survey-a',
      linkedBy: 'user-1',
    });
    await linkMapAsset({
      assetId: 'asset-other',
      projectId: 'survey-other',
      linkedBy: 'user-1',
    });
    await getMapAssetsDB().put({
      _id: linkDocumentId('missing-asset', 'survey-a'),
      docType: MAP_ASSET_LINK_DOC_TYPE,
      assetId: 'missing-asset',
      projectId: 'survey-a',
      linkedBy: 'user-1',
      createdAt: Date.now(),
    });

    const attached = await attachContextualLayers([
      {_id: 'survey-a', name: 'A'},
      {_id: 'survey-b', name: 'B'},
      {_id: 'survey-empty', name: 'Empty'},
    ]);

    expect(attached[0].contextualLayers?.map(layer => layer.id)).toEqual([
      'asset-ready',
      'asset-shared',
    ]);
    expect(attached[1].contextualLayers?.map(layer => layer.id)).toEqual([
      'asset-shared',
    ]);
    expect(attached[2].contextualLayers).toEqual([]);
    expect(attached[0].contextualLayersHash).toHaveLength(64);
    expect(attached[2].contextualLayersHash).toHaveLength(64);
    expect(attached[0].contextualLayersHash).not.toBe(
      attached[2].contextualLayersHash
    );

    const single = await contextualLayersForProject('survey-a');
    expect(single.contextualLayers.map(layer => layer.id)).toEqual([
      'asset-ready',
      'asset-shared',
    ]);
    expect(single.contextualLayersHash).toBe(attached[0].contextualLayersHash);
  });

  it('uses one link-view query and one allDocs for the whole listing', async () => {
    await putReadyAsset('asset-a', 'A');
    await putReadyAsset('asset-b', 'B');
    await linkMapAsset({
      assetId: 'asset-a',
      projectId: 'survey-a',
      linkedBy: 'user-1',
    });
    await linkMapAsset({
      assetId: 'asset-b',
      projectId: 'survey-b',
      linkedBy: 'user-1',
    });
    const db = getMapAssetsDB();
    const query = vi.spyOn(db, 'query');
    const allDocs = vi.spyOn(db, 'allDocs');
    try {
      await attachContextualLayers([
        {_id: 'survey-a'},
        {_id: 'survey-b'},
        {_id: 'survey-empty'},
      ]);
      const linkQueries = query.mock.calls.filter(
        ([view]) => view === MAP_ASSET_LINKS_BY_PROJECT
      );
      expect(linkQueries).toHaveLength(1);
      expect(linkQueries[0][1]).toEqual(
        expect.objectContaining({
          keys: ['survey-a', 'survey-b', 'survey-empty'],
          include_docs: false,
        })
      );
      expect(allDocs).toHaveBeenCalledTimes(1);
      expect(allDocs).toHaveBeenCalledWith(
        expect.objectContaining({
          keys: expect.arrayContaining(['asset-a', 'asset-b']),
          include_docs: true,
        })
      );
    } finally {
      query.mockRestore();
      allDocs.mockRestore();
    }
  });

  it('omits listing fields when the Couch read fails', async () => {
    const db = getMapAssetsDB();
    const query = vi
      .spyOn(db, 'query')
      .mockRejectedValue(new Error('couch down'));
    const projects = [{_id: 'survey-a', name: 'A'}];
    try {
      const attached = await attachContextualLayers(projects);
      expect(attached).toEqual(projects);
      expect(attached[0].contextualLayers).toBeUndefined();
    } finally {
      query.mockRestore();
    }
  });
});
