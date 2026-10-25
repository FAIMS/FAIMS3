// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {
  DEFAULT_MAP_ASSET_STYLE,
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  type ExistingMapAsset,
} from '@faims3/data-model';
import {QueryClient} from '@tanstack/react-query';
import {describe, expect, it} from 'vitest';
import {
  cacheCreatedMapAsset,
  formatAssetStatus,
  inProgressMapAssetIds,
  invalidateMapAssetsAfterCreate,
  mapAssetClientErrorMessage,
  mapAssetDetailQueryKey,
  mapAssetQueryKey,
  mapAssetTeamQueryKey,
  messageFromBody,
  overlayListWithCachedMapAssets,
  patchMapAssetInLists,
  replaceAssetInList,
  seedMapAssetDetailsFromList,
  upsertAssetInList,
} from './map-asset-hooks';

function asset(
  overrides: Partial<ExistingMapAsset> & {linkCount?: number} = {}
): ExistingMapAsset & {linkCount: number} {
  return {
    _id: 'asset-1',
    _rev: '1',
    docType: 'asset',
    name: 'Sites',
    description: '',
    createdBy: 'u',
    originalFilename: 'sites.geojson',
    byteSize: 12,
    status: 'ready',
    kind: 'vector-tiles',
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    createdAt: 1,
    updatedAt: 1,
    linkCount: 0,
    ...overrides,
  } as ExistingMapAsset & {linkCount: number};
}

describe('mapAssetClientErrorMessage', () => {
  it('maps HTTP 503 to the shared busy message', () => {
    expect(
      mapAssetClientErrorMessage({
        status: 503,
        body: {error: {message: 'ignored'}},
        statusText: 'Service Unavailable',
      })
    ).toBe(MAP_ASSET_UPLOAD_BUSY_MESSAGE);
  });

  it('prefers JSON error.message for other statuses', () => {
    expect(
      mapAssetClientErrorMessage({
        status: 400,
        body: {error: {message: 'File too large.'}},
        statusText: 'Bad Request',
      })
    ).toBe('File too large.');
  });

  it('reads the first Zod issue from an array body', () => {
    expect(
      messageFromBody(
        [{errors: {issues: [{message: 'Choose a map file.'}]}}],
        'Bad Request'
      )
    ).toBe('Choose a map file.');
  });

  it('falls back to statusText when the body has no message', () => {
    expect(messageFromBody({}, 'Not Found')).toBe('Not Found');
    expect(
      mapAssetClientErrorMessage({
        status: 404,
        body: undefined,
        statusText: 'Not Found',
      })
    ).toBe('Not Found');
  });
});

const user = {token: 'tok'} as User;

describe('map asset list cache helpers', () => {
  it('lists only pending and processing ids', () => {
    expect(
      inProgressMapAssetIds([
        asset({_id: 'ready', status: 'ready'}),
        asset({_id: 'pending', status: 'pending'}),
        asset({_id: 'failed', status: 'failed'}),
        asset({_id: 'processing', status: 'processing'}),
      ])
    ).toEqual(['pending', 'processing']);
  });

  it('replaces a matching list row and leaves others alone', () => {
    const current = asset({_id: 'asset-1', status: 'processing'});
    const other = asset({_id: 'asset-2', status: 'ready'});
    const next = asset({
      _id: 'asset-1',
      status: 'ready',
      kind: 'vector-tiles',
    });
    const updated = replaceAssetInList({assets: [current, other]}, next);
    expect(updated?.assets).toEqual([next, other]);
    expect(replaceAssetInList({assets: [other]}, next)).toEqual({
      assets: [other],
    });
  });

  it('keeps the previous linkCount when a poll omits it', () => {
    const listed = asset({_id: 'asset-1', status: 'processing', linkCount: 2});
    const polled = {
      ...asset({_id: 'asset-1', status: 'ready', updatedAt: 2}),
    };
    delete (polled as {linkCount?: number}).linkCount;
    expect(
      replaceAssetInList({assets: [listed]}, polled)?.assets[0].linkCount
    ).toBe(2);
  });

  it('seeds details from the list without overwriting a newer poll', () => {
    const queryClient = new QueryClient();
    const listed = asset({updatedAt: 10, status: 'processing'});
    const polled = asset({
      updatedAt: 20,
      status: 'processing',
      processingStage: 'tiling-vectors',
    });
    seedMapAssetDetailsFromList(queryClient, user, [listed]);
    expect(
      queryClient.getQueryData(mapAssetDetailQueryKey(user, listed._id))
    ).toEqual(listed);

    queryClient.setQueryData(mapAssetDetailQueryKey(user, listed._id), polled);
    seedMapAssetDetailsFromList(queryClient, user, [
      asset({updatedAt: 15, status: 'processing'}),
    ]);
    expect(
      queryClient.getQueryData(mapAssetDetailQueryKey(user, listed._id))
    ).toEqual(polled);
  });

  it('overlays list rows with a newer cached details snapshot', () => {
    const queryClient = new QueryClient();
    const listed = asset({updatedAt: 10, status: 'processing'});
    const polled = asset({updatedAt: 20, status: 'ready'});
    queryClient.setQueryData(mapAssetDetailQueryKey(user, listed._id), polled);
    expect(
      overlayListWithCachedMapAssets(queryClient, user, {assets: [listed]})
    ).toEqual({assets: [polled]});
  });

  it('patches list caches from a details poll, not links or other users', () => {
    const queryClient = new QueryClient();
    const listed = asset({status: 'processing', updatedAt: 1});
    const otherUser = {token: 'other'} as User;
    const ready = asset({status: 'ready', updatedAt: 2});
    queryClient.setQueryData(mapAssetQueryKey(user), {assets: [listed]});
    queryClient.setQueryData(mapAssetTeamQueryKey(user, 'team-1'), {
      assets: [listed],
    });
    queryClient.setQueryData(mapAssetQueryKey(otherUser), {assets: [listed]});
    queryClient.setQueryData(
      ['map-assets', user.token, 'links', listed._id],
      ['project-1']
    );

    patchMapAssetInLists(queryClient, user, ready);

    expect(queryClient.getQueryData(mapAssetQueryKey(user))).toEqual({
      assets: [ready],
    });
    expect(
      queryClient.getQueryData(mapAssetTeamQueryKey(user, 'team-1'))
    ).toEqual({assets: [ready]});
    expect(queryClient.getQueryData(mapAssetQueryKey(otherUser))).toEqual({
      assets: [listed],
    });
    expect(
      queryClient.getQueryData(['map-assets', user.token, 'links', listed._id])
    ).toEqual(['project-1']);
  });

  it('inserts a created layer and keeps a newer cached row', () => {
    const existing = asset({_id: 'asset-2', status: 'ready'});
    const created = asset({
      _id: 'asset-1',
      status: 'pending',
      updatedAt: 2,
    });
    expect(upsertAssetInList({assets: [existing]}, created)).toEqual({
      assets: [created, existing],
    });
    expect(upsertAssetInList({assets: [created, existing]}, created)).toEqual({
      assets: [created, existing],
    });
    expect(
      upsertAssetInList(
        {assets: [asset({_id: 'asset-1', updatedAt: 5}), existing]},
        created
      )
    ).toEqual({
      assets: [asset({_id: 'asset-1', updatedAt: 5}), existing],
    });
  });

  it('seeds a created layer into library and owning team lists only', () => {
    const queryClient = new QueryClient();
    const existing = asset({_id: 'asset-2', status: 'ready'});
    const created = asset({
      _id: 'asset-1',
      status: 'pending',
      ownedByTeamId: 'team-1',
    });
    const otherUser = {token: 'other'} as User;
    queryClient.setQueryData(mapAssetQueryKey(user), {assets: [existing]});
    queryClient.setQueryData(mapAssetTeamQueryKey(user, 'team-1'), {
      assets: [existing],
    });
    queryClient.setQueryData(mapAssetTeamQueryKey(user, 'team-2'), {
      assets: [existing],
    });
    queryClient.setQueryData(mapAssetQueryKey(user, 'project-1'), {
      assets: [existing],
    });
    queryClient.setQueryData(mapAssetQueryKey(otherUser), {assets: [existing]});

    cacheCreatedMapAsset(queryClient, user, created);

    expect(queryClient.getQueryData(mapAssetQueryKey(user))).toEqual({
      assets: [created, existing],
    });
    expect(
      queryClient.getQueryData(mapAssetTeamQueryKey(user, 'team-1'))
    ).toEqual({assets: [created, existing]});
    expect(
      queryClient.getQueryData(mapAssetTeamQueryKey(user, 'team-2'))
    ).toEqual({assets: [existing]});
    expect(
      queryClient.getQueryData(mapAssetQueryKey(user, 'project-1'))
    ).toEqual({assets: [existing]});
    expect(queryClient.getQueryData(mapAssetQueryKey(otherUser))).toEqual({
      assets: [existing],
    });
    expect(
      queryClient.getQueryData(mapAssetDetailQueryKey(user, created._id))
    ).toEqual(created);
  });

  it('puts the created layer back after a list refetch omits it', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    });
    const existing = asset({_id: 'asset-2', status: 'ready'});
    const created = asset({_id: 'asset-1', status: 'pending'});
    await queryClient.prefetchQuery({
      queryKey: mapAssetQueryKey(user),
      queryFn: async () => ({assets: [existing]}),
    });

    await invalidateMapAssetsAfterCreate(queryClient, user, created);

    expect(queryClient.getQueryData(mapAssetQueryKey(user))).toEqual({
      assets: [created, existing],
    });
    expect(
      queryClient.getQueryData(mapAssetDetailQueryKey(user, created._id))
    ).toEqual(created);
  });
});

describe('formatAssetStatus', () => {
  it('returns the failure reason, or Failed', () => {
    expect(
      formatAssetStatus(asset({status: 'failed', failureReason: 'Invalid CRS'}))
    ).toBe('Invalid CRS');
    expect(formatAssetStatus(asset({status: 'failed'}))).toBe('Failed');
  });

  it('uses processing copy while the job is in progress', () => {
    expect(formatAssetStatus(asset({status: 'pending'}))).toBe('Pending');
    expect(formatAssetStatus(asset({status: 'processing'}))).toBe('Processing');
    expect(
      formatAssetStatus(
        asset({
          status: 'processing',
          processingStage: 'tiling-vectors',
          processingProgress: {phase: 'Reordering geometry', percent: 45.2},
        })
      )
    ).toBe('Building vector tiles — Reordering geometry 45%');
  });

  it('labels a ready layer by kind', () => {
    expect(formatAssetStatus(asset({kind: 'vector-tiles'}))).toBe(
      'Vector tiles'
    );
    expect(formatAssetStatus(asset({kind: 'raster-tiles'}))).toBe(
      'Image tiles'
    );
    expect(formatAssetStatus(asset({kind: undefined}))).toBe('Vector');
  });
});
