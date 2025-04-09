/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: invites.test.ts
 * Description:
 *   Tests for the invites functionality
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {
  addProjectRole,
  addTeamRole,
  EncodedProjectUIModel,
  registerClient,
  Resource,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {
  createInvite,
  deleteInvite,
  getInvite,
  getInvitesForResource,
  isInviteValid,
  consumeInvite,
} from '../src/couchdb/invites';
import {createNotebook} from '../src/couchdb/notebooks';
import {createTeamDocument} from '../src/couchdb/teams';
import {getExpressUserFromEmailOrUsername} from '../src/couchdb/users';
import {app} from '../src/routes';
import {callbackObject} from './mocks';
import {
  adminToken,
  beforeApiTests,
  localUserName,
  localUserToken,
} from './utils';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient(callbackObject);

const uispec: EncodedProjectUIModel = {
  _id: '',
  fields: [],
  fviews: {},
  viewsets: {},
  visible_types: [],
};

describe('Invite Tests', () => {
  beforeEach(beforeApiTests);

  // DB METHOD TESTS
  describe('Database Methods Tests', () => {
    it('can create an invite for a project', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24, // 1 day
        usesOriginal: 5,
      });

      expect(invite).to.not.be.null;
      expect(invite._id).to.include('-');
      expect(invite.resourceType).to.equal(Resource.PROJECT);
      expect(invite.resourceId).to.equal(projectId);
      expect(invite.role).to.equal(Role.PROJECT_CONTRIBUTOR);
      expect(invite.name).to.equal('Test Invite');
      expect(invite.createdBy).to.equal('admin');
      expect(invite.usesOriginal).to.equal(5);
      expect(invite.usesConsumed).to.equal(0);
      expect(invite.uses).to.be.an('array').that.is.empty;
    });

    it('can create an invite for a team', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      const invite = await createInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_MEMBER,
        name: 'Team Invite',
        createdBy: 'admin',
      });

      expect(invite).to.not.be.null;
      expect(invite._id).to.include('-');
      expect(invite.resourceType).to.equal(Resource.TEAM);
      expect(invite.resourceId).to.equal(team._id);
      expect(invite.role).to.equal(Role.TEAM_MEMBER);
      expect(invite.name).to.equal('Team Invite');
      expect(invite.createdBy).to.equal('admin');
      expect(invite.usesOriginal).to.be.undefined;
      expect(invite.usesConsumed).to.equal(0);
    });

    it('can get an invite by ID', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
      });

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).to.not.be.null;
      expect(fetchedInvite?._id).to.equal(invite._id);
      expect(fetchedInvite?.resourceType).to.equal(Resource.PROJECT);
      expect(fetchedInvite?.resourceId).to.equal(projectId);
    });

    it('returns null when getting non-existent invite', async () => {
      const fetchedInvite = await getInvite({inviteId: 'non-existent-id'});
      expect(fetchedInvite).to.be.null;
    });

    it('can get invites for a resource', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Contributor Invite',
        createdBy: 'admin',
      });

      await createInvite({
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

      expect(invites).to.be.an('array').with.lengthOf(2);
      expect(invites[0].name).to.be.oneOf([
        'Contributor Invite',
        'Admin Invite',
      ]);
      expect(invites[1].name).to.be.oneOf([
        'Contributor Invite',
        'Admin Invite',
      ]);
      expect(invites[0].name).to.not.equal(invites[1].name);
    });

    it('can delete an invite', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
      });

      const deletedInvite = await deleteInvite({invite});
      expect(deletedInvite._id).to.equal(invite._id);

      const fetchedInvite = await getInvite({inviteId: invite._id});
      expect(fetchedInvite).to.be.null;
    });

    it('can check if an invite is valid', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});

      // Create valid invite
      const validInvite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Valid Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24, // 1 day
      });

      const validityCheck = isInviteValid({invite: validInvite});
      expect(validityCheck.isValid).to.be.true;
      expect(validityCheck.reason).to.be.undefined;

      // Create expired invite
      const expiredInvite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Expired Invite',
        createdBy: 'admin',
        expiry: Date.now() - 1000, // 1 second ago
      });

      const expiredCheck = isInviteValid({invite: expiredInvite});
      expect(expiredCheck.isValid).to.be.false;
      expect(expiredCheck.reason).to.equal('Invite has expired');

      // Create limited use invite
      const limitedInvite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Limited Invite',
        createdBy: 'admin',
        expiry: Date.now() + 1000 * 60 * 60 * 24,
        usesOriginal: 2,
      });

      // Use the invite twice to reach the limit
      const localUser = await getExpressUserFromEmailOrUsername(localUserName);
      expect(localUser).to.not.be.null;

      await consumeInvite({
        invite: limitedInvite,
        user: localUser!,
      });

      const updatedInvite = await getInvite({inviteId: limitedInvite._id});
      await consumeInvite({
        invite: updatedInvite!,
        user: localUser!,
      });

      // Check if it's now invalid due to usage limit
      const finalInvite = await getInvite({inviteId: limitedInvite._id});
      const usedUpCheck = isInviteValid({invite: finalInvite!});
      expect(usedUpCheck.isValid).to.be.false;
      expect(usedUpCheck.reason).to.equal(
        'Invite has been used the maximum number of times'
      );
    });

    it('can use an invite and record usage', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Test Invite',
        createdBy: 'admin',
        usesOriginal: 3,
      });

      const localUser = await getExpressUserFromEmailOrUsername(localUserName);
      expect(localUser).to.not.be.null;

      // Check initial state
      expect(invite.usesConsumed).to.equal(0);
      expect(invite.uses).to.be.an('array').that.is.empty;
      expect(
        userHasProjectRole({
          user: localUser!,
          projectId: projectId!,
          role: Role.PROJECT_CONTRIBUTOR,
        })
      ).to.be.false;

      // Add the role
      addProjectRole({
        user: localUser!,
        projectId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
      });

      // Use the invite
      const updatedInvite = await consumeInvite({
        invite,
        user: localUser!,
      });

      // Check results
      expect(updatedInvite.usesConsumed).to.equal(1);
      expect(updatedInvite.uses).to.be.an('array').with.lengthOf(1);
      expect(updatedInvite.uses[0].userId).to.equal(localUser!.user_id);

      // Double check the role was added
      expect(
        userHasProjectRole({
          user: localUser!,
          projectId: projectId!,
          role: Role.PROJECT_CONTRIBUTOR,
        })
      ).to.be.true;
    });
  });

  // API ENDPOINT TESTS
  describe('API Endpoint Tests', () => {
    it('GET /api/invites/:inviteId returns invite details', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
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

      expect(response.body.id).to.equal(invite._id);
      expect(response.body.resourceType).to.equal(Resource.PROJECT);
      expect(response.body.resourceId).to.equal(projectId);
      expect(response.body.name).to.equal('Public Invite');
      expect(response.body.role).to.equal(Role.PROJECT_CONTRIBUTOR);
      expect(response.body.isValid).to.be.true;
      expect(response.body.usesRemaining).to.equal(5);
    });

    it('GET /api/invites/notebook/:projectId requires authentication', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      await request(app).get(`/api/invites/notebook/${projectId}`).expect(401);
    });

    it('GET /api/invites/notebook/:projectId returns project invites', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});

      await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Contributor Invite',
        createdBy: 'admin',
      });

      await createInvite({
        resourceType: Resource.PROJECT,
        resourceId: projectId!,
        role: Role.PROJECT_ADMIN,
        name: 'Admin Invite',
        createdBy: 'admin',
      });

      const response = await request(app)
        .get(`/api/invites/notebook/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.be.an('array').with.lengthOf(2);
      expect(response.body[0].name).to.be.oneOf([
        'Contributor Invite',
        'Admin Invite',
      ]);
      expect(response.body[1].name).to.be.oneOf([
        'Contributor Invite',
        'Admin Invite',
      ]);
    });

    it('GET /api/invites/team/:teamId returns team invites', async () => {
      const team = await createTeamDocument({
        name: 'Test Team',
        description: 'A team for testing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      });

      await createInvite({
        resourceType: Resource.TEAM,
        resourceId: team._id,
        role: Role.TEAM_MEMBER,
        name: 'Member Invite',
        createdBy: 'admin',
      });

      await createInvite({
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

      expect(response.body).to.be.an('array').with.lengthOf(2);
      expect(response.body[0].name).to.be.oneOf([
        'Member Invite',
        'Admin Invite',
      ]);
      expect(response.body[1].name).to.be.oneOf([
        'Member Invite',
        'Admin Invite',
      ]);
    });

    it('POST /api/invites/notebook/:projectId creates a project invite', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});

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

      expect(response.body._id).to.exist;
      expect(response.body.resourceType).to.equal(Resource.PROJECT);
      expect(response.body.resourceId).to.equal(projectId);
      expect(response.body.role).to.equal(Role.PROJECT_CONTRIBUTOR);
      expect(response.body.name).to.equal('API Created Invite');
      expect(response.body.usesOriginal).to.equal(3);
      expect(response.body.usesConsumed).to.equal(0);
      expect(response.body.createdBy).to.equal('admin');
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
      const adminUser = await getExpressUserFromEmailOrUsername('admin');
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

      expect(response.body._id).to.exist;
      expect(response.body.resourceType).to.equal(Resource.TEAM);
      expect(response.body.resourceId).to.equal(team._id);
      expect(response.body.role).to.equal(Role.TEAM_MEMBER);
      expect(response.body.name).to.equal('Team API Invite');
      expect(response.body.usesOriginal).to.equal(10);
    });

    it('DELETE /api/invites/notebook/:projectId/:inviteId deletes a project invite', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});
      const invite = await createInvite({
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
      expect(fetchedInvite).to.be.null;
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
      const adminUser = await getExpressUserFromEmailOrUsername('admin');
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      addTeamRole({
        user: adminUser,
        teamId: team._id,
        role: Role.TEAM_ADMIN,
      });

      const invite = await createInvite({
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
      expect(fetchedInvite).to.be.null;
    });

    it('Non-admins cannot create project admin invites', async () => {
      const projectId = await createNotebook('test-notebook', uispec, {});

      // Add contributor role to local user
      const localUserDb =
        await getExpressUserFromEmailOrUsername(localUserName);
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
});

describe('Registration', () => {
  beforeEach(async () => {
    await beforeApiTests();
  });

  it('redirects with a token on registration', async () => {
    const payload = {
      email: 'bob@here.com',
      password: 'bobbyTables',
      repeat: 'bobbyTables',
      name: 'Bob Bobalooba',
      redirect: 'http://redirect.org/',
    };

    const project_id = await createNotebook('Test Notebook', uispec, {});
    const role = Role.PROJECT_GUEST;

    if (project_id) {
      const invite = await createInvite({
        createdBy: payload.email,
        name: 'test',
        resourceId: project_id,
        resourceType: Resource.PROJECT,
        role: role,
      });
      const code = invite._id;

      const agent = request.agent(app);

      await agent
        .get(`/register/${code}?redirect=${payload.redirect}`)
        .expect(200);

      return agent
        .post('/register/local/')
        .send(payload)
        .expect(302)
        .then(response => {
          // this would be an error condition, redirect to home
          expect(response.header.location[0]).not.to.equal('/');
          // check correct redirect
          const location = new URL(response.header.location);
          expect(location.hostname).to.equal('redirect.org');
          expect(location.search).to.match(/token/);
        });
    }
  });
});
