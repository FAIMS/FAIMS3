// SPDX-License-Identifier: Apache-2.0

/*
 * Admin stats API: 401/403/200, fixture-backed overall/team/people counts,
 * attachment (including photo) totals, unteamed row, cache hit vs refresh,
 * and GET /api/directory still without stats.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

/** Mock nano `info()`: `getByteCount` uses Couch HTTP, not in-memory Pouch. */
const getNanoDataDb = vi.hoisted(() => vi.fn());

vi.mock('../src/couchdb', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/couchdb')>();
  return {
    ...actual,
    getNanoDataDb,
  };
});

import {
  addGlobalRole,
  ADMIN_STATS_UNTEAMED_TEAM_ID,
  DEFAULT_MAP_ASSET_STYLE,
  GetAdminStatsPeopleResponseSchema,
  GetAdminStatsResponseSchema,
  GetAdminStatsTeamsResponseSchema,
  MAP_ASSET_DOC_TYPE,
  ProjectStatus,
  registerClient,
  Role,
} from '@faims3/data-model';
import request from 'supertest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {keyService} from '../src/buildconfig';
import {getAuthDB, getDataDb, getMapAssetsDB} from '../src/couchdb';
import {resetAdminStatsCache} from '../src/couchdb/adminStats';
import {
  createNewRefreshToken,
  invalidateToken,
} from '../src/couchdb/refreshTokens';
import {
  applyNotebookLifecycleStatus,
  countRecordsInNotebook,
  createNotebook,
  getProjectById,
} from '../src/couchdb/notebooks';
import {createTeamDocument} from '../src/couchdb/teams';
import {createTemplate} from '../src/couchdb/templates';
import {createUser, saveCouchUser} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {
  EMPTY_UI_SPECIFICATION,
  sampleCreateTemplatePayload,
} from './sampleNotebook';
import {adminToken, beforeApiTests, localUserToken} from './utils';

registerClient(callbackObject);

/** Fixture `sizes.active` returned by the mocked nano `info()` per project. */
const byteCountByProject = new Map<string, number>();

/**
 * Create a Couch user, grant the given global roles, and return a signed JWT.
 */
const createUserWithRolesAndToken = async ({
  username,
  roles,
  email,
}: {
  username: string;
  roles: Role[];
  email?: string;
}): Promise<string> => {
  const signingKey = await keyService.getSigningKey();
  const [dbUser, error] = await createUser({
    username,
    name: username,
    email,
  });
  expect(dbUser, `Failed to create user ${username}: ${error}`).not.toBeNull();
  for (const role of roles) {
    addGlobalRole({user: dbUser!, role});
  }
  await saveCouchUser(dbUser!);
  const expressUser = await upgradeCouchUserToExpressUser({dbUser: dbUser!});
  return await generateJwtFromUser({user: expressUser, signingKey});
};

/**
 * Create a notebook (optionally teamed) and record a mocked byte count for it.
 */
async function createNamedNotebook({
  name,
  teamId,
  bytes = 0,
}: {
  name: string;
  teamId?: string;
  bytes?: number;
}): Promise<string> {
  const projectId = await createNotebook({
    projectName: name,
    uiSpecification: EMPTY_UI_SPECIFICATION,
    description: '',
    createdBy: 'admin',
    teamId,
  });
  if (!projectId) {
    throw new Error(`could not create notebook ${name}`);
  }
  byteCountByProject.set(projectId, bytes);
  return projectId;
}

/** Insert a minimal `record_format_version: 1` document into a survey data DB. */
async function putRecord({
  projectId,
  recordId,
  createdBy,
}: {
  projectId: string;
  recordId: string;
  createdBy: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const dataDb = await getDataDb(projectId);
  await dataDb.put({
    _id: recordId,
    record_format_version: 1,
    created: now,
    created_by: createdBy,
    updatedAt: now,
    revisions: [],
    heads: [`${recordId}-rev`],
    type: 'FORM',
  });
}

/**
 * Insert a minimal `attach_format_version: 1` document (photo or other file)
 * linked to `recordId`.
 */
async function putAttachment({
  projectId,
  attachmentId,
  recordId,
  createdBy,
  contentType,
}: {
  projectId: string;
  attachmentId: string;
  recordId: string;
  createdBy: string;
  contentType: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const dataDb = await getDataDb(projectId);
  await dataDb.put({
    _id: attachmentId,
    attach_format_version: 1,
    avp_id: `${attachmentId}-avp`,
    revision_id: `${recordId}-rev`,
    record_id: recordId,
    created: now,
    created_by: createdBy,
    filename: contentType === 'image/jpeg' ? 'photo.jpg' : 'notes.txt',
    _attachments: {
      [attachmentId]: {
        content_type: contentType,
        data: Buffer.from('fixture-bytes'),
      },
    },
  });
}

/** Insert a map-layer document with a known `byteSize` (skips upload/staging). */
async function putMapAsset({
  id,
  byteSize,
  ownedByTeamId,
}: {
  id: string;
  byteSize: number;
  ownedByTeamId?: string;
}): Promise<void> {
  const now = Date.now();
  await getMapAssetsDB().put({
    _id: id,
    docType: MAP_ASSET_DOC_TYPE,
    name: id,
    description: '',
    createdBy: 'admin',
    originalFilename: `${id}.pmtiles`,
    ...(ownedByTeamId ? {ownedByTeamId} : {}),
    byteSize,
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

describe('admin stats API', () => {
  beforeEach(async () => {
    await beforeApiTests();
    resetAdminStatsCache();
    byteCountByProject.clear();
    getNanoDataDb.mockImplementation(async (projectId: string) => {
      return {
        info: async () => ({
          sizes: {active: byteCountByProject.get(projectId) ?? 0},
        }),
      } as any;
    });
  });

  afterEach(() => {
    getNanoDataDb.mockReset();
    resetAdminStatsCache();
  });

  describe('auth', () => {
    // Unauthenticated → 401; authenticated without VIEW_SYSTEM_STATS → 403;
    // OPERATIONS_ADMIN and GENERAL_ADMIN → 200.
    it('unauthenticated GET of each stats route returns 401', async () => {
      await request(app).get('/api/admin/stats').expect(401);
      await request(app).get('/api/admin/stats/teams').expect(401);
      await request(app).get('/api/admin/stats/people').expect(401);
      await request(app).post('/api/admin/stats/refresh').expect(401);
    });

    it('GENERAL_USER is forbidden (403)', async () => {
      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(403);
      await request(app)
        .get('/api/admin/stats/teams')
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(403);
      await request(app)
        .get('/api/admin/stats/people')
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(403);
    });

    it('OPERATIONS_ADMIN and GENERAL_ADMIN get 200 overall stats', async () => {
      const opsToken = await createUserWithRolesAndToken({
        username: 'ops-stats',
        roles: [Role.OPERATIONS_ADMIN],
      });

      const opsBody = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${opsToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(opsBody.generatedAt).toBeTruthy();
      expect(opsBody.expiresAt).toBeTruthy();
      expect(opsBody).not.toHaveProperty('photoCount');

      resetAdminStatsCache();

      const adminBody = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(adminBody.teamCount).toBeTypeOf('number');
      expect(adminBody.userCount).toBeTypeOf('number');
      expect(adminBody.loggedInUserCount).toBeTypeOf('number');
      expect(adminBody.notebookCount).toBeTypeOf('number');
      expect(adminBody.templateCount).toBeTypeOf('number');
      expect(adminBody.mapAssetCount).toBeTypeOf('number');
      expect(adminBody.mapAssetByteCount).toBeTypeOf('number');
      expect(adminBody.recordCount).toBeTypeOf('number');
      expect(adminBody.attachmentCount).toBeTypeOf('number');
      expect(adminBody.byteCount).toBeTypeOf('number');
    });
  });

  describe('overall counts', () => {
    // Fixture notebooks + records + mixed attachments (photo and other).
    it('counts notebooks including archived, teams, users, templates, records, attachments, and bytes', async () => {
      const team = await createTeamDocument({
        name: 'Stats Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const notebookA = await createNamedNotebook({
        name: 'Stats A',
        teamId: team._id,
        bytes: 111,
      });
      const notebookB = await createNamedNotebook({
        name: 'Stats B',
        bytes: 222,
      });
      await createTemplate({
        payload: sampleCreateTemplatePayload('Stats Template'),
        createdBy: 'admin',
      });

      const archived = await getProjectById(notebookB);
      await applyNotebookLifecycleStatus(archived, ProjectStatus.ARCHIVED);

      await putRecord({
        projectId: notebookA,
        recordId: 'rec-a1',
        createdBy: 'admin',
      });
      await putRecord({
        projectId: notebookB,
        recordId: 'rec-b1',
        createdBy: 'admin',
      });
      await putAttachment({
        projectId: notebookA,
        attachmentId: 'att-photo',
        recordId: 'rec-a1',
        createdBy: 'admin',
        contentType: 'image/jpeg',
      });
      await putAttachment({
        projectId: notebookA,
        attachmentId: 'att-file',
        recordId: 'rec-a1',
        createdBy: 'admin',
        contentType: 'text/plain',
      });

      const expectedRecords =
        (await countRecordsInNotebook(notebookA)) +
        (await countRecordsInNotebook(notebookB));

      const body = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(body.notebookCount).toBe(2);
      expect(body.archivedNotebookCount).toBe(1);
      expect(body.teamCount).toBe(1);
      expect(body.templateCount).toBe(1);
      expect(body.userCount).toBeGreaterThanOrEqual(3);
      expect(body.loggedInUserCount).toBe(0);
      expect(body.mapAssetCount).toBe(0);
      expect(body.mapAssetByteCount).toBe(0);
      expect(body.recordCount).toBe(expectedRecords);
      expect(body.recordCount).toBe(2);
      expect(body.attachmentCount).toBe(2);
      expect(body).not.toHaveProperty('photoCount');
      expect(body.byteCount).toBe(111 + 222);
      expect(body.incomplete).toBe(false);
      expect(body).not.toHaveProperty('incompleteNotebookIds');
    });

    it('marks incomplete and omits unknown sizes when Couch info() fails', async () => {
      const team = await createTeamDocument({
        name: 'Partial Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const healthy = await createNamedNotebook({
        name: 'Healthy bytes',
        teamId: team._id,
        bytes: 500,
      });
      const broken = await createNamedNotebook({
        name: 'Broken bytes',
        teamId: team._id,
        bytes: 999,
      });

      getNanoDataDb.mockImplementation(async (projectId: string) => {
        if (projectId === broken) {
          throw new Error('info failed');
        }
        return {
          info: async () => ({
            sizes: {active: byteCountByProject.get(projectId) ?? 0},
          }),
        } as any;
      });

      const body = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(body.incomplete).toBe(true);
      expect(body.incompleteNotebookIds).toEqual([broken]);
      expect(body.incompleteNotebookIds).not.toContain(healthy);
      // Healthy notebook still contributes; the -1 sentinel is not summed.
      expect(body.byteCount).toBe(500);
      expect(body.notebookCount).toBe(2);

      const teams = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      expect(teams.incomplete).toBe(true);
      const teamRow = teams.teams.find(row => row.teamId === team._id);
      expect(teamRow).toBeDefined();
      expect(teamRow!.notebookCount).toBe(2);
      expect(teamRow!.byteCount).toBe(500);
    });
  });

  describe('teams', () => {
    // Pagination, unteamed sentinel last, and team sums matching overall.
    it('pages team rows and splits counts by ownedByTeamId', async () => {
      const teamA = await createTeamDocument({
        name: 'Alpha Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const teamB = await createTeamDocument({
        name: 'Beta Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const extra = await createTeamDocument({
        name: 'Gamma Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const notebookA = await createNamedNotebook({
        name: 'A notebook',
        teamId: teamA._id,
        bytes: 10,
      });
      await createNamedNotebook({
        name: 'B notebook',
        teamId: teamB._id,
        bytes: 20,
      });
      await createNamedNotebook({
        name: 'C notebook',
        teamId: extra._id,
        bytes: 30,
      });
      await putRecord({
        projectId: notebookA,
        recordId: 'rec-team-a',
        createdBy: 'admin',
      });

      const page1 = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 1})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      expect(page1.teams).toHaveLength(1);
      expect(page1.limit).toBe(1);
      expect(page1.total).toBeGreaterThan(1);
      expect(page1.generatedAt).toBeTruthy();

      const page2 = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 1, offset: 1})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      expect(page2.teams).toHaveLength(1);
      expect(page2.teams[0].teamId).not.toBe(page1.teams[0].teamId);
      expect(page2.generatedAt).toBe(page1.generatedAt);

      const all = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      const rowA = all.teams.find(row => row.teamId === teamA._id);
      const rowB = all.teams.find(row => row.teamId === teamB._id);
      expect(rowA).toBeDefined();
      expect(rowA!.notebookCount).toBe(1);
      expect(rowA!.recordCount).toBe(1);
      expect(rowB!.notebookCount).toBe(1);
      expect(rowB!.recordCount).toBe(0);
    });

    it('includes an unteamed row and pages sum to overall totals', async () => {
      const team = await createTeamDocument({
        name: 'Owned Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const owned = await createNamedNotebook({
        name: 'Owned',
        teamId: team._id,
        bytes: 40,
      });
      const unteamed = await createNamedNotebook({
        name: 'Loose',
        bytes: 15,
      });
      await putRecord({
        projectId: owned,
        recordId: 'rec-owned',
        createdBy: 'admin',
      });
      await putRecord({
        projectId: unteamed,
        recordId: 'rec-loose',
        createdBy: 'admin',
      });
      await putAttachment({
        projectId: unteamed,
        attachmentId: 'att-loose',
        recordId: 'rec-loose',
        createdBy: 'admin',
        contentType: 'application/pdf',
      });

      const overall = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      const teams = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      expect(teams.generatedAt).toBe(overall.generatedAt);
      const unteamedRow = teams.teams.find(
        row => row.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID
      );
      expect(unteamedRow).toBeDefined();
      expect(unteamedRow!.notebookCount).toBe(1);
      expect(unteamedRow!.recordCount).toBe(1);
      expect(unteamedRow!.attachmentCount).toBe(1);
      expect(unteamedRow!.byteCount).toBe(15);

      const summedNotebooks = teams.teams.reduce(
        (sum, row) => sum + row.notebookCount,
        0
      );
      const summedRecords = teams.teams.reduce(
        (sum, row) => sum + row.recordCount,
        0
      );
      const summedAttachments = teams.teams.reduce(
        (sum, row) => sum + row.attachmentCount,
        0
      );
      const summedBytes = teams.teams.reduce(
        (sum, row) => sum + row.byteCount,
        0
      );
      const summedMapAssetBytes = teams.teams.reduce(
        (sum, row) => sum + row.mapAssetByteCount,
        0
      );
      expect(summedNotebooks).toBe(overall.notebookCount);
      expect(summedRecords).toBe(overall.recordCount);
      expect(summedAttachments).toBe(overall.attachmentCount);
      expect(summedBytes).toBe(overall.byteCount);
      expect(summedMapAssetBytes).toBe(overall.mapAssetByteCount);
    });

    it('attributes map-layer byteSize to ownedByTeamId and the unteamed row', async () => {
      const team = await createTeamDocument({
        name: 'Layer Team',
        description: '',
        createdBy: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await putMapAsset({
        id: 'asset-team',
        ownedByTeamId: team._id,
        byteSize: 1000,
      });
      await putMapAsset({id: 'asset-personal', byteSize: 250});

      const overall = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(overall.mapAssetCount).toBe(2);
      expect(overall.mapAssetByteCount).toBe(1250);

      const teams = await request(app)
        .get('/api/admin/stats/teams')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body));

      const teamRow = teams.teams.find(row => row.teamId === team._id);
      const unteamedRow = teams.teams.find(
        row => row.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID
      );
      expect(teamRow).toBeDefined();
      expect(teamRow!.mapAssetByteCount).toBe(1000);
      expect(unteamedRow).toBeDefined();
      expect(unteamedRow!.mapAssetByteCount).toBe(250);
      expect(
        teams.teams.reduce((sum, row) => sum + row.mapAssetByteCount, 0)
      ).toBe(overall.mapAssetByteCount);
    });
  });

  describe('people', () => {
    // Records keyed by record created_by; attachments by the uploader.
    it('pages people by created_by, includes email, omits users with no records or session', async () => {
      await createUser({
        username: 'alice',
        name: 'Alice',
        email: 'alice@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'bob',
        name: 'Bob',
        email: 'bob@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'carol',
        name: 'Carol',
        email: 'carol@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });

      const notebook = await createNamedNotebook({name: 'People NB', bytes: 5});
      await putRecord({
        projectId: notebook,
        recordId: 'rec-alice',
        createdBy: 'alice',
      });
      await putRecord({
        projectId: notebook,
        recordId: 'rec-bob',
        createdBy: 'bob',
      });
      await putAttachment({
        projectId: notebook,
        attachmentId: 'att-alice-photo',
        recordId: 'rec-alice',
        createdBy: 'alice',
        contentType: 'image/jpeg',
      });
      await putAttachment({
        projectId: notebook,
        attachmentId: 'att-bob-file',
        recordId: 'rec-bob',
        createdBy: 'bob',
        contentType: 'text/plain',
      });

      const page1 = await request(app)
        .get('/api/admin/stats/people')
        .query({limit: 1})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body));

      expect(page1.people).toHaveLength(1);
      expect(page1.total).toBe(2);
      expect(page1.limit).toBe(1);

      const page2 = await request(app)
        .get('/api/admin/stats/people')
        .query({limit: 1, offset: 1})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body));

      expect(page2.people).toHaveLength(1);
      expect(page2.people[0].userId).not.toBe(page1.people[0].userId);
      expect(page2.generatedAt).toBe(page1.generatedAt);

      const all = await request(app)
        .get('/api/admin/stats/people')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body));

      const ids = all.people.map(row => row.userId);
      expect(ids).toContain('alice');
      expect(ids).toContain('bob');
      expect(ids).not.toContain('carol');

      const alice = all.people.find(row => row.userId === 'alice')!;
      const bob = all.people.find(row => row.userId === 'bob')!;
      expect(alice.email).toBe('alice@example.com');
      expect(bob.email).toBe('bob@example.com');
      expect(alice.recordCount).toBe(1);
      expect(alice.attachmentCount).toBe(1);
      expect(alice.loggedIn).toBe(false);
      expect(bob.recordCount).toBe(1);
      expect(bob.attachmentCount).toBe(1);
      expect(bob.loggedIn).toBe(false);
    });

    it('attributes attachments to the uploader, not the parent record owner', async () => {
      await createUser({
        username: 'alice',
        name: 'Alice',
        email: 'alice@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'bob',
        name: 'Bob',
        email: 'bob@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });

      const notebook = await createNamedNotebook({
        name: 'Cross-user attach',
        bytes: 5,
      });
      await putRecord({
        projectId: notebook,
        recordId: 'rec-alice',
        createdBy: 'alice',
      });
      await putAttachment({
        projectId: notebook,
        attachmentId: 'att-bob-on-alice',
        recordId: 'rec-alice',
        createdBy: 'bob',
        contentType: 'image/jpeg',
      });

      const all = await request(app)
        .get('/api/admin/stats/people')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body));

      const alice = all.people.find(row => row.userId === 'alice');
      const bob = all.people.find(row => row.userId === 'bob');
      expect(alice).toBeDefined();
      expect(bob).toBeDefined();
      expect(alice!.recordCount).toBe(1);
      expect(alice!.attachmentCount).toBe(0);
      expect(bob!.recordCount).toBe(0);
      expect(bob!.attachmentCount).toBe(1);
    });

    it('includes users with active refresh tokens and counts unique logged-in users', async () => {
      await createUser({
        username: 'carol',
        name: 'Carol',
        email: 'carol@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'dave',
        name: 'Dave',
        email: 'dave@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'eve',
        name: 'Eve',
        email: 'eve@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });
      await createUser({
        username: 'frank',
        name: 'Frank',
        email: 'frank@example.com',
      }).then(async ([user, error]) => {
        expect(user, error).not.toBeNull();
        await saveCouchUser(user!);
      });

      await createNewRefreshToken({userId: 'carol'});
      const {refresh: expired} = await createNewRefreshToken({userId: 'dave'});
      await getAuthDB().put({
        ...expired,
        expiryTimestampMs: Date.now() - 1000,
      });
      const {refresh: disabled} = await createNewRefreshToken({userId: 'eve'});
      await invalidateToken(disabled.token);
      await createNewRefreshToken({userId: 'frank'});
      await createNewRefreshToken({userId: 'frank'});

      const overall = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(overall.loggedInUserCount).toBe(2);

      const all = await request(app)
        .get('/api/admin/stats/people')
        .query({limit: 50})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body));

      const ids = all.people.map(row => row.userId);
      expect(ids).toContain('carol');
      expect(ids).toContain('frank');
      expect(ids).not.toContain('dave');
      expect(ids).not.toContain('eve');

      const carol = all.people.find(row => row.userId === 'carol')!;
      const frank = all.people.find(row => row.userId === 'frank')!;
      expect(carol.email).toBe('carol@example.com');
      expect(carol.recordCount).toBe(0);
      expect(carol.attachmentCount).toBe(0);
      expect(carol.loggedIn).toBe(true);
      expect(frank.loggedIn).toBe(true);
      expect(frank.recordCount).toBe(0);
    });
  });

  describe('cache', () => {
    // Second GET is a cache hit; ?refresh=true and POST /refresh recompute.
    it('reuses generatedAt within the TTL and refresh computes a new snapshot', async () => {
      await createNamedNotebook({name: 'Cache NB', bytes: 9});

      const first = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(new Date(first.expiresAt).getTime()).toBeGreaterThan(
        new Date(first.generatedAt).getTime()
      );

      const second = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(second.generatedAt).toBe(first.generatedAt);
      expect(second.notebookCount).toBe(first.notebookCount);

      await new Promise(resolve => setTimeout(resolve, 5));

      const refreshedGet = await request(app)
        .get('/api/admin/stats')
        .query({refresh: 'true'})
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(
        new Date(refreshedGet.generatedAt).getTime()
      ).toBeGreaterThanOrEqual(new Date(first.generatedAt).getTime());
      expect(new Date(refreshedGet.expiresAt).getTime()).toBeGreaterThan(
        new Date(refreshedGet.generatedAt).getTime()
      );

      await new Promise(resolve => setTimeout(resolve, 5));

      const refreshedPost = await request(app)
        .post('/api/admin/stats/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then(res => GetAdminStatsResponseSchema.parse(res.body));

      expect(
        new Date(refreshedPost.generatedAt).getTime()
      ).toBeGreaterThanOrEqual(new Date(refreshedGet.generatedAt).getTime());
    });

    it('coalesces concurrent refresh callers onto one snapshot', async () => {
      await createNamedNotebook({name: 'Coalesce NB', bytes: 1});

      const [overall, teams, people, posted] = await Promise.all([
        request(app)
          .get('/api/admin/stats')
          .query({refresh: 'true'})
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .then(res => GetAdminStatsResponseSchema.parse(res.body)),
        request(app)
          .get('/api/admin/stats/teams')
          .query({refresh: 'true'})
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .then(res => GetAdminStatsTeamsResponseSchema.parse(res.body)),
        request(app)
          .get('/api/admin/stats/people')
          .query({refresh: 'true'})
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .then(res => GetAdminStatsPeopleResponseSchema.parse(res.body)),
        request(app)
          .post('/api/admin/stats/refresh')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .then(res => GetAdminStatsResponseSchema.parse(res.body)),
      ]);

      expect(teams.generatedAt).toBe(overall.generatedAt);
      expect(people.generatedAt).toBe(overall.generatedAt);
      expect(posted.generatedAt).toBe(overall.generatedAt);
    });
  });

  describe('directory listing', () => {
    // GET /api/directory/ is unchanged: no stats fields on listing items.
    it('GET /api/directory still omits stats fields', async () => {
      const projectId = await createNamedNotebook({name: 'Dir NB', bytes: 99});

      const response = await request(app)
        .get('/api/directory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const item = response.body.find(
        (row: {_id: string}) => row._id === projectId
      );
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('byteCount');
      expect(item).not.toHaveProperty('recordCount');
      expect(item).not.toHaveProperty('attachmentCount');
      expect(item).not.toHaveProperty('photoCount');
    });
  });
});
