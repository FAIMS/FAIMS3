// SPDX-License-Identifier: Apache-2.0
import {
  addProjectRole,
  addTeamRole,
  buildContextualLayersHash,
  INPUT_LIMITS,
  MAP_ASSET_NORMALIZED_ATTACHMENT,
  type PeopleDBDocument,
  registerClient,
  Role,
} from '@faims3/data-model';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {attachmentStorageService, keyService} from '../src/buildconfig';
import {getMapAssetsDB} from '../src/couchdb';
import {
  createMapAsset,
  getMapAsset,
  linkMapAsset,
  MAP_ASSET_DOWNLOAD_URL_EXPIRY_SECONDS,
} from '../src/couchdb/mapAssets/store';
import {createUser, saveCouchUser} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {createNotebookFromSampleFile} from './sampleNotebook';
import {
  adminToken,
  beforeApiTests,
  localUserToken,
  notebookUserName,
  notebookUserToken,
} from './utils';

registerClient(callbackObject);

const GEOJSON = Buffer.from('{"type":"FeatureCollection","features":[]}');
const MAP_ASSETS = '/api/map-assets';

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

function auth(req: request.Test, token: string) {
  return req.set('Authorization', `Bearer ${token}`);
}

function upload(token: string, extra?: {teamId?: string; name?: string}) {
  const req = auth(request(app).post(MAP_ASSETS), token)
    .field('name', extra?.name ?? 'Site boundary')
    .field('description', '');
  if (extra?.teamId) {
    req.field('teamId', extra.teamId);
  }
  return req.attach('files', GEOJSON, 'layer.geojson');
}

async function createPendingAsset(createdBy = 'admin', ownedByTeamId?: string) {
  return createMapAsset({
    name: 'Site boundary',
    description: '',
    createdBy,
    ...(ownedByTeamId ? {ownedByTeamId} : {}),
    files: [{filename: 'layer.geojson', bytes: GEOJSON}],
    primaryFilename: 'layer.geojson',
  });
}

async function markReady(assetId: string) {
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
    contentHash: 'abc123hash',
    extent4326: [0, 0, 1, 1] as [number, number, number, number],
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

async function createTeam(name = 'Map Team') {
  const res = await auth(request(app).post('/api/teams'), adminToken)
    .set('Content-Type', 'application/json')
    .send({name, description: 'Team for map layer API tests'})
    .expect(200);
  return res.body as {_id: string};
}

async function tokenFor(dbUser: PeopleDBDocument) {
  const signingKey = await keyService.getSigningKey();
  const upgraded = await upgradeCouchUserToExpressUser({dbUser});
  return generateJwtFromUser({user: upgraded, signingKey});
}

async function createRoleUser({
  username,
  teamId,
  teamRole,
  projectId,
  projectRole,
}: {
  username: string;
  teamId?: string;
  teamRole?: Role;
  projectId?: string;
  projectRole?: Role;
}) {
  const [user, err] = await createUser({username, name: username});
  expect(err).toBe('');
  expect(user).not.toBeNull();
  if (!user) {
    throw new Error('User creation failed');
  }
  if (teamId && teamRole) {
    addTeamRole({user, teamId, role: teamRole});
  }
  if (projectId && projectRole) {
    addProjectRole({user, projectId, role: projectRole});
  }
  await saveCouchUser(user);
  return {user, token: await tokenFor(user)};
}

describe('GET/POST /api/map-assets', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await clearMapAssetDocs();
  });

  it('requires authentication', async () => {
    const get = await request(app).get(MAP_ASSETS);
    expect(get.status).toBe(401);
    expect(get.body).toEqual({error: 'authentication required'});

    const post = await request(app).post(MAP_ASSETS);
    expect(post.status).toBe(401);
    expect(post.body).toEqual({error: 'authentication required'});
  });

  it('rejects a personal upload from a user without CREATE_MAP_ASSET', async () => {
    const res = await upload(localUserToken);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/permission to upload/);
  });

  it('creates a personal pending layer for a notebook creator', async () => {
    const res = await upload(notebookUserToken).expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.createdBy).toBe(notebookUserName);
    expect(res.body.ownedByTeamId).toBeUndefined();
    expect(res.body.docType).toBe('asset');
    expect(res.body.processingStage).toBe('uploading');
  });

  it('lets a team manager upload into a team and blocks a team member', async () => {
    const team = await createTeam();
    const member = await createRoleUser({
      username: 'map-member',
      teamId: team._id,
      teamRole: Role.TEAM_MEMBER,
    });
    const manager = await createRoleUser({
      username: 'map-manager',
      teamId: team._id,
      teamRole: Role.TEAM_MANAGER,
    });

    const denied = await upload(member.token, {teamId: team._id});
    expect(denied.status).toBe(401);

    const created = await upload(manager.token, {teamId: team._id}).expect(201);
    expect(created.body.ownedByTeamId).toBe(team._id);
    expect(created.body.createdBy).toBe('map-manager');
  });

  it('rejects empty, oversized, unsupported, and unnamed uploads', async () => {
    const noFiles = await auth(request(app).post(MAP_ASSETS), adminToken)
      .field('name', 'Site boundary')
      .field('description', '')
      .expect(400);
    expect(noFiles.body.error.message).toMatch(/Choose a map file/);

    let tooMany = auth(request(app).post(MAP_ASSETS), adminToken)
      .field('name', 'Site boundary')
      .field('description', '');
    for (let i = 0; i < INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES + 1; i++) {
      tooMany = tooMany.attach('files', GEOJSON, `layer${i}.geojson`);
    }
    const counted = await tooMany.expect(400);
    expect(counted.body.error.message).toBe(
      `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`
    );

    const txt = await auth(request(app).post(MAP_ASSETS), adminToken)
      .field('name', 'Site boundary')
      .field('description', '')
      .attach('files', Buffer.from('notes'), 'notes.txt')
      .expect(400);
    expect(txt.body.error.message).toMatch(/GeoJSON/);

    const shortName = await upload(adminToken, {name: 'ab'}).expect(400);
    expect(shortName.body.error.message).toMatch(/at least/);
  });

  it('lists layers the caller can read', async () => {
    const personal = await createPendingAsset(notebookUserName);
    const adminList = await auth(
      request(app).get(MAP_ASSETS),
      adminToken
    ).expect(200);
    expect(
      adminList.body.assets.map((asset: {_id: string}) => asset._id)
    ).toContain(personal._id);

    const localList = await auth(
      request(app).get(MAP_ASSETS),
      localUserToken
    ).expect(200);
    expect(
      localList.body.assets.map((asset: {_id: string}) => asset._id)
    ).not.toContain(personal._id);
  });
});

describe('GET/PATCH/PUT/DELETE /api/map-assets/:id', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await clearMapAssetDocs();
  });

  it('returns 404 for an unknown id and 401 for another user', async () => {
    const missing = await auth(
      request(app).get(`${MAP_ASSETS}/asset-missing`),
      adminToken
    );
    expect(missing.status).toBe(404);

    const asset = await createPendingAsset(notebookUserName);
    const denied = await auth(
      request(app).get(`${MAP_ASSETS}/${asset._id}`),
      localUserToken
    );
    expect(denied.status).toBe(401);

    const own = await auth(
      request(app).get(`${MAP_ASSETS}/${asset._id}`),
      notebookUserToken
    ).expect(200);
    expect(own.body._id).toBe(asset._id);
  });

  it('renames, replaces, then deletes a layer', async () => {
    const asset = await createPendingAsset();
    const patched = await auth(
      request(app).patch(`${MAP_ASSETS}/${asset._id}`),
      adminToken
    )
      .send({name: 'Renamed layer', description: 'updated'})
      .expect(200);
    expect(patched.body.name).toBe('Renamed layer');
    expect(patched.body.description).toBe('updated');

    await markReady(asset._id);
    const replaced = await auth(
      request(app).put(`${MAP_ASSETS}/${asset._id}`),
      adminToken
    )
      .attach('files', GEOJSON, 'replaced.geojson')
      .expect(200);
    expect(replaced.body.status).toBe('pending');
    expect(replaced.body.originalFilename).toBe('replaced.geojson');

    await auth(
      request(app).delete(`${MAP_ASSETS}/${asset._id}`),
      adminToken
    ).expect(204);
    await auth(
      request(app).get(`${MAP_ASSETS}/${asset._id}`),
      adminToken
    ).expect(404);
  });
});

describe('GET /api/map-assets/:id/download-url', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await clearMapAssetDocs();
  });

  it('grants a mock URL for a ready layer and 400 while pending', async () => {
    const pending = await createPendingAsset();
    const notReady = await auth(
      request(app).get(`${MAP_ASSETS}/${pending._id}/download-url`),
      adminToken
    ).expect(400);
    expect(notReady.body.error.message).toMatch(/not ready to download/);

    const ready = await markReady(pending._id);
    const grant = await auth(
      request(app).get(`${MAP_ASSETS}/${ready._id}/download-url`),
      adminToken
    ).expect(200);
    expect(grant.body.expiresInSeconds).toBe(
      MAP_ASSET_DOWNLOAD_URL_EXPIRY_SECONDS
    );
    expect(grant.body.mediaType).toBe('application/vnd.pmtiles');
    expect(grant.body.filename).toBe('Site boundary.pmtiles');
    expect(grant.body.url).toMatch(/^mock:\/\//);
    expect(grant.body.byteSize).toBeGreaterThan(0);
  });

  it('lets a survey guest download a linked ready layer until it is unlinked', async () => {
    const projectId = await createNotebookFromSampleFile('guest notebook');
    expect(projectId).toBeTruthy();
    const ready = await markReady((await createPendingAsset())._id);
    await linkMapAsset({
      assetId: ready._id,
      projectId: projectId!,
      linkedBy: 'admin',
    });
    const guest = await createRoleUser({
      username: 'map-guest',
      projectId: projectId!,
      projectRole: Role.PROJECT_GUEST,
    });

    await auth(
      request(app).get(`${MAP_ASSETS}/${ready._id}/download-url`),
      guest.token
    ).expect(200);

    await auth(
      request(app).delete(`${MAP_ASSETS}/${ready._id}/links/${projectId}`),
      adminToken
    ).expect(204);

    await auth(
      request(app).get(`${MAP_ASSETS}/${ready._id}/download-url`),
      guest.token
    ).expect(401);
  });
});

describe('map asset survey links HTTP', () => {
  beforeEach(async () => {
    await beforeApiTests();
    await clearMapAssetDocs();
  });

  it('links, lists, is idempotent, and unlinks twice', async () => {
    const projectId = await createNotebookFromSampleFile('link notebook');
    expect(projectId).toBeTruthy();
    const asset = await createPendingAsset();

    const created = await auth(
      request(app).post(`${MAP_ASSETS}/${asset._id}/links`),
      adminToken
    )
      .send({projectId})
      .expect(201);
    expect(created.body.projectId).toBe(projectId);
    expect(created.body.assetId).toBe(asset._id);

    const again = await auth(
      request(app).post(`${MAP_ASSETS}/${asset._id}/links`),
      adminToken
    )
      .send({projectId})
      .expect(201);
    expect(again.body._id).toBe(created.body._id);

    const listed = await auth(
      request(app).get(`${MAP_ASSETS}/${asset._id}/links`),
      adminToken
    ).expect(200);
    expect(listed.body.projectIds).toEqual([projectId]);

    await auth(
      request(app).delete(`${MAP_ASSETS}/${asset._id}/links/${projectId}`),
      adminToken
    ).expect(204);
    await auth(
      request(app).delete(`${MAP_ASSETS}/${asset._id}/links/${projectId}`),
      adminToken
    ).expect(204);
  });

  it('does not let a project guest add a layer to the survey', async () => {
    const projectId = await createNotebookFromSampleFile('guest link notebook');
    expect(projectId).toBeTruthy();
    const guest = await createRoleUser({
      username: 'link-guest',
      projectId: projectId!,
      projectRole: Role.PROJECT_GUEST,
    });
    const asset = await createPendingAsset(guest.user.user_id);
    const denied = await auth(
      request(app).post(`${MAP_ASSETS}/${asset._id}/links`),
      guest.token
    ).send({projectId});
    expect(denied.status).toBe(401);
    expect(denied.body.error.message).toMatch(/add layers to this survey/);
  });

  it('does not let a survey guest attach a linked layer to another survey they administer', async () => {
    const sourceId = await createNotebookFromSampleFile('source guest survey');
    const targetId = await createNotebookFromSampleFile(
      'managed target survey'
    );
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();
    const asset = await markReady((await createPendingAsset())._id);
    await linkMapAsset({
      assetId: asset._id,
      projectId: sourceId!,
      linkedBy: 'admin',
    });
    const guest = await createRoleUser({
      username: 'reshare-guest',
      projectId: sourceId!,
      projectRole: Role.PROJECT_GUEST,
    });
    addProjectRole({
      user: guest.user,
      projectId: targetId!,
      role: Role.PROJECT_MANAGER,
    });
    await saveCouchUser(guest.user);
    const token = await tokenFor(guest.user);

    const directory = await auth(
      request(app).get('/api/directory'),
      token
    ).expect(200);
    const sourceRow = directory.body.find(
      (row: {_id: string}) => row._id === sourceId
    );
    expect(
      sourceRow.contextualLayers.map((layer: {id: string}) => layer.id)
    ).toEqual([asset._id]);

    const denied = await auth(
      request(app).post(`${MAP_ASSETS}/${asset._id}/links`),
      token
    ).send({projectId: targetId});
    expect(denied.status).toBe(401);
    expect(denied.body.error.message).toMatch(/from your library/);

    await auth(
      request(app).get(`${MAP_ASSETS}/${asset._id}/download-url`),
      token
    ).expect(200);
  });

  it('attaches ready linked layers on notebook and directory GETs', async () => {
    const projectId = await createNotebookFromSampleFile('layer notebook');
    expect(projectId).toBeTruthy();
    const pending = await createPendingAsset('Pending layer');
    const ready = await markReady(
      (
        await createMapAsset({
          name: 'Ready layer',
          description: '',
          createdBy: 'admin',
          files: [{filename: 'layer.geojson', bytes: GEOJSON}],
          primaryFilename: 'layer.geojson',
        })
      )._id
    );
    await linkMapAsset({
      assetId: pending._id,
      projectId: projectId!,
      linkedBy: 'admin',
    });
    await linkMapAsset({
      assetId: ready._id,
      projectId: projectId!,
      linkedBy: 'admin',
    });

    const detail = await auth(
      request(app).get(`/api/notebooks/${projectId}`),
      adminToken
    ).expect(200);
    expect(detail.body.contextualLayers).toEqual([
      expect.objectContaining({id: ready._id, name: 'Ready layer'}),
    ]);
    expect(detail.body.contextualLayersHash).toBe(
      await buildContextualLayersHash(detail.body.contextualLayers)
    );

    const list = await auth(
      request(app).get('/api/notebooks'),
      adminToken
    ).expect(200);
    const listRow = list.body.find(
      (row: {_id: string}) => row._id === projectId
    );
    expect(
      listRow.contextualLayers.map((layer: {id: string}) => layer.id)
    ).toEqual([ready._id]);

    const directory = await auth(
      request(app).get('/api/directory'),
      adminToken
    ).expect(200);
    const dirRow = directory.body.find(
      (row: {_id: string}) => row._id === projectId
    );
    expect(
      dirRow.contextualLayers.map((layer: {id: string}) => layer.id)
    ).toEqual([ready._id]);

    const links = await auth(
      request(app).get(`${MAP_ASSETS}/${pending._id}/links`),
      adminToken
    ).expect(200);
    expect(links.body.projectIds).toContain(projectId);

    await auth(
      request(app).delete(`${MAP_ASSETS}/${ready._id}/links/${projectId}`),
      adminToken
    ).expect(204);
    const emptied = await auth(
      request(app).get(`/api/notebooks/${projectId}`),
      adminToken
    ).expect(200);
    expect(emptied.body.contextualLayers).toEqual([]);
    expect(emptied.body.contextualLayersHash).toBe(
      await buildContextualLayersHash([])
    );
  });
});
