// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: listingPagination.test.ts
 * Description:
 *   Cursor pagination (`limit`, `startKey`, `nextStartKey`) for every list
 *   GET that is not templates or map layers: notebooks, teams, users, team
 *   members, notebook users, invites and long-lived tokens. Also pins
 *   GET /api/directory as a complete, unpaginated array.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  addProjectRole,
  addTeamRole,
  GetDirectoryResponseSchema,
  GetGlobalInvitesResponseSchema,
  GetListAllUsersResponseSchema,
  GetListTeamsResponseSchema,
  GetLongLivedTokensResponseSchema,
  GetNotebookListResponseSchema,
  GetNotebookUsersResponseSchema,
  GetProjectInvitesResponseSchema,
  GetTeamInvitesResponseSchema,
  GetTeamMembersResponseSchema,
  LIST_DEFAULT_LIMIT,
  LIST_LIMIT_MAX,
  ProjectStatus,
  registerClient,
  Resource,
  Role,
} from '@faims3/data-model';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {keyService} from '../src/buildconfig';
import {createGlobalInvite, createResourceInvite} from '../src/couchdb/invites';
import {createNewLongLivedToken} from '../src/couchdb/longLivedTokens';
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
  notebookUserName,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

type Page<T> = {items: T[]; nextStartKey?: string};

/**
 * Follows `nextStartKey` until it is absent and returns every page. Fails
 * rather than looping forever if a cursor never runs out.
 */
async function collectPages<T>(
  fetchPage: (startKey?: string) => Promise<Page<T>>
): Promise<Page<T>[]> {
  const pages: Page<T>[] = [];
  let startKey: string | undefined;
  for (;;) {
    const page = await fetchPage(startKey);
    pages.push(page);
    if (!page.nextStartKey) {
      return pages;
    }
    expect(page.nextStartKey).not.toBe(startKey);
    expect(pages.length).toBeLessThan(50);
    startKey = page.nextStartKey;
  }
}

/** GET `path` with `query` as `token` and expect 200. */
async function getOk(
  path: string,
  query: Record<string, string | number | undefined> = {},
  token: string = adminToken
) {
  const defined = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined)
  );
  return requestAuthAndType(
    request(app).get(path).query(defined),
    token
  ).expect(200);
}

async function createTestNotebook(
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
  if (!projectId) {
    throw new Error(`could not create test notebook ${projectName}`);
  }
  return projectId;
}

async function archiveNotebook(projectId: string) {
  await applyNotebookLifecycleStatus(
    await getProjectById(projectId),
    ProjectStatus.ARCHIVED
  );
}

/** Teams with explicit, strictly increasing `createdAt` (index = age rank). */
async function createTeams(count: number, prefix = 'Team') {
  const teams = [];
  for (let i = 0; i < count; i++) {
    teams.push(
      await createTeamDocument({
        name: `${prefix} ${i}`,
        description: '',
        createdBy: 'admin',
        createdAt: 1_700_000_000_000 + i * 1000,
        updatedAt: 1_700_000_000_000 + i * 1000,
      })
    );
  }
  return teams;
}

async function createNamedUser(username: string, name: string) {
  const [user, error] = await createUser({username, name});
  if (!user) {
    throw new Error(`could not create ${username}: ${error}`);
  }
  await saveCouchUser(user);
  return user;
}

async function requireUser(username: string) {
  const user = await getCouchUserFromEmailOrUserId(username);
  if (!user) {
    throw new Error(`user ${username} missing`);
  }
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

describe('list endpoint pagination', () => {
  beforeEach(beforeApiTests);

  describe('query validation shared by every list', () => {
    const paths = [
      '/api/notebooks',
      '/api/teams',
      '/api/users',
      '/api/invites/global',
      '/api/long-lived-tokens',
    ];

    it.each(paths)('%s rejects an out-of-range limit', async path => {
      for (const limit of [
        '0',
        '-1',
        'abc',
        '1.5',
        String(LIST_LIMIT_MAX + 1),
      ]) {
        await requestAuthAndType(
          request(app).get(path).query({limit}),
          adminToken
        ).expect(400);
      }
      await getOk(path, {limit: LIST_LIMIT_MAX});
    });

    it.each(paths)(
      '%s returns an empty page with no cursor for an unknown startKey',
      async path => {
        for (const startKey of [
          'not-json',
          JSON.stringify([1_700_000_000_000, 'no-such-row']),
          JSON.stringify(['zzz', 'no-such-row']),
        ]) {
          const {body} = await getOk(path, {startKey});
          const lists = Object.values(body).filter(Array.isArray);
          expect(lists).toEqual([[]]);
          expect(body.nextStartKey).toBeUndefined();
        }
      }
    );
  });

  describe('GET /api/notebooks', () => {
    const listNotebooks = async (
      query: Record<string, string | number | undefined> = {},
      token: string = adminToken
    ) => {
      const {body} = await getOk('/api/notebooks', query, token);
      const parsed = GetNotebookListResponseSchema.parse(body);
      return {items: parsed.notebooks, nextStartKey: parsed.nextStartKey};
    };

    it('walks every survey exactly once, newest first', async () => {
      const created: string[] = [];
      for (let i = 0; i < 5; i++) {
        created.push(await createTestNotebook(`Survey ${i}`));
      }

      const pages = await collectPages(startKey =>
        listNotebooks({limit: 2, startKey})
      );
      expect(pages.map(page => page.items.length)).toEqual([2, 2, 1]);
      const ids = pages.flatMap(page => page.items.map(n => n._id));
      expect([...ids].sort()).toEqual([...created].sort());

      const createdAt = pages.flatMap(page =>
        page.items.map(n => Date.parse(n.createdAt as string))
      );
      expect(createdAt).toEqual([...createdAt].sort((a, b) => b - a));
    });

    it('omits nextStartKey when the page ends on the last survey', async () => {
      for (let i = 0; i < 4; i++) {
        await createTestNotebook(`Survey ${i}`);
      }
      const pages = await collectPages(startKey =>
        listNotebooks({limit: 2, startKey})
      );
      expect(pages.map(page => page.items.length)).toEqual([2, 2]);
    });

    it(`defaults to ${LIST_DEFAULT_LIMIT} rows`, async () => {
      for (let i = 0; i < LIST_DEFAULT_LIMIT + 2; i++) {
        await createTestNotebook(`Survey ${i}`);
      }
      const first = await listNotebooks();
      expect(first.items).toHaveLength(LIST_DEFAULT_LIMIT);
      expect(first.nextStartKey).toBeDefined();
    });

    it('filters by status: active (default), archived, all', async () => {
      const activeIds = [
        await createTestNotebook('Active one'),
        await createTestNotebook('Active two'),
      ];
      const archivedIds = [
        await createTestNotebook('Archived one'),
        await createTestNotebook('Archived two'),
      ];
      for (const id of archivedIds) {
        await archiveNotebook(id);
      }

      const idsFor = async (
        query: Record<string, string | number | undefined>
      ) =>
        (
          await collectPages(startKey =>
            listNotebooks({...query, limit: 3, startKey})
          )
        ).flatMap(page => page.items.map(n => n._id));

      expect((await idsFor({})).sort()).toEqual([...activeIds].sort());
      expect((await idsFor({status: 'active'})).sort()).toEqual(
        [...activeIds].sort()
      );
      expect((await idsFor({status: 'archived'})).sort()).toEqual(
        [...archivedIds].sort()
      );

      // `all` lists the active surveys first, then the archived ones, and the
      // cursor crosses that boundary.
      const all = await idsFor({status: 'all'});
      expect(all).toHaveLength(4);
      expect(all.slice(0, 2).sort()).toEqual([...activeIds].sort());
      expect(all.slice(2).sort()).toEqual([...archivedIds].sort());

      // Deprecated alias: includeArchived=true means every status.
      expect((await idsFor({includeArchived: 'true'})).sort()).toEqual(
        [...activeIds, ...archivedIds].sort()
      );
    });

    it('scopes to a team and to a template', async () => {
      const [teamA, teamB] = await createTeams(2);
      const inTeamA = [
        await createTestNotebook('A1', {teamId: teamA._id}),
        await createTestNotebook('A2', {teamId: teamA._id}),
        await createTestNotebook('A3', {teamId: teamA._id}),
      ];
      await createTestNotebook('B1', {teamId: teamB._id});
      const fromTemplate = [
        await createTestNotebook('T1', {templateId: 'template-one'}),
        await createTestNotebook('T2', {
          templateId: 'template-one',
          teamId: teamB._id,
        }),
      ];
      await createTestNotebook('Other template', {templateId: 'template-two'});

      const teamPages = await collectPages(startKey =>
        listNotebooks({teamId: teamA._id, limit: 2, startKey})
      );
      expect(teamPages.map(page => page.items.length)).toEqual([2, 1]);
      expect(
        teamPages.flatMap(page => page.items.map(n => n._id)).sort()
      ).toEqual([...inTeamA].sort());

      const templatePages = await collectPages(startKey =>
        listNotebooks({templateId: 'template-one', limit: 1, startKey})
      );
      expect(
        templatePages.flatMap(page => page.items.map(n => n._id)).sort()
      ).toEqual([...fromTemplate].sort());
    });

    it('fills a page with only the surveys the caller can read', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        ids.push(await createTestNotebook(`Survey ${i}`));
      }
      const localUser = await requireUser(localUserName);
      const readable = [ids[0], ids[3], ids[5]];
      for (const projectId of readable) {
        addProjectRole({
          user: localUser,
          projectId,
          role: Role.PROJECT_GUEST,
        });
      }
      await saveCouchUser(localUser);
      const token = await tokenFor(localUserName);

      const pages = await collectPages(startKey =>
        listNotebooks({limit: 2, startKey}, token)
      );
      expect(pages[0].items).toHaveLength(2);
      expect(pages.flatMap(page => page.items.map(n => n._id)).sort()).toEqual(
        [...readable].sort()
      );
    });
  });

  describe('GET /api/directory', () => {
    it('stays a complete array, never a page', async () => {
      const created: string[] = [];
      for (let i = 0; i < LIST_DEFAULT_LIMIT + 3; i++) {
        created.push(await createTestNotebook(`Survey ${i}`));
      }
      const {body} = await getOk('/api/directory', {limit: 2});
      const directory = GetDirectoryResponseSchema.parse(body);
      expect(directory.map(n => n._id).sort()).toEqual([...created].sort());
    });
  });

  describe('GET /api/teams', () => {
    const listTeams = async (
      query: Record<string, string | number | undefined> = {},
      token: string = adminToken
    ) => {
      const {body} = await getOk('/api/teams', query, token);
      const parsed = GetListTeamsResponseSchema.parse(body);
      return {items: parsed.teams, nextStartKey: parsed.nextStartKey};
    };

    it('walks every team exactly once, newest first', async () => {
      const teams = await createTeams(5);
      const pages = await collectPages(startKey =>
        listTeams({limit: 2, startKey})
      );
      expect(pages.map(page => page.items.length)).toEqual([2, 2, 1]);
      expect(pages.flatMap(page => page.items.map(t => t._id))).toEqual(
        [...teams].reverse().map(t => t._id)
      );
    });

    it('lists archived teams only when includeArchived=true', async () => {
      const teams = await createTeams(4);
      await archiveTeam(teams[1]._id, true);
      await archiveTeam(teams[3]._id, true);

      const active = await listTeams();
      expect(active.items.map(t => t._id)).toEqual([
        teams[2]._id,
        teams[0]._id,
      ]);
      const archived = await collectPages(startKey =>
        listTeams({includeArchived: 'true', limit: 1, startKey})
      );
      expect(archived.flatMap(page => page.items.map(t => t._id))).toEqual([
        teams[3]._id,
        teams[1]._id,
      ]);
    });

    it('fills a page with only the teams the caller can view', async () => {
      const teams = await createTeams(6);
      const localUser = await requireUser(localUserName);
      for (const team of [teams[0], teams[2], teams[5]]) {
        addTeamRole({
          user: localUser,
          teamId: team._id,
          role: Role.TEAM_MEMBER,
        });
      }
      await saveCouchUser(localUser);
      const token = await tokenFor(localUserName);

      const pages = await collectPages(startKey =>
        listTeams({limit: 2, startKey}, token)
      );
      expect(pages[0].items).toHaveLength(2);
      expect(pages.flatMap(page => page.items.map(t => t._id))).toEqual([
        teams[5]._id,
        teams[2]._id,
        teams[0]._id,
      ]);
    });
  });

  describe('GET /api/users', () => {
    const listUsers = async (
      query: Record<string, string | number | undefined> = {}
    ) => {
      const {body} = await getOk('/api/users', query);
      const parsed = GetListAllUsersResponseSchema.parse(body);
      return {items: parsed.users, nextStartKey: parsed.nextStartKey};
    };

    it('walks every enabled user exactly once in name order', async () => {
      await createNamedUser('zed', 'Zed Last');
      await createNamedUser('amy', 'amy first');

      const pages = await collectPages(startKey =>
        listUsers({limit: 2, startKey})
      );
      expect(pages.map(page => page.items.length)).toEqual([2, 2, 1]);
      // Case-insensitive by display name.
      expect(pages.flatMap(page => page.items.map(u => u.user_id))).toEqual([
        adminUserName,
        'amy',
        localUserName,
        notebookUserName,
        'zed',
      ]);
    });

    it('lists disabled users only when includeArchived=true', async () => {
      const disabled = await createNamedUser('gone', 'Gone User');
      await saveCouchUser({...disabled, disabled: true});

      const enabled = await listUsers();
      expect(enabled.items.map(u => u.user_id)).not.toContain('gone');
      expect(enabled.items).toHaveLength(3);

      const archived = await listUsers({includeArchived: 'true'});
      expect(archived.items.map(u => u.user_id)).toEqual(['gone']);
    });

    it('never returns login secrets', async () => {
      const {body} = await getOk('/api/users');
      expect(body.users.length).toBeGreaterThan(0);
      for (const user of body.users) {
        for (const value of Object.values(user.profiles)) {
          expect(value).toBeTypeOf('boolean');
        }
      }
      expect(JSON.stringify(body)).not.toMatch(/password|salt|hash/i);
    });
  });

  describe('GET /api/teams/:id/members', () => {
    it('pages the team members and repeats availableRoles', async () => {
      const [team, otherTeam] = await createTeams(2);
      const names = ['Carol', 'alice', 'Bob'];
      for (const name of names) {
        const user = await createNamedUser(name.toLowerCase(), name);
        addTeamRole({user, teamId: team._id, role: Role.TEAM_MEMBER});
        await saveCouchUser(user);
      }
      const outsider = await createNamedUser('dave', 'Dave');
      addTeamRole({
        user: outsider,
        teamId: otherTeam._id,
        role: Role.TEAM_ADMIN,
      });
      await saveCouchUser(outsider);

      const pages = await collectPages(async startKey => {
        const {body} = await getOk(`/api/teams/${team._id}/members`, {
          limit: 2,
          startKey,
        });
        const parsed = GetTeamMembersResponseSchema.parse(body);
        expect(parsed.availableRoles.map(r => r.role)).toContain(
          Role.TEAM_MEMBER
        );
        return {items: parsed.members, nextStartKey: parsed.nextStartKey};
      });

      expect(pages.map(page => page.items.length)).toEqual([2, 1]);
      const members = pages.flatMap(page => page.items);
      expect(members.map(m => m.username)).toEqual(['alice', 'bob', 'carol']);
      for (const member of members) {
        expect(member.roles.filter(r => r.hasRole).map(r => r.role)).toEqual([
          Role.TEAM_MEMBER,
        ]);
      }
    });
  });

  describe('GET /api/notebooks/:id/users', () => {
    it('pages only the users with a role on the survey', async () => {
      const projectId = await createTestNotebook('Shared survey');
      const otherProjectId = await createTestNotebook('Other survey');
      for (const name of ['Carol', 'alice', 'Bob']) {
        const user = await createNamedUser(name.toLowerCase(), name);
        addProjectRole({user, projectId, role: Role.PROJECT_CONTRIBUTOR});
        await saveCouchUser(user);
      }
      const outsider = await createNamedUser('dave', 'Dave');
      addProjectRole({
        user: outsider,
        projectId: otherProjectId,
        role: Role.PROJECT_ADMIN,
      });
      await saveCouchUser(outsider);

      const pages = await collectPages(async startKey => {
        const {body} = await getOk(`/api/notebooks/${projectId}/users`, {
          limit: 2,
          startKey,
        });
        const parsed = GetNotebookUsersResponseSchema.parse(body);
        expect(parsed.roles).toContain(Role.PROJECT_CONTRIBUTOR);
        return {items: parsed.users, nextStartKey: parsed.nextStartKey};
      });

      expect(pages.map(page => page.items.length)).toEqual([2, 1]);
      const users = pages.flatMap(page => page.items);
      expect(users.map(u => u.username)).toEqual(['alice', 'bob', 'carol']);
      for (const user of users) {
        expect(user.roles.filter(r => r.value).map(r => r.name)).toEqual([
          Role.PROJECT_CONTRIBUTOR,
        ]);
      }
    });
  });

  describe('invite lists', () => {
    const createInvites = async (
      count: number,
      resource: {
        resourceType: Resource.TEAM | Resource.PROJECT;
        resourceId: string;
      },
      role: Role
    ) => {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const invite = await createResourceInvite({
          ...resource,
          role,
          name: `Invite ${i}`,
          createdBy: 'admin',
        });
        ids.push(invite._id);
      }
      return ids;
    };

    it('pages survey invites and skips expired and other-survey ones', async () => {
      const projectId = await createTestNotebook('Invite survey');
      const otherProjectId = await createTestNotebook('Other survey');
      const resource = {
        resourceType: Resource.PROJECT as const,
        resourceId: projectId,
      };
      const valid = await createInvites(5, resource, Role.PROJECT_CONTRIBUTOR);
      await createResourceInvite({
        ...resource,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Expired',
        createdBy: 'admin',
        expiry: Date.now() - 1000,
      });
      await createInvites(
        2,
        {resourceType: Resource.PROJECT, resourceId: otherProjectId},
        Role.PROJECT_CONTRIBUTOR
      );

      const pages = await collectPages(async startKey => {
        const {body} = await getOk(`/api/invites/notebook/${projectId}`, {
          limit: 2,
          startKey,
        });
        const parsed = GetProjectInvitesResponseSchema.parse(body);
        return {items: parsed.invites, nextStartKey: parsed.nextStartKey};
      });

      const invites = pages.flatMap(page => page.items);
      expect(invites.map(i => i._id).sort()).toEqual([...valid].sort());
      expect(pages[0].items).toHaveLength(2);
      const createdAt = invites.map(i => i.createdAt);
      expect(createdAt).toEqual([...createdAt].sort((a, b) => b - a));
    });

    it('pages team invites', async () => {
      const [team, otherTeam] = await createTeams(2);
      const valid = await createInvites(
        3,
        {resourceType: Resource.TEAM, resourceId: team._id},
        Role.TEAM_MEMBER
      );
      await createInvites(
        1,
        {resourceType: Resource.TEAM, resourceId: otherTeam._id},
        Role.TEAM_MEMBER
      );

      const pages = await collectPages(async startKey => {
        const {body} = await getOk(`/api/invites/team/${team._id}`, {
          limit: 2,
          startKey,
        });
        const parsed = GetTeamInvitesResponseSchema.parse(body);
        return {items: parsed.invites, nextStartKey: parsed.nextStartKey};
      });
      expect(pages.map(page => page.items.length)).toEqual([2, 1]);
      expect(pages.flatMap(page => page.items.map(i => i._id)).sort()).toEqual(
        [...valid].sort()
      );
    });

    it('pages global invites and leaves resource invites out', async () => {
      const projectId = await createTestNotebook('Invite survey');
      await createInvites(
        2,
        {resourceType: Resource.PROJECT, resourceId: projectId},
        Role.PROJECT_CONTRIBUTOR
      );
      const valid: string[] = [];
      for (let i = 0; i < 3; i++) {
        const invite = await createGlobalInvite({
          role: Role.GENERAL_USER,
          name: `Global ${i}`,
          createdBy: 'admin',
        });
        valid.push(invite._id);
      }

      const pages = await collectPages(async startKey => {
        const {body} = await getOk('/api/invites/global', {limit: 2, startKey});
        const parsed = GetGlobalInvitesResponseSchema.parse(body);
        return {items: parsed.invites, nextStartKey: parsed.nextStartKey};
      });
      expect(pages.map(page => page.items.length)).toEqual([2, 1]);
      expect(pages.flatMap(page => page.items.map(i => i._id)).sort()).toEqual(
        [...valid].sort()
      );
    });
  });

  describe('GET /api/long-lived-tokens', () => {
    const listTokens = async (
      query: Record<string, string | number | undefined> = {},
      token: string = adminToken
    ) => {
      const {body} = await getOk('/api/long-lived-tokens', query, token);
      const parsed = GetLongLivedTokensResponseSchema.parse(body);
      expect(parsed).toHaveProperty('maxDurationDays');
      expect(JSON.stringify(body)).not.toMatch(/tokenHash/);
      return {items: parsed.tokens, nextStartKey: parsed.nextStartKey};
    };

    it('pages the caller tokens, and every user tokens with all=true', async () => {
      const mine: string[] = [];
      for (let i = 0; i < 3; i++) {
        const {record} = await createNewLongLivedToken({
          userId: adminUserName,
          title: `Admin token ${i}`,
          description: '',
          expiryTimestampMs: Date.now() + 24 * 60 * 60 * 1000,
        });
        mine.push(record._id);
      }
      const {record: theirs} = await createNewLongLivedToken({
        userId: localUserName,
        title: 'Local token',
        description: '',
        expiryTimestampMs: Date.now() + 24 * 60 * 60 * 1000,
      });

      const minePages = await collectPages(startKey =>
        listTokens({limit: 2, startKey})
      );
      expect(minePages.map(page => page.items.length)).toEqual([2, 1]);
      expect(
        minePages.flatMap(page => page.items.map(t => t.id)).sort()
      ).toEqual([...mine].sort());

      const allPages = await collectPages(startKey =>
        listTokens({all: 'true', limit: 3, startKey})
      );
      expect(
        allPages.flatMap(page => page.items.map(t => t.id)).sort()
      ).toEqual([...mine, theirs._id].sort());
    });
  });
});
