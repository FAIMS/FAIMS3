// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: invites.test.ts
 * Description:
 *   Tests for the invites functionality
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {
  addGlobalRole,
  addProjectRole,
  addTeamRole,
  removeProjectRole,
  DEFAULT_INVITE_EXPIRY_MS,
  DEFAULT_QUICK_SHARE_LIFETIME_MS,
  INPUT_LIMITS,
  MAX_INVITE_EXPIRY_MS,
  QUICK_SHARE_KIND,
  QUICK_SHARE_NAME,
  PostRegisterInput,
  registerClient,
  Resource,
  Role,
  RoleScope,
  userHasGlobalRole,
  userHasProjectRole,
} from '@faims3/data-model';
import {decodeJwt} from 'jose';
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {generateJwtFromUser} from '../src/auth/keySigning/create';
import {config, keyService} from '../src/buildconfig';
import {getInvitesDB} from '../src/couchdb';
import {
  consumeInvite,
  createGlobalInvite,
  createQuickShareInvite,
  createResourceInvite,
  deleteInvite,
  getGlobalInvites,
  getInvite,
  getInvitesForResource,
  getQuickSharesForProject,
  getQuickSharesForProjectAndUser,
  isInviteValid,
} from '../src/couchdb/invites';
import {createNotebook, updateProjectMetadata} from '../src/couchdb/notebooks';
import {createTeamDocument} from '../src/couchdb/teams';
import {
  getCouchUserFromEmailOrUserId,
  getExpressUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {
  adminToken,
  adminUserName,
  beforeApiTests,
  localUserName,
  localUserToken,
} from './utils';
import {EMPTY_UI_SPECIFICATION} from './sampleNotebook';

registerClient(callbackObject);

describe('Invite Tests', () => {
  beforeEach(beforeApiTests);

  // DB METHOD TESTS
  describe('Database Methods Tests', () => {
    it('can create an invite for a project', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24, // 1 day
        usesOriginal: 5,
      });

      expect(invite).not.toBeNull();
      expect(invite._id).toContain('-');
      // `{prefix}-{16-char nanoid body}` — long enough to resist brute force
      const [, body] = invite._id.split('-');
      expect(body).toHaveLength(16);
      expect(body).toMatch(/^[0-9A-Za-z]+$/);
      expect(invite.resourceType).toBe(Resource.PROJECT);
      expect(invite.resourceId).toBe(projectId);
      expect(invite.role).toBe(Role.PROJECT_CONTRIBUTOR);
      expect(invite.name).toBe('Test Invite');
      expect(invite.createdBy).toBe('admin');
      expect(invite.usesOriginal).toBe(5);
      expect(invite.usesConsumed).toBe(0);
      expect(invite.uses).toEqual([]);
    });

    it('defaults new invites to a 5-day expiry', async () => {
      const before = Date.now();
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Default expiry invite',
        createdBy: 'admin',
      });
      const after = Date.now();
      expect(invite.expiry).toBeGreaterThanOrEqual(
        before + DEFAULT_INVITE_EXPIRY_MS
      );
      expect(invite.expiry).toBeLessThanOrEqual(
        after + DEFAULT_INVITE_EXPIRY_MS
      );
    });

    it('rejects invites with expiry beyond 90 days', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await expect(
        createResourceInvite({
          resourceType: Resource.PROJECT,
          resourceId: projectId!,
          role: Role.PROJECT_CONTRIBUTOR,
          name: 'Too long invite',
          createdBy: 'admin',
          expiry: Date.now() + MAX_INVITE_EXPIRY_MS + 24 * 60 * 60 * 1000,
        })
      ).rejects.toThrow(/at most 90 days/);
    });

    it('can create an invite for a team', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      const invite = await createResourceInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_MEMBER,
        name: 'Team Invite',
        createdBy: 'admin',
      });

      expect(invite).not.toBeNull();
      expect(invite._id).toContain('-');
      expect(invite.resourceType).toBe(Resource.TEAM);
      expect(invite.resourceId).toBe(team._id);
      expect(invite.role).toBe(Role.TEAM_MEMBER);
      expect(invite.name).toBe('Team Invite');
      expect(invite.createdBy).toBe('admin');
      expect(invite.usesOriginal).toBeUndefined();
      expect(invite.usesConsumed).toBe(0);
    });

    it('can get an invite by ID', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
      });

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).not.toBeNull();
      expect(fetchedInvite?._id).toBe(invite._id);
      expect(fetchedInvite?.resourceType).toBe(Resource.PROJECT);
      expect(fetchedInvite?.resourceId).toBe(projectId);
    });

    it('returns null when getting non-existent invite', async () => {
      const fetchedInvite = await getInvite({inviteId: 'non-existent-id'});
      expect(fetchedInvite).toBeNull();
    });

    it('can get invites for a resource', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Contributor Invite',
        createdBy: 'admin',
      });

      await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_ADMIN,
        name: 'Admin Invite',
        createdBy: 'admin',
      });

      const invites = await getInvitesForResource({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
      });

      expect(invites).toBeInstanceOf(Array);
      expect(invites).toHaveLength(2);
      expect(invites[0].name).toSatisfy(v =>
        ['Contributor Invite', 'Admin Invite'].includes(v)
      );
      expect(invites[1].name).toSatisfy(v =>
        ['Contributor Invite', 'Admin Invite'].includes(v)
      );
      expect(invites[0].name).not.toBe(invites[1].name);
    });

    it('returns every invite for a resource past the default find page', async () => {
      const projectId = await createNotebook({
        projectName: 'many-invites',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      for (let i = 0; i < 30; i++) {
        await createResourceInvite({
          resourceType: Resource.PROJECT,
          resourceId: projectId!,
          role: Role.PROJECT_GUEST,
          name: `Invite ${i}`,
          createdBy: 'admin',
        });
      }

      const invites = await getInvitesForResource({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
      });
      expect(invites).toHaveLength(30);
    });

    it('can delete an invite', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
      });

      const deletedInvite = await deleteInvite({invite});
      expect(deletedInvite._id).toBe(invite._id);

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).toBeNull();
    });

    it('can check if an invite is valid', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      // Create valid invite
      const validInvite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Valid Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24, // 1 day
      });

      const validityCheck = isInviteValid({invite: validInvite});
      expect(validityCheck.isValid).toBe(true);
      expect(validityCheck.reason).toBeUndefined();

      // Create expired invite
      const expiredInvite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Expired Invite',
        createdBy: 'admin',
        expiry: Date.now() - 1000, // 1 second ago
      });

      const expiredCheck = isInviteValid({invite: expiredInvite});
      expect(expiredCheck.isValid).toBe(false);
      expect(expiredCheck.reason).toBe('Invite has expired');

      // Create limited use invite
      const limitedInvite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Limited Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24,
        usesOriginal: 2,
      });

      // Use the invite twice to reach the limit
      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(localUser).not.toBeNull();

      await consumeInvite({
        invite: limitedInvite,
        user: localUser!,
      });
      await saveCouchUser(localUser!);

      const updatedInvite = await getInvite({inviteId: limitedInvite._id});
      await consumeInvite({
        invite: updatedInvite!,
        user: localUser!,
      });
      await saveCouchUser(localUser!);

      // Check if it's now invalid due to usage limit
      const finalInvite = await getInvite({inviteId: limitedInvite._id});
      const usedUpCheck = isInviteValid({invite: finalInvite!});
      expect(usedUpCheck.isValid).toBe(false);
      expect(usedUpCheck.reason).toBe(
        'Invite has been used the maximum number of times'
      );
    });

    it('can use an invite and record usage', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
        usesOriginal: 3,
      });

      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(localUser).not.toBeNull();

      // Check initial state
      expect(invite.usesConsumed).toBe(0);
      expect(invite.uses).toEqual([]);
      expect(
        userHasProjectRole({
          user: localUser!,
          projectId: projectId!,
          role: Role.PROJECT_CONTRIBUTOR,
        })
      ).toBe(false);

      // Use the invite
      const updatedInvite = await consumeInvite({
        invite,
        user: localUser!,
      });
      await saveCouchUser(localUser!);

      // Check results
      expect(updatedInvite.usesConsumed).toBe(1);
      expect(updatedInvite.uses).toBeInstanceOf(Array);
      expect(updatedInvite.uses).toHaveLength(1);
      expect(updatedInvite.uses[0].userId).toBe(localUser!.user_id);

      // Double check the role was added
      expect(
        userHasProjectRole({
          user: localUser!,
          projectId: projectId!,
          role: Role.PROJECT_CONTRIBUTOR,
        })
      ).toBe(true);
    });

    it('can get global invites', async () => {
      await createGlobalInvite({
        role: Role.OPERATIONS_ADMIN,
        name: 'Admin Invite',
        createdBy: 'admin',
      });

      await createGlobalInvite({
        role: Role.OPERATIONS_ADMIN,
        name: 'Another Admin Invite',
        createdBy: 'admin',
      });

      const invites = await getGlobalInvites();

      expect(invites).toBeInstanceOf(Array);
      expect(invites).toHaveLength(2);
      expect(invites[0].name).toSatisfy(v =>
        ['Admin Invite', 'Another Admin Invite'].includes(v)
      );
      expect(invites[1].name).toSatisfy(v =>
        ['Admin Invite', 'Another Admin Invite'].includes(v)
      );
      expect(invites[0].name).not.toBe(invites[1].name);
    });

    it('returns every global invite past the default find page', async () => {
      for (let i = 0; i < 30; i++) {
        await createGlobalInvite({
          role: Role.GENERAL_USER,
          name: `Global ${i}`,
          createdBy: 'admin',
        });
      }
      const invites = await getGlobalInvites();
      expect(invites).toHaveLength(30);
    });

    it('can use a global invite and record usage', async () => {
      const invite = await createGlobalInvite({
        role: Role.OPERATIONS_ADMIN,
        name: 'Test Global Invite',
        createdBy: 'admin',
        usesOriginal: 3,
      });

      const localUser = await getExpressUserFromEmailOrUserId(localUserName);
      expect(localUser).not.toBeNull();

      // Check initial state
      expect(invite.usesConsumed).toBe(0);
      expect(invite.uses).toEqual([]);
      expect(
        userHasGlobalRole({
          user: localUser!,
          role: Role.OPERATIONS_ADMIN,
        })
      ).toBe(false);

      // Use the invite
      const updatedInvite = await consumeInvite({
        invite,
        user: localUser!,
      });
      await saveCouchUser(localUser!);

      // Check results
      expect(updatedInvite.usesConsumed).toBe(1);
      expect(updatedInvite.uses).toBeInstanceOf(Array);
      expect(updatedInvite.uses).toHaveLength(1);
      expect(updatedInvite.uses[0].userId).toBe(localUser!.user_id);

      // Double check the role was added
      expect(
        userHasGlobalRole({
          user: localUser!,
          role: Role.OPERATIONS_ADMIN,
        })
      ).toBe(true);
    });
  });

  // API ENDPOINT TESTS
  describe('API Endpoint Tests', () => {
    it('GET /api/invites/:inviteId returns invite details', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Public Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24,
        usesOriginal: 5,
      });

      const response = await request(app)
        .get(`/api/invites/${invite._id}`)
        .expect(200);

      expect(response.body.id).toBe(invite._id);
      expect(response.body.resourceType).toBe(Resource.PROJECT);
      expect(response.body.resourceId).toBe(projectId);
      expect(response.body.name).toBe('Public Invite');
      expect(response.body.role).toBe(Role.PROJECT_CONTRIBUTOR);
      expect(response.body.isValid).toBe(true);
      expect(response.body.usesRemaining).toBe(5);
    });

    it('GET /api/invites/:inviteId returns 404 for unknown codes', async () => {
      await request(app).get('/api/invites/FAIMS-DOESNOTEXIST000').expect(404);
    });

    it('GET /api/invites/:inviteId rejects oversized invite ids', async () => {
      const oversized = 'A'.repeat(INPUT_LIMITS.ID_MAX_LENGTH + 1);
      const response = await request(app)
        .get(`/api/invites/${oversized}`)
        .expect(400);
      expect(response.body[0].errors.issues[0].message).toMatch(
        /at most 256 characters/i
      );
    });

    it('GET /api/invites/notebook/:projectId requires authentication', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await request(app).get(`/api/invites/notebook/${projectId}`).expect(401);
    });

    it('GET /api/invites/notebook/:projectId returns project invites', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Contributor Invite',
        createdBy: 'admin',
      });

      await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_ADMIN,
        name: 'Admin Invite',
        createdBy: 'admin',
      });

      // add a global invite to ensure that it doesn't show up in the project invites list
      await createGlobalInvite({
        role: Role.OPERATIONS_ADMIN,
        name: 'Global Invite',
        createdBy: 'admin',
      });

      const response = await request(app)
        .get(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toSatisfy(v =>
        ['Contributor Invite', 'Admin Invite'].includes(v)
      );
      expect(response.body[1].name).toSatisfy(v =>
        ['Contributor Invite', 'Admin Invite'].includes(v)
      );
    });

    it('GET /api/invites/team/:teamId returns team invites', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      await createResourceInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_MEMBER,
        name: 'Member Invite',
        createdBy: 'admin',
      });

      await createResourceInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_ADMIN,
        name: 'Admin Invite',
        createdBy: 'admin',
      });

      const response = await request(app)
        .get(`/api/invites/team/${team._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toSatisfy(v =>
        ['Member Invite', 'Admin Invite'].includes(v)
      );
      expect(response.body[1].name).toSatisfy(v =>
        ['Member Invite', 'Admin Invite'].includes(v)
      );
    });

    it('POST /api/invites/notebook/:projectId creates a project invite', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      const response = await request(app)
        .post(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_CONTRIBUTOR,
          name: 'API Created Invite',
          uses: 3,
          expiry: Date.now() + 1000 * 60 * 60 * 24,
        })
        .expect(200);

      expect(response.body._id).toBeDefined();
      expect(response.body.resourceType).toBe(Resource.PROJECT);
      expect(response.body.resourceId).toBe(projectId);
      expect(response.body.role).toBe(Role.PROJECT_CONTRIBUTOR);
      expect(response.body.name).toBe('API Created Invite');
      expect(response.body.usesOriginal).toBe(3);
      expect(response.body.usesConsumed).toBe(0);
      expect(response.body.createdBy).toBe('admin');
    });

    it('POST /api/invites/notebook/:projectId rejects expiry beyond 90 days', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      await request(app)
        .post(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_CONTRIBUTOR,
          name: 'Too long invite',
          expiry: Date.now() + MAX_INVITE_EXPIRY_MS + 24 * 60 * 60 * 1000,
        })
        .expect(400);
    });

    it('POST /api/invites/team/:teamId creates a team invite', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      // Add admin role to the admin user for this team
      const adminUser = await getExpressUserFromEmailOrUserId('admin');
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      addTeamRole({
        user: adminUser,
        teamId: team._id,
        role: Role.TEAM_ADMIN,
      });

      const response = await request(app)
        .post(`/api/invites/team/${team._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.TEAM_MEMBER,
          name: 'Team API Invite',
          uses: 10,
        })
        .expect(200);

      expect(response.body._id).toBeDefined();
      expect(response.body.resourceType).toBe(Resource.TEAM);
      expect(response.body.resourceId).toBe(team._id);
      expect(response.body.role).toBe(Role.TEAM_MEMBER);
      expect(response.body.name).toBe('Team API Invite');
      expect(response.body.usesOriginal).toBe(10);
    });

    it('POST /api/invites/team/:teamId does not create team invite if role is not global', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      // Add admin role to the admin user for this team
      const adminUser = await getExpressUserFromEmailOrUserId('admin');
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      addTeamRole({
        user: adminUser,
        teamId: team._id,
        role: Role.TEAM_ADMIN,
      });

      const response = await request(app)
        .post(`/api/invites/team/${team._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.GENERAL_CREATOR, // This is a global role, not a team role, so should be rejected
          name: 'This should not work',
          uses: 10,
        })
        .expect(400);
      expect(response.body[0].errors.issues[0].message).toBe(
        'Role must be a resource specific role to create a resource specific invite'
      );
    });

    it('DELETE /api/invites/notebook/:projectId/:inviteId deletes a project invite', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Deletable Invite',
        createdBy: 'admin',
      });

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${invite._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).toBeNull();
    });

    it('DELETE /api/invites/team/:teamId/:inviteId deletes a team invite', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      // Add admin role to the admin user for this team
      const adminUser = await getExpressUserFromEmailOrUserId('admin');
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      addTeamRole({
        user: adminUser,
        teamId: team._id,
        role: Role.TEAM_ADMIN,
      });

      const invite = await createResourceInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_MEMBER,
        name: 'Deletable Team Invite',
        createdBy: 'admin',
      });

      await request(app)
        .delete(`/api/invites/team/${team._id}/${invite._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).toBeNull();
    });

    it('Non-admins cannot create project admin invites', async () => {
      const projectId = await createNotebook({
        projectName: 'test-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      // Add contributor role to local user
      const localUserDb = await getExpressUserFromEmailOrUserId(localUserName);
      if (!localUserDb) {
        throw new Error('Local user not found');
      }

      addProjectRole({
        user: localUserDb,
        projectId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
      });

      await request(app)
        .post(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${localUserToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
          name: 'Unauthorized Invite',
        })
        .expect(401); // Unauthorized
    });
  });

  describe('POST /api/invites/notebook/:projectId/quick-share', () => {
    async function tokenForProjectRole(projectId: string, role: Role) {
      const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
      if (!couchUser) {
        throw new Error('Local user not found');
      }
      addProjectRole({user: couchUser, projectId, role});
      await saveCouchUser(couchUser);
      const expressUser = await getExpressUserFromEmailOrUserId(localUserName);
      if (!expressUser) {
        throw new Error('Local user not found');
      }
      const signingKey = await keyService.getSigningKey();
      return generateJwtFromUser({user: expressUser, signingKey});
    }

    async function downgradeProjectAdminToManager(projectId: string) {
      const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
      if (!couchUser) {
        throw new Error('Local user not found');
      }
      removeProjectRole({
        user: couchUser,
        projectId,
        role: Role.PROJECT_ADMIN,
      });
      addProjectRole({
        user: couchUser,
        projectId,
        role: Role.PROJECT_MANAGER,
      });
      await saveCouchUser(couchUser);
      return tokenForProjectRole(projectId, Role.PROJECT_MANAGER);
    }

    it('requires authentication', async () => {
      await request(app)
        .post('/api/invites/notebook/some-project/quick-share')
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(401);
    });

    it('stores a short-lived quick share and records each use', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const before = Date.now();
      const response = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);

      expect(response.body.kind).toBe(QUICK_SHARE_KIND);
      expect(response.body.name).toBe(QUICK_SHARE_NAME);
      expect(response.body.role).toBe(Role.PROJECT_GUEST);
      expect(response.body.resourceType).toBe(Resource.PROJECT);
      expect(response.body.resourceId).toBe(projectId);
      expect(response.body.usesConsumed).toBe(0);
      expect(response.body.uses).toEqual([]);
      expect(response.body.usesOriginal).toBeUndefined();
      expect(response.body.expiry).toBeGreaterThanOrEqual(
        before + DEFAULT_QUICK_SHARE_LIFETIME_MS
      );
      expect(response.body.expiry).toBeLessThanOrEqual(
        Date.now() + DEFAULT_QUICK_SHARE_LIFETIME_MS
      );

      const stored = await getInvite({inviteId: response.body._id});
      expect(stored?.kind).toBe(QUICK_SHARE_KIND);

      const listed = await request(app)
        .get(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        listed.body.some(
          (invite: {_id: string}) => invite._id === response.body._id
        )
      ).toBe(true);

      await request(app)
        .post(`/api/invites/${response.body._id}/use`)
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(200);

      const consumed = await getInvite({inviteId: response.body._id});
      const redeemer = await getExpressUserFromEmailOrUserId(localUserName);
      expect(consumed?.kind).toBe(QUICK_SHARE_KIND);
      expect(consumed?.usesConsumed).toBe(1);
      expect(consumed?.uses).toEqual([
        expect.objectContaining({userId: redeemer!._id}),
      ]);
    });

    it('returns the existing quick share instead of creating another', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-one',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const first = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);
      const second = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_CONTRIBUTOR,
        })
        .expect(200);
      expect(second.body._id).toBe(first.body._id);
      expect(second.body.role).toBe(Role.PROJECT_GUEST);
      const stored = await getQuickSharesForProject(projectId!);
      expect(stored).toHaveLength(1);
      expect(
        await getQuickSharesForProjectAndUser({
          projectId: projectId!,
          userId: adminUserName,
        })
      ).toEqual(stored);
    });

    it('revoke deletes the quick share', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);
      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${created.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(await getInvite({inviteId: created.body._id})).toBeNull();
      const again = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_CONTRIBUTOR,
        })
        .expect(200);
      expect(again.body._id).not.toBe(created.body._id);
      expect(again.body.role).toBe(Role.PROJECT_CONTRIBUTOR);
    });

    it('returns the existing quick share when older invites fill the default find page', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-past-page',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);

      // Other invites on the same survey must not hide the live quick share.
      // Lookup uses the by-project-and-user view, not a paged find of every invite.
      const invitesDb = getInvitesDB();
      for (let i = 0; i < 25; i++) {
        await invitesDb.put({
          _id: `000-pad-${String(i).padStart(2, '0')}`,
          resourceType: Resource.PROJECT,
          resourceId: projectId!,
          inviteType: RoleScope.RESOURCE_SPECIFIC,
          role: Role.PROJECT_GUEST,
          name: 'pad',
          createdBy: 'other',
          createdAt: 1,
          expiry: Date.now() + 60_000,
          usesConsumed: 0,
          uses: [],
        });
      }

      const again = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_CONTRIBUTOR,
        })
        .expect(200);
      expect(again.body._id).toBe(created.body._id);
      const stored = await getQuickSharesForProjectAndUser({
        projectId: projectId!,
        userId: adminUserName,
      });
      expect(stored).toHaveLength(1);
      expect(stored[0]._id).toBe(created.body._id);
    });

    it('a second generate keeps the newest quick share and removes older ones', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-collapse',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const older = await createQuickShareInvite({
        resourceId: projectId!,
        role: Role.PROJECT_GUEST,
        createdBy: adminUserName,
      });
      await new Promise(resolve => setTimeout(resolve, 5));
      const newer = await createQuickShareInvite({
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        createdBy: adminUserName,
      });

      const response = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);
      expect(response.body._id).toBe(newer._id);
      expect(await getInvite({inviteId: older._id})).toBeNull();
      expect(await getInvite({inviteId: newer._id})).not.toBeNull();
    });

    it('does not hand back a higher-role quick share after the caller is downgraded', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-downgrade',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const projectAdminToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_ADMIN
      );
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${projectAdminToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
        })
        .expect(200);

      const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
      if (!couchUser) {
        throw new Error('Local user not found');
      }
      removeProjectRole({
        user: couchUser,
        projectId: projectId!,
        role: Role.PROJECT_ADMIN,
      });
      addProjectRole({
        user: couchUser,
        projectId: projectId!,
        role: Role.PROJECT_MANAGER,
      });
      await saveCouchUser(couchUser);
      const managerToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_MANAGER
      );

      const denied = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(403);
      expect(denied.body.error.message).toMatch(/above your current access/);
      expect(JSON.stringify(denied.body)).not.toContain(created.body._id);

      const shares = await getQuickSharesForProject(projectId!);
      expect(shares).toHaveLength(1);
      expect(shares[0]._id).toBe(created.body._id);
      expect(shares[0].role).toBe(Role.PROJECT_ADMIN);
    });

    it('lets a downgraded user revoke their own higher-role quick share', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-own',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const projectAdminToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_ADMIN
      );
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${projectAdminToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
        })
        .expect(200);
      const managerToken = await downgradeProjectAdminToManager(projectId!);

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${created.body._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(await getInvite({inviteId: created.body._id})).toBeNull();
    });

    it('refuses a downgraded user revoking someone else’s quick share', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-other',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
        })
        .expect(200);
      const managerToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_MANAGER
      );

      const denied = await request(app)
        .delete(`/api/invites/notebook/${projectId}/${created.body._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(401);
      expect(denied.body.error.message).toMatch(/not authorized to delete/);
      expect(await getInvite({inviteId: created.body._id})).not.toBeNull();
    });

    it('revoking one own code also removes a higher-role code from the same person', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-own-sibling',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await tokenForProjectRole(projectId!, Role.PROJECT_ADMIN);
      const expressUser = await getExpressUserFromEmailOrUserId(localUserName);
      if (!expressUser) {
        throw new Error('Local user not found');
      }
      const higher = await createQuickShareInvite({
        resourceId: projectId!,
        role: Role.PROJECT_ADMIN,
        createdBy: expressUser.user_id,
      });
      const stored = await createQuickShareInvite({
        resourceId: projectId!,
        role: Role.PROJECT_GUEST,
        createdBy: expressUser.user_id,
      });
      const managerToken = await downgradeProjectAdminToManager(projectId!);

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${stored._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(await getInvite({inviteId: stored._id})).toBeNull();
      expect(await getInvite({inviteId: higher._id})).toBeNull();
    });

    it('DELETE /quick-share revokes the caller’s own codes without returning the id', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-collection',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const projectAdminToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_ADMIN
      );
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${projectAdminToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
        })
        .expect(200);
      const managerToken = await downgradeProjectAdminToManager(projectId!);

      const revoked = await request(app)
        .delete(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(JSON.stringify(revoked.body)).not.toContain(created.body._id);
      expect(await getInvite({inviteId: created.body._id})).toBeNull();
    });

    it('DELETE /quick-share leaves another person’s code in place', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-collection-other',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);
      const managerToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_MANAGER
      );

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(await getInvite({inviteId: created.body._id})).not.toBeNull();
    });

    it('a downgraded user still cannot delete a normal invite above their access', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-normal-invite',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const projectAdminToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_ADMIN
      );
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${projectAdminToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
          name: 'Admin invite',
        })
        .expect(200);
      const managerToken = await downgradeProjectAdminToManager(projectId!);

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${created.body._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(401);

      expect(await getInvite({inviteId: created.body._id})).not.toBeNull();
    });

    it('revoking one quick share removes another live code from the same person', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-revoke-sibling',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const storedOnDevice = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);
      const missed = await createQuickShareInvite({
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        createdBy: adminUserName,
      });

      await request(app)
        .delete(`/api/invites/notebook/${projectId}/${storedOnDevice.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(await getInvite({inviteId: storedOnDevice.body._id})).toBeNull();
      expect(await getInvite({inviteId: missed._id})).toBeNull();
    });

    it('rejects quick share when the survey has disabled it', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-disabled',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await updateProjectMetadata(projectId!, {disableQuickShare: true});

      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(403);

      const managerToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_MANAGER
      );
      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(403);

      expect(await getQuickSharesForProject(projectId!)).toHaveLength(0);
    });

    it('does not return an existing quick share after it is disabled', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-disabled-existing',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const created = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(200);

      await updateProjectMetadata(projectId!, {disableQuickShare: true});

      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(403);

      expect(await getInvite({inviteId: created.body._id})).not.toBeNull();
    });

    it('ignores a client-supplied lifetime and expires in one hour', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-fixed-lifetime',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const before = Date.now();
      const response = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.PROJECT_GUEST,
          lifetimeMs: 15 * 60 * 1000,
        })
        .expect(200);
      expect(response.body.expiry).toBeGreaterThanOrEqual(
        before + DEFAULT_QUICK_SHARE_LIFETIME_MS
      );
      expect(response.body.expiry).toBeLessThanOrEqual(
        Date.now() + DEFAULT_QUICK_SHARE_LIFETIME_MS
      );
    });

    it('rejects a role that is not a survey role', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-bad-role',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.TEAM_MEMBER,
        })
        .expect(400);
    });

    it('allows only the invite levels the caller can create', async () => {
      const projectId = await createNotebook({
        projectName: 'quick-share-permissions',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${localUserToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(401);

      const contributorToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_CONTRIBUTOR
      );
      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .send({
          role: Role.PROJECT_GUEST,
        })
        .expect(401);

      const managerToken = await tokenForProjectRole(
        projectId!,
        Role.PROJECT_MANAGER
      );
      const allowed = await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          role: Role.PROJECT_MANAGER,
        })
        .expect(200);
      expect(allowed.body.role).toBe(Role.PROJECT_MANAGER);

      await request(app)
        .post(`/api/invites/notebook/${projectId}/quick-share`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          role: Role.PROJECT_ADMIN,
        })
        .expect(401);
    });
  });

  it('GET /api/invites/global gets all global invites', async () => {
    await createGlobalInvite({
      role: Role.OPERATIONS_ADMIN,
      name: 'Admin Invite',
      createdBy: 'admin',
    });

    await createGlobalInvite({
      role: Role.OPERATIONS_ADMIN,
      name: 'Another Admin Invite',
      createdBy: 'admin',
    });

    // create a resource specific invite to confirm it doesn't show up in the global list
    await createResourceInvite({
      resourceType: Resource.PROJECT,
      resourceId: 'some-project-id',
      role: Role.PROJECT_CONTRIBUTOR,
      name: 'Project Invite',
      createdBy: 'admin',
    });

    const response = await request(app)
      .get('/api/invites/global')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].name).toSatisfy(v =>
      ['Admin Invite', 'Another Admin Invite'].includes(v)
    );
    expect(response.body[1].name).toSatisfy(v =>
      ['Admin Invite', 'Another Admin Invite'].includes(v)
    );
  });

  it('POST /api/invites/global creates a global invite', async () => {
    // Add admin role to the admin user
    const adminUser = await getExpressUserFromEmailOrUserId('admin');
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    addGlobalRole({
      user: adminUser,
      role: Role.OPERATIONS_ADMIN,
    });

    const response = await request(app)
      .post('/api/invites/global')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: Role.OPERATIONS_ADMIN,
        name: 'Op Admin Invite',
        uses: 10,
      })
      .expect(200);

    expect(response.body._id).toBeDefined();
    expect(response.body.resourceType).toBeUndefined();
    expect(response.body.resourceId).toBeUndefined();
    expect(response.body.role).toBe(Role.OPERATIONS_ADMIN);
    expect(response.body.name).toBe('Op Admin Invite');
    expect(response.body.usesOriginal).toBe(10);
  });

  it('POST /api/invites/global does not create global invite if role is not global', async () => {
    // Add admin role to the admin user
    const adminUser = await getExpressUserFromEmailOrUserId('admin');
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    addGlobalRole({
      user: adminUser,
      role: Role.OPERATIONS_ADMIN,
    });

    const response = await request(app)
      .post('/api/invites/global')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: Role.PROJECT_CONTRIBUTOR, // Not a global role
        name: 'Op Admin Invite',
        uses: 10,
      })
      .expect(400); // Bad Request
    expect(response.body[0].errors.issues[0].message).toBe(
      'Role must be a global role to create a global invite'
    );
  });

  it('POST /api/invites/global unauthorised user cannot create a global invite', async () => {
    await request(app)
      .post('/api/invites/global')
      .set('Authorization', `Bearer ${localUserToken}`)
      .send({
        role: Role.OPERATIONS_ADMIN,
        name: 'Invite that should not be created',
        uses: 10,
      })
      .expect(401); // Unauthorized
  });

  it('DELETE /api/invites/global/:inviteId deletes a global invite', async () => {
    // Add admin role to the admin user
    const adminUser = await getExpressUserFromEmailOrUserId('admin');
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    addGlobalRole({
      user: adminUser,
      role: Role.OPERATIONS_ADMIN,
    });

    const invite = await createGlobalInvite({
      role: Role.OPERATIONS_ADMIN,
      name: 'Deletable Global Invite',
      createdBy: 'admin',
    });

    await request(app)
      .delete(`/api/invites/global/${invite._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const fetchedInvite = await getInvite({inviteId: invite._id});
    expect(fetchedInvite).toBeNull();
  });
});

describe('Registration', () => {
  beforeEach(async () => {
    await beforeApiTests();
  });

  it('redirects with a token on registration', async () => {
    if (!config.localLoginEnabled) {
      return;
    }

    const payload: PostRegisterInput = {
      email: 'bob@here.com',
      password: 'bobbyTables110010101010101',
      repeat: 'bobbyTables110010101010101',
      name: 'Bob Bobalooba',
      // Need to be careful to use a valid whitelisted URL here - this one
      // should be!
      redirect: config.webAppPublicUrl + '/auth-return',
      action: 'register',
    };

    const project_id = await createNotebook({
      projectName: 'Test Notebook',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    const role = Role.PROJECT_GUEST;

    if (project_id) {
      const invite = await createResourceInvite({
        createdBy: payload.email,
        name: 'test',
        resourceId: project_id,
        resourceType: Resource.PROJECT,
        role: role,
      });
      const code = invite._id;
      payload.inviteId = code;

      const agent = request.agent(app);

      await agent.get('/register').expect(200);

      return agent
        .post('/auth/local')
        .send(payload)
        .expect(302)
        .then(response => {
          // this would be an error condition, redirect to home
          expect(response.header.location[0]).not.toBe('/');
          // check correct redirect
          const location = new URL(response.header.location);
          expect(location.origin).toBe(config.webAppPublicUrl);
          expect(location.search).toMatch(/exchangeToken/);
        });
    }
  });

  describe('POST /api/invites/:inviteId/use', () => {
    it('requires authentication', async () => {
      await request(app)
        .post('/api/invites/FAIMS-DOESNOTEXIST000/use')
        .expect(401);
    });

    it('rejects an unknown invite', async () => {
      const response = await request(app)
        .post('/api/invites/FAIMS-DOESNOTEXIST000/use')
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(400);
      expect(response.body.error.message).toMatch(/invite/i);
    });

    it('consumes a project invite and returns an access token that includes the role', async () => {
      const projectId = await createNotebook({
        projectName: 'redeem-notebook',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Redeem Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60,
        usesOriginal: 1,
      });

      const response = await request(app)
        .post(`/api/invites/${invite._id}/use`)
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.inviteType).toBe(RoleScope.RESOURCE_SPECIFIC);
      expect(response.body.resourceType).toBe(Resource.PROJECT);
      expect(response.body.role).toBe(Role.PROJECT_CONTRIBUTOR);
      expect(response.body.resourceId).toBe(projectId);
      expect(typeof response.body.accessToken).toBe('string');

      const updated = await getExpressUserFromEmailOrUserId(localUserName);
      expect(
        userHasProjectRole({
          user: updated!,
          role: Role.PROJECT_CONTRIBUTOR,
          projectId: projectId!,
        })
      ).toBe(true);

      const directory = await request(app)
        .get('/api/directory/')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      expect(directory.body.map((item: {_id: string}) => item._id)).toContain(
        projectId
      );

      await request(app)
        .post(`/api/invites/${invite._id}/use`)
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(400);
    });

    it('reissues an access token with the same expiry as the token used to redeem', async () => {
      const projectId = await createNotebook({
        projectName: 'redeem-expiry',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Expiry Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60,
        usesOriginal: 1,
      });

      const user = await getExpressUserFromEmailOrUserId(localUserName);
      const signingKey = await keyService.getSigningKey();
      // Much shorter than a freshly minted access token so a reset expiry
      // would be obvious.
      const expiresAtSeconds = Math.floor(Date.now() / 1000) + 90;
      const sourceToken = await generateJwtFromUser({
        user: user!,
        signingKey,
        expiresAtSeconds,
      });

      const response = await request(app)
        .post(`/api/invites/${invite._id}/use`)
        .set('Authorization', `Bearer ${sourceToken}`)
        .expect(200);

      expect(decodeJwt(sourceToken).exp).toBe(expiresAtSeconds);
      expect(decodeJwt(response.body.accessToken).exp).toBe(expiresAtSeconds);
    });

    it('consumes a global invite and omits resource fields', async () => {
      const invite = await createGlobalInvite({
        role: Role.GENERAL_CREATOR,
        name: 'Global Redeem',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60,
        usesOriginal: 1,
      });

      const before = await getExpressUserFromEmailOrUserId(localUserName);
      expect(
        userHasGlobalRole({
          user: before!,
          role: Role.GENERAL_CREATOR,
        })
      ).toBe(false);

      const response = await request(app)
        .post(`/api/invites/${invite._id}/use`)
        .set('Authorization', `Bearer ${localUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.inviteType).toBe(RoleScope.GLOBAL);
      expect(response.body.resourceType).toBeUndefined();
      expect(response.body.resourceId).toBeUndefined();
      expect(response.body.role).toBe(Role.GENERAL_CREATOR);
      expect(typeof response.body.accessToken).toBe('string');

      const updated = await getExpressUserFromEmailOrUserId(localUserName);
      expect(
        userHasGlobalRole({
          user: updated!,
          role: Role.GENERAL_CREATOR,
        })
      ).toBe(true);

      const consumed = await getInvite({inviteId: invite._id});
      expect(consumed?.usesConsumed).toBe(1);
    });

    it('rejects redeeming an invite while impersonating another user', async () => {
      const projectId = await createNotebook({
        projectName: 'impersonation-redeem',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Impersonation Redeem',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60,
        usesOriginal: 1,
      });

      const user = await getExpressUserFromEmailOrUserId(localUserName);
      const signingKey = await keyService.getSigningKey();
      const impersonationToken = await generateJwtFromUser({
        user: user!,
        signingKey,
        impersonatingUserId: adminUserName,
      });

      const response = await request(app)
        .post(`/api/invites/${invite._id}/use`)
        .set('Authorization', `Bearer ${impersonationToken}`)
        .expect(403);
      expect(response.body.error.message).toMatch(/impersonat/i);

      const stillThere = await getInvite({inviteId: invite._id});
      expect(stillThere?.usesConsumed).toBe(0);
    });
  });
});
