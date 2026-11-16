// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: listingSearch.test.ts
 * Description:
 *   The `q` search parameter of the list GETs that have one: notebooks,
 *   templates, teams, users and map layers. Each search runs through HTTP
 *   against the real design-document views.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  addProjectRole,
  addTeamRole,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  encodeListCursor,
  LIST_SEARCH_MAX_LENGTH,
  ProjectStatus,
  registerClient,
  Role,
} from '@faims3/data-model';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {keyService} from '../src/buildconfig';
import {getMapAssetsDB, getTemplatesDb} from '../src/couchdb';
import {createMapAsset, linkMapAsset} from '../src/couchdb/mapAssets/store';
import {
  applyNotebookLifecycleStatus,
  createNotebook,
  getProjectById,
} from '../src/couchdb/notebooks';
import {archiveTeam, createTeamDocument} from '../src/couchdb/teams';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {EMPTY_UI_SPECIFICATION} from './sampleNotebook';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

type Query = Record<string, string | number | undefined>;
type Row = {_id: string; name?: string};

function get(path: string, query: Query = {}, token: string = adminToken) {
  const defined = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined)
  );
  return requestAuthAndType(request(app).get(path).query(defined), token);
}

/**
 * Every page of a list, following `nextStartKey`, as the rows under
 * `itemsKey`.
 */
async function pagesOf(
  path: string,
  itemsKey: string,
  query: Query = {},
  token: string = adminToken
): Promise<Row[][]> {
  const pages: Row[][] = [];
  let startKey: string | undefined;
  for (;;) {
    const {body} = await get(path, {...query, startKey}, token).expect(200);
    pages.push(body[itemsKey]);
    if (!body.nextStartKey) return pages;
    expect(body.nextStartKey).not.toBe(startKey);
    expect(pages.length).toBeLessThan(50);
    startKey = body.nextStartKey;
  }
}

/** Names of every row a search returns, in the order returned. */
async function namesOf(
  path: string,
  itemsKey: string,
  query: Query = {},
  token: string = adminToken
): Promise<string[]> {
  const pages = await pagesOf(path, itemsKey, query, token);
  return pages.flat().map(row => row.name ?? '');
}

async function createSurvey(
  projectName: string,
  options: {teamId?: string; templateId?: string} = {}
): Promise<string> {
  const projectId = await createNotebook({
    projectName,
    uiSpecification: EMPTY_UI_SPECIFICATION,
    description: '',
    createdBy: 'admin',
    ...options,
  });
  if (!projectId) throw new Error(`could not create survey ${projectName}`);
  return projectId;
}

let teamClock = 1_700_000_000_000;
async function createTeam(name: string) {
  teamClock += 1000;
  return createTeamDocument({
    name,
    description: '',
    createdBy: 'admin',
    createdAt: teamClock,
    updatedAt: teamClock,
  });
}

async function createTemplateDoc(
  id: string,
  name: string,
  extra: {isPublic?: boolean; archived?: boolean; ownedByTeamId?: string} = {}
) {
  const now = new Date().toISOString();
  await getTemplatesDb().put({
    _id: id,
    name,
    version: 1,
    archived: extra.archived === true,
    isPublic: extra.isPublic === true,
    ownedByTeamId: extra.ownedByTeamId,
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now,
    uiSpecification: {uiSpec: {fields: {}}, metadata: {}},
    uiSpecProperties: {
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      hash: 'a'.repeat(64),
    },
  } as never);
}

async function createLayer(
  name: string,
  {teamId, ready = false}: {teamId?: string; ready?: boolean} = {}
) {
  const asset = await createMapAsset({
    name,
    description: '',
    createdBy: 'admin',
    ...(teamId ? {ownedByTeamId: teamId} : {}),
    files: [
      {
        filename: 'layer.geojson',
        bytes: Buffer.from('{"type":"FeatureCollection","features":[]}'),
      },
    ],
    primaryFilename: 'layer.geojson',
  });
  if (ready) {
    const db = getMapAssetsDB();
    const stored = (await db.get(asset._id)) as object;
    await db.put({...stored, status: 'ready'} as never);
  }
  return asset._id;
}

async function requireUser(username: string) {
  const user = await getCouchUserFromEmailOrUserId(username);
  if (!user) throw new Error(`user ${username} missing`);
  return user;
}

/** A fresh token for `username`, carrying the roles saved so far. */
async function tokenFor(username: string) {
  return generateJwtFromUser({
    user: await upgradeCouchUserToExpressUser({
      dbUser: await requireUser(username),
    }),
    signingKey: await keyService.getSigningKey(),
  });
}

describe('list search (q)', () => {
  beforeEach(async () => {
    await beforeApiTests();
    const db = getMapAssetsDB();
    for (const row of (await db.allDocs()).rows) {
      if (!row.id.startsWith('_design')) await db.remove(row.id, row.value.rev);
    }
  });

  describe('every searchable list', () => {
    const paths = [
      '/api/notebooks',
      '/api/templates',
      '/api/teams',
      '/api/users',
      '/api/map-assets',
    ];

    it.each(paths)('%s rejects an over-long q', async path => {
      await get(path, {q: 'x'.repeat(LIST_SEARCH_MAX_LENGTH + 1)}).expect(400);
      await get(path, {q: 'x'.repeat(LIST_SEARCH_MAX_LENGTH)}).expect(200);
    });

    it.each(paths)(
      '%s answers a cursor from outside the search with an empty page',
      async path => {
        for (const startKey of [
          'not-json',
          encodeListCursor(['zebra', 'no-such-row']),
          encodeListCursor([1_700_000_000_000, 'no-such-row']),
        ]) {
          const {body} = await get(path, {q: 'a', startKey}).expect(200);
          expect(Object.values(body).filter(Array.isArray)).toEqual([[]]);
          expect(body.nextStartKey).toBeUndefined();
        }
      }
    );
  });

  describe('GET /api/notebooks', () => {
    const search = (query: Query, token?: string) =>
      namesOf('/api/notebooks', 'notebooks', query, token);

    it('finds surveys with a word starting with each word typed', async () => {
      await createSurvey('Blue Team Notebook');
      await createSurvey('Red Team Notebook');
      await createSurvey('Bluebird survey');
      await createSurvey('Coastal erosion (2026)');

      expect((await search({q: 'blu'})).sort()).toEqual([
        'Blue Team Notebook',
        'Bluebird survey',
      ]);
      expect(await search({q: 'TEAM red'})).toEqual(['Red Team Notebook']);
      expect(await search({q: '2026'})).toEqual(['Coastal erosion (2026)']);
      // Words match from their start only.
      expect(await search({q: 'lue'})).toEqual([]);
      expect(await search({q: 'blue coastal'})).toEqual([]);
    });

    it('returns the same rows as the plain list', async () => {
      await createSurvey('Coastal erosion');
      const listed = await get('/api/notebooks').expect(200);
      const found = await get('/api/notebooks', {q: 'coast'}).expect(200);
      expect(found.body.notebooks).toEqual(listed.body.notebooks);
    });

    it('serves the plain list when q holds no word', async () => {
      await createSurvey('Coastal erosion');
      await createSurvey('Soil survey');
      expect((await search({q: ' -- '})).sort()).toEqual([
        'Coastal erosion',
        'Soil survey',
      ]);
    });

    it('pages matches without repeats, in word order', async () => {
      for (let i = 0; i < 7; i++) {
        await createSurvey(`Site ${i} survey sites`);
      }
      await createSurvey('Unrelated');
      const pages = await pagesOf('/api/notebooks', 'notebooks', {
        q: 'sit',
        limit: 3,
      });
      // Each survey has two words starting "sit"; it is listed once.
      expect(pages.map(page => page.length)).toEqual([3, 3, 1]);
      expect(new Set(pages.flat().map(row => row._id)).size).toBe(7);
    });

    it('follows a rename', async () => {
      const projectId = await createSurvey('Coastal erosion');
      expect(await search({q: 'coast'})).toEqual(['Coastal erosion']);
      await requestAuthAndType(
        request(app)
          .put(`/api/notebooks/${projectId}`)
          .send({name: 'Inland dunes', description: ''}),
        adminToken
      ).expect(200);
      expect(await search({q: 'coast'})).toEqual([]);
      expect(await search({q: 'dune'})).toEqual(['Inland dunes']);
    });

    it('searches inside a team and inside a template', async () => {
      const blue = await createTeam('Blue');
      const red = await createTeam('Red');
      await createSurvey('Coastal one', {teamId: blue._id});
      await createSurvey('Coastal two', {teamId: red._id, templateId: 'tpl-a'});
      await createSurvey('Coastal three', {
        teamId: blue._id,
        templateId: 'tpl-a',
      });
      await createSurvey('Inland', {teamId: blue._id, templateId: 'tpl-a'});

      expect((await search({q: 'coast', teamId: blue._id})).sort()).toEqual([
        'Coastal one',
        'Coastal three',
      ]);
      expect((await search({q: 'coast', templateId: 'tpl-a'})).sort()).toEqual([
        'Coastal three',
        'Coastal two',
      ]);
      expect(
        await search({q: 'coast', templateId: 'tpl-a', teamId: red._id})
      ).toEqual(['Coastal two']);
    });

    it('leaves archived surveys out and refuses to search them', async () => {
      const archived = await createSurvey('Coastal archive');
      await createSurvey('Coastal live');
      await applyNotebookLifecycleStatus(
        await getProjectById(archived),
        ProjectStatus.ARCHIVED
      );

      expect(await search({q: 'coast'})).toEqual(['Coastal live']);
      for (const status of ['archived', 'all']) {
        await get('/api/notebooks', {q: 'coast', status}).expect(400);
      }
      await get('/api/notebooks', {q: 'coast', includeArchived: 'true'}).expect(
        400
      );
      // Without a word to search for, the archived list is served as usual.
      await get('/api/notebooks', {q: '  ', status: 'archived'}).expect(200);
    });

    it('fills a page with only the matches the caller can read', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        ids.push(await createSurvey(`Coastal ${i}`));
      }
      const localUser = await requireUser(localUserName);
      for (const projectId of [ids[0], ids[3], ids[5]]) {
        addProjectRole({user: localUser, projectId, role: Role.PROJECT_GUEST});
      }
      await saveCouchUser(localUser);
      const token = await tokenFor(localUserName);

      const pages = await pagesOf(
        '/api/notebooks',
        'notebooks',
        {q: 'coast', limit: 2},
        token
      );
      expect(pages[0]).toHaveLength(2);
      expect(
        pages
          .flat()
          .map(row => row._id)
          .sort()
      ).toEqual([ids[0], ids[3], ids[5]].sort());
    });
  });

  describe('GET /api/templates', () => {
    const search = (query: Query, token?: string) =>
      namesOf('/api/templates', 'templates', query, token);

    it('searches by name, inside a team and by visibility', async () => {
      const blue = await createTeam('Blue');
      await createTemplateDoc('t1', 'Soil core template', {isPublic: true});
      await createTemplateDoc('t2', 'Soil pit template', {
        ownedByTeamId: blue._id,
      });
      await createTemplateDoc('t3', 'Water quality');

      expect((await search({q: 'soil'})).sort()).toEqual([
        'Soil core template',
        'Soil pit template',
      ]);
      expect(await search({q: 'soil', teamId: blue._id})).toEqual([
        'Soil pit template',
      ]);
      expect(await search({q: 'soil', visibility: 'public'})).toEqual([
        'Soil core template',
      ]);
      expect(await search({q: 'template pit'})).toEqual(['Soil pit template']);
    });

    it('leaves archived templates out and refuses to search them', async () => {
      await createTemplateDoc('t1', 'Soil live');
      await createTemplateDoc('t2', 'Soil archived', {archived: true});

      expect(await search({q: 'soil'})).toEqual(['Soil live']);
      await get('/api/templates', {q: 'soil', includeArchived: 'true'}).expect(
        400
      );
    });

    it('returns only the matches the caller can read', async () => {
      const blue = await createTeam('Blue');
      await createTemplateDoc('t1', 'Soil public', {isPublic: true});
      await createTemplateDoc('t2', 'Soil private');
      await createTemplateDoc('t3', 'Soil team', {ownedByTeamId: blue._id});
      const localUser = await requireUser(localUserName);
      addTeamRole({user: localUser, teamId: blue._id, role: Role.TEAM_MEMBER});
      await saveCouchUser(localUser);

      expect(
        (await search({q: 'soil'}, await tokenFor(localUserName))).sort()
      ).toEqual(['Soil public', 'Soil team']);
    });
  });

  describe('GET /api/teams', () => {
    const search = (query: Query, token?: string) =>
      namesOf('/api/teams', 'teams', query, token);

    it('searches by name and pages the matches', async () => {
      for (let i = 0; i < 5; i++) {
        await createTeam(`Field Team ${i}`);
      }
      await createTeam('Laboratory');

      expect(await search({q: 'lab'})).toEqual(['Laboratory']);
      const pages = await pagesOf('/api/teams', 'teams', {
        q: 'field',
        limit: 2,
      });
      expect(pages.map(page => page.length)).toEqual([2, 2, 1]);
      expect(new Set(pages.flat().map(row => row._id)).size).toBe(5);
    });

    it('leaves archived teams out and refuses to search them', async () => {
      await createTeam('Field live');
      const archived = await createTeam('Field archived');
      await archiveTeam(archived._id, true);

      expect(await search({q: 'field'})).toEqual(['Field live']);
      await get('/api/teams', {q: 'field', includeArchived: 'true'}).expect(
        400
      );
    });

    it('returns only the matches the caller can view', async () => {
      const mine = await createTeam('Field mine');
      await createTeam('Field other');
      const localUser = await requireUser(localUserName);
      addTeamRole({user: localUser, teamId: mine._id, role: Role.TEAM_MEMBER});
      await saveCouchUser(localUser);

      expect(await search({q: 'field'}, await tokenFor(localUserName))).toEqual(
        ['Field mine']
      );
    });
  });

  describe('GET /api/users', () => {
    const search = async (query: Query) => {
      const pages = await pagesOf('/api/users', 'users', query);
      return pages
        .flat()
        .map(row => (row as unknown as {user_id: string}).user_id);
    };

    const createPerson = async (
      username: string,
      name: string,
      email?: string
    ) => {
      const [user, error] = await createUser({username, name, email});
      if (!user) throw new Error(`could not create ${username}: ${error}`);
      await saveCouchUser(user);
      return user;
    };

    it('searches by name and by email address', async () => {
      await createPerson('ada', 'Ada Lovelace', 'countess@engine.example');
      await createPerson('grace', 'Grace Hopper', 'grace@navy.example');

      expect(await search({q: 'love'})).toEqual(['ada']);
      expect(await search({q: 'GRACE hop'})).toEqual(['grace']);
      expect(await search({q: 'countess'})).toEqual(['ada']);
      expect(await search({q: 'grace@navy.example'})).toEqual(['grace']);
      expect((await search({q: 'example'})).sort()).toEqual(['ada', 'grace']);
      expect(await search({q: 'ada@navy'})).toEqual([]);
    });

    it('returns the plain list rows, without login secrets', async () => {
      const listed = await get('/api/users').expect(200);
      const found = await get('/api/users', {q: adminUserName}).expect(200);
      expect(found.body.users).toHaveLength(1);
      expect(listed.body.users).toContainEqual(found.body.users[0]);
      expect(JSON.stringify(found.body)).not.toMatch(/password|salt|hash/i);
    });

    it('leaves disabled accounts out and refuses to search them', async () => {
      const gone = await createPerson('gone', 'Gone Person');
      await createPerson('here', 'Here Person');
      await saveCouchUser({...gone, disabled: true});

      expect(await search({q: 'person'})).toEqual(['here']);
      await get('/api/users', {q: 'person', includeArchived: 'true'}).expect(
        400
      );
    });

    it('is closed to callers who cannot list users', async () => {
      await get('/api/users', {q: 'a'}, await tokenFor(localUserName)).expect(
        401
      );
    });
  });

  describe('map layers', () => {
    const search = (query: Query, token?: string) =>
      namesOf('/api/map-assets', 'assets', query, token);

    it('searches the library and one team', async () => {
      const blue = await createTeam('Blue');
      await createLayer('Harbour chart');
      await createLayer('Harbour soundings', {teamId: blue._id});
      await createLayer('River gauge', {teamId: blue._id});

      expect((await search({q: 'harb'})).sort()).toEqual([
        'Harbour chart',
        'Harbour soundings',
      ]);
      expect(await search({q: 'harb', teamId: blue._id})).toEqual([
        'Harbour soundings',
      ]);
      expect(
        await namesOf(`/api/teams/${blue._id}/map-assets`, 'assets', {q: 'riv'})
      ).toEqual(['River gauge']);
    });

    it('pages the matches', async () => {
      for (let i = 0; i < 5; i++) {
        await createLayer(`Harbour ${i}`);
      }
      const pages = await pagesOf('/api/map-assets', 'assets', {
        q: 'harbour',
        limit: 2,
      });
      expect(pages.map(page => page.length)).toEqual([2, 2, 1]);
      expect(new Set(pages.flat().map(row => row._id)).size).toBe(5);
    });

    it('searches the layers a survey could still link', async () => {
      const projectId = await createSurvey('Linkable');
      await createLayer('Harbour ready', {ready: true});
      await createLayer('Harbour pending');
      const linked = await createLayer('Harbour linked', {ready: true});
      await linkMapAsset({assetId: linked, projectId, linkedBy: 'admin'});
      await createLayer('River ready', {ready: true});

      expect(await search({q: 'harb', linkableToProjectId: projectId})).toEqual(
        ['Harbour ready']
      );
    });

    it('refuses to search the layers linked to a survey', async () => {
      const projectId = await createSurvey('Linked');
      await get('/api/map-assets', {q: 'harb', projectId}).expect(400);
    });

    it('returns only the matches the caller can read', async () => {
      const blue = await createTeam('Blue');
      await createLayer('Harbour team', {teamId: blue._id});
      await createLayer('Harbour other');
      const localUser = await requireUser(localUserName);
      addTeamRole({user: localUser, teamId: blue._id, role: Role.TEAM_MANAGER});
      await saveCouchUser(localUser);

      expect(await search({q: 'harb'}, await tokenFor(localUserName))).toEqual([
        'Harbour team',
      ]);
    });
  });
});
