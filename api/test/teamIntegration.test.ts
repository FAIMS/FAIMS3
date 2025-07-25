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
 * Filename: team-integration.test.ts
 * Description:
 *   Tests for team integration with projects and templates
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  Action,
  addGlobalRole,
  addProjectRole,
  addTeamRole,
  addTemplateRole,
  EncodedProjectUIModel,
  generateVirtualResourceRoles,
  PostCreateTemplateInput,
  registerClient,
  removeTeamRole,
  Resource,
  ResourceAssociation,
  Role,
} from '@faims3/data-model';
import {expect} from 'chai';
import {Express} from 'express';
import fs from 'fs';
import request from 'supertest';
import {
  generateJwtFromUser,
  getRelevantUserAssociations,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {KEY_SERVICE} from '../src/buildconfig';
import {getDataDb, localGetProjectsDb} from '../src/couchdb';
import {
  createNotebook,
  getNotebookMetadata,
  getProjectIdsByTeamId,
} from '../src/couchdb/notebooks';
import {createTeamDocument} from '../src/couchdb/teams';
import {
  createTemplate,
  getTemplate,
  getTemplateIdsByTeamId,
} from '../src/couchdb/templates';
import {createUser, saveCouchUser} from '../src/couchdb/users';
import {userCanDo} from '../src/middleware';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {adminToken, beforeApiTests, requestAuthAndType} from './utils';
import {addLocalPasswordForUser} from '../src/auth/helpers';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient(callbackObject);

const TEMPLATE_API_BASE = '/api/templates';
const NOTEBOOKS_API_BASE = '/api/notebooks';
const TEAMS_API_BASE = '/api/teams';

const uispec: EncodedProjectUIModel = {
  fields: [],
  fviews: {},
  viewsets: {},
  visible_types: [],
};

/**
 * Loads example notebook from file system and parses into appropriate format
 */
const getSampleNotebook = () => {
  const filename = 'notebooks/sample_notebook.json';
  const jsonText = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(jsonText);
};

/**
 * Creates a team with the given name and description
 */
const createTeam = async (
  app: Express,
  options: {
    teamName?: string;
    description?: string;
  },
  token: string = adminToken
) => {
  return await requestAuthAndType(
    request(app)
      .post(`${TEAMS_API_BASE}`)
      .send({
        name: options.teamName || 'Test Team',
        description:
          options.description || 'This is a test team for API testing',
      }),
    token
  )
    .expect(200)
    .then(res => {
      return res.body;
    });
};

describe('Team integration with templates and projects', () => {
  beforeEach(beforeApiTests);

  it('creates templates with and without teamId', async () => {
    // First create a team
    const team = await createTeam(app, {
      teamName: 'Template Team',
      description: 'A team for template tests',
    });

    // Load the sample notebook data
    const notebook = getSampleNotebook();

    // Create a template without teamId
    const templateWithoutTeam = await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...notebook,
          name: 'test template',
          // No teamId
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Create a template with teamId
    const templateWithTeam = await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...notebook,
          name: 'test template',
          teamId: team._id,
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Verify the templates were created
    expect(templateWithoutTeam._id).to.not.be.undefined;
    expect(templateWithTeam._id).to.not.be.undefined;

    // Verify the team association
    const actualTemplateWithTeam = await getTemplate(templateWithTeam._id);
    const actualTemplateWithoutTeam = await getTemplate(
      templateWithoutTeam._id
    );

    expect(actualTemplateWithTeam.ownedByTeamId).to.equal(team._id);
    expect(actualTemplateWithoutTeam.ownedByTeamId).to.be.undefined;
  });

  it('creates projects with and without teamId', async () => {
    // First create a team
    const team = await createTeam(app, {
      teamName: 'Project Team',
      description: 'A team for project tests',
    });

    // Create a project without teamId
    const projectWithoutTeam = await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Project without team',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          // No teamId
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Create a project with teamId
    const projectWithTeam = await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Project with team',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team._id,
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Verify the projects were created
    expect(projectWithoutTeam.notebook).to.not.be.undefined;
    expect(projectWithTeam.notebook).to.not.be.undefined;

    // Get the project metadata
    await getNotebookMetadata(projectWithTeam.notebook);
    await getNotebookMetadata(projectWithoutTeam.notebook);

    // Get the projects directory document which contains the ownedByTeamId
    await getDataDb(projectWithTeam.notebook);
    await getDataDb(projectWithoutTeam.notebook);

    // Get the project info from the projects DB
    const projectsDb = localGetProjectsDb();
    const projectDocWithTeam = await projectsDb.get(projectWithTeam.notebook);
    const projectDocWithoutTeam = await projectsDb.get(
      projectWithoutTeam.notebook
    );

    expect(projectDocWithTeam.ownedByTeamId).to.equal(team._id);
    expect(projectDocWithoutTeam.ownedByTeamId).to.be.undefined;
  });

  it('allows team members to create resources in their team', async () => {
    // Create a team
    const team = await createTeam(app, {
      teamName: 'Permission Team',
      description: 'A team for permission tests',
    });
    // Create a test user who is a team member
    const username = 'teamuser';
    const password = 'password123';
    const [user, err] = await createUser({
      username,
      name: 'Team User',
    });
    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User creation failed ' + err);
    }

    // Add team member role
    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });
    await saveCouchUser(user);
    await addLocalPasswordForUser(user, password);
    // Generate token for this user
    const signingKey = await KEY_SERVICE.getSigningKey();
    const upgraded = await upgradeCouchUserToExpressUser({dbUser: user});
    const memberToken = await generateJwtFromUser({user: upgraded, signingKey});

    // Test permissions - this user should NOT be allowed to create projects globally
    expect(
      userCanDo({
        user: upgraded,
        action: Action.CREATE_PROJECT,
        resourceId: undefined,
      })
    ).to.be.false;

    // But should also not be allowed to create projects in their team (only managers and admins can)
    expect(
      userCanDo({
        user: upgraded,
        action: Action.CREATE_PROJECT_IN_TEAM,
        resourceId: team._id,
      })
    ).to.be.false; // Members can't create projects, only managers and admins

    // Verify API rejects member's attempt to create a project in the team
    await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Member team project attempt',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team._id,
        }),
      memberToken
    ).expect(401);

    // Verify API rejects member's attempt to create a template in the team
    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...getSampleNotebook(),
          teamId: team._id,
          name: 'test template',
        } satisfies PostCreateTemplateInput),
      memberToken
    ).expect(401);

    // Upgrade to manager
    removeTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });
    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MANAGER,
    });
    await saveCouchUser(user);
    const upgradedManager = await upgradeCouchUserToExpressUser({dbUser: user});
    const managerToken = await generateJwtFromUser({
      user: upgradedManager,
      signingKey,
    });
    // Now should be allowed to create projects in their team
    expect(
      userCanDo({
        user: upgradedManager,
        action: Action.CREATE_PROJECT_IN_TEAM,
        resourceId: team._id,
      })
    ).to.be.true;
    // Try to create a project in the team using the API
    await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Team project via API',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team._id,
        }),
      managerToken
    ).expect(200);
    // Try to create a template in the team using the API
    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...getSampleNotebook(),
          name: 'test template',
          teamId: team._id,
        }),
      managerToken
    ).expect(200);
  });

  it('denies non-team members from creating resources in a team', async () => {
    // Create a team
    const team = await createTeam(app, {
      teamName: 'Private Team',
      description: 'A team for access control tests',
    });

    // Create a test user who is NOT a team member
    const username = 'outsider';
    const password = 'password123';

    const [user, err] = await createUser({
      username,
      name: 'Outsider User',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;
    if (!user) {
      throw new Error('User creation failed ' + err);
    }

    // Add basic user permissions
    addGlobalRole({
      user,
      role: Role.GENERAL_CREATOR,
    });

    await saveCouchUser(user);
    await addLocalPasswordForUser(user, password);

    // Generate token for this user
    const signingKey = await KEY_SERVICE.getSigningKey();
    const upgraded = await upgradeCouchUserToExpressUser({dbUser: user});
    const userToken = await generateJwtFromUser({user: upgraded, signingKey});

    // Test permissions - this user SHOULD be allowed to create projects globally
    expect(
      userCanDo({
        user: upgraded,
        action: Action.CREATE_PROJECT,
        resourceId: undefined,
      })
    ).to.be.true;

    // But should NOT be allowed to create projects in a team they don't belong to
    expect(
      userCanDo({
        user: upgraded,
        action: Action.CREATE_PROJECT_IN_TEAM,
        resourceId: team._id,
      })
    ).to.be.false;

    // Try to create a project in the team using the API - should be denied
    await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Unauthorized team project',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team._id,
        }),
      userToken
    ).expect(401);

    // Try to create a template in the team using the API - should be denied
    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...getSampleNotebook(),
          teamId: team._id,
          name: 'test template',
        } satisfies PostCreateTemplateInput),
      userToken
    ).expect(401);
  });

  it('allows system admin to create resources in any team', async () => {
    // Create a team
    const team = await createTeam(app, {
      teamName: 'Admin Access Team',
      description: 'A team for admin access tests',
    });

    // System admin should be able to create projects and templates in any team
    await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Admin team project',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team._id,
        }),
      adminToken
    ).expect(200);

    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...getSampleNotebook(),
          teamId: team._id,
          name: 'test name',
        } satisfies PostCreateTemplateInput),
      adminToken
    ).expect(200);
  });

  it('correctly fetches templates by team ID', async () => {
    // Create two teams
    const team1 = await createTeam(app, {
      teamName: 'Template Team 1',
      description: 'First template team',
    });

    const team2 = await createTeam(app, {
      teamName: 'Template Team 2',
      description: 'Second template team',
    });

    // Create templates in each team and one without a team
    const notebook = getSampleNotebook();

    // Create template in team 1
    const template1 = await createTemplate({
      payload: {
        ...notebook,
        name: 'tempalate1',
        teamId: team1._id,
      },
    });

    // Create template in team 2
    const template2 = await createTemplate({
      payload: {
        ...notebook,
        name: 'tempalate2',
        teamId: team2._id,
      },
    });

    // Create another template in team 1
    const template3 = await createTemplate({
      payload: {
        ...notebook,
        name: 'tempalate3',
        teamId: team1._id,
      },
    });

    // Create template without a team
    await createTemplate({
      payload: {
        ...notebook,
        name: 'tempalate4',
      },
    });

    // Get templates by team ID
    const team1Templates = await getTemplateIdsByTeamId({teamId: team1._id});
    const team2Templates = await getTemplateIdsByTeamId({teamId: team2._id});

    // Verify correct templates are returned
    expect(team1Templates).to.have.lengthOf(2);
    expect(team1Templates).to.include(template1._id);
    expect(team1Templates).to.include(template3._id);

    expect(team2Templates).to.have.lengthOf(1);
    expect(team2Templates).to.include(template2._id);
  });

  it('correctly fetches projects by team ID', async () => {
    // Create two teams
    const team1 = await createTeam(app, {
      teamName: 'Project Team 1',
      description: 'First project team',
    });

    const team2 = await createTeam(app, {
      teamName: 'Project Team 2',
      description: 'Second project team',
    });

    // Create projects in each team and one without a team
    const projectId1 = await createNotebook(
      'Team 1 Project',
      uispec,
      {},
      undefined,
      team1._id
    );
    const projectId2 = await createNotebook(
      'Team 2 Project',
      uispec,
      {},
      undefined,
      team2._id
    );
    const projectId3 = await createNotebook(
      'Team 1 Project 2',
      uispec,
      {},
      undefined,
      team1._id
    );
    await createNotebook('No Team Project', uispec, {});

    // Get projects by team ID
    const team1Projects = await getProjectIdsByTeamId({teamId: team1._id});
    const team2Projects = await getProjectIdsByTeamId({teamId: team2._id});

    // Verify correct projects are returned
    expect(team1Projects).to.have.lengthOf(2);
    expect(team1Projects).to.include(projectId1);
    expect(team1Projects).to.include(projectId3);

    expect(team2Projects).to.have.lengthOf(1);
    expect(team2Projects).to.include(projectId2);
  });

  it('virtual roles grant correct permissions to associated resources', async () => {
    // Create a team
    const team = await createTeam(app, {
      teamName: 'Virtual Roles Team',
      description: 'Team for testing virtual roles',
    });

    // Create a project owned by the team
    const projectId = await createNotebook(
      'Team Project',
      uispec,
      {},
      undefined,
      team._id
    );

    // Create a template owned by the team
    const template = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'sample template',
        teamId: team._id,
      },
    });

    // Create a test user for virtual role testing
    const [user, err] = await createUser({
      username: 'virtualuser',
      name: 'Virtual User',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    // Test with team member role
    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });

    await saveCouchUser(user);

    const upgradeToExpress = await upgradeCouchUserToExpressUser({
      dbUser: user,
    });

    // Set up resource associations
    const resourceAssociations: ResourceAssociation[] = [
      {
        resource: {
          resourceId: team._id,
          resourceType: Resource.TEAM,
        },
        associatedResources: [
          {
            resourceId: projectId!,
            resourceType: Resource.PROJECT,
          },
          {
            resourceId: template._id,
            resourceType: Resource.TEMPLATE,
          },
        ],
      },
    ];

    // Get virtual roles
    const virtualRoles = generateVirtualResourceRoles({
      resourceRoles: upgradeToExpress.resourceRoles,
      resourceAssociations,
    });

    // Check that virtual roles include project contributor role
    const hasProjectContributorVirtual = virtualRoles.some(
      role =>
        role.resourceId === projectId && role.role === Role.PROJECT_CONTRIBUTOR
    );

    expect(hasProjectContributorVirtual).to.be.true;

    // Check that virtual roles include template guest role
    const hasTemplateGuestVirtual = virtualRoles.some(
      role =>
        role.resourceId === template._id && role.role === Role.TEMPLATE_GUEST
    );

    expect(hasTemplateGuestVirtual).to.be.true;

    // Test with team manager role (should grant PROJECT_MANAGER virtually)
    removeTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });

    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MANAGER,
    });

    await saveCouchUser(user);

    const upgradeToExpressManager = await upgradeCouchUserToExpressUser({
      dbUser: user,
    });

    // Get virtual roles for manager
    const virtualRolesManager = generateVirtualResourceRoles({
      resourceRoles: upgradeToExpressManager.resourceRoles,
      resourceAssociations,
    });

    // Check that virtual roles include project manager role
    const hasProjectManagerVirtual = virtualRolesManager.some(
      role =>
        role.resourceId === projectId && role.role === Role.PROJECT_MANAGER
    );

    expect(hasProjectManagerVirtual).to.be.true;

    // Test with team admin role (should grant PROJECT_ADMIN and TEMPLATE_ADMIN virtually)
    removeTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MANAGER,
    });

    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_ADMIN,
    });

    await saveCouchUser(user);

    const upgradeToExpressAdmin = await upgradeCouchUserToExpressUser({
      dbUser: user,
    });

    // Get virtual roles for admin
    const virtualRolesAdmin = generateVirtualResourceRoles({
      resourceRoles: upgradeToExpressAdmin.resourceRoles,
      resourceAssociations,
    });

    // Check that virtual roles include project admin role
    const hasProjectAdminVirtual = virtualRolesAdmin.some(
      role => role.resourceId === projectId && role.role === Role.PROJECT_ADMIN
    );

    expect(hasProjectAdminVirtual).to.be.true;

    // Check that virtual roles include template admin role
    const hasTemplateAdminVirtual = virtualRolesAdmin.some(
      role =>
        role.resourceId === template._id && role.role === Role.TEMPLATE_ADMIN
    );

    expect(hasTemplateAdminVirtual).to.be.true;
  });

  it('can update templates and projects with teamId', async () => {
    // Create two teams
    const team1 = await createTeam(app, {
      teamName: 'Update Team 1',
      description: 'Team for update tests 1',
    });

    await createTeam(app, {
      teamName: 'Update Team 2',
      description: 'Team for update tests 2',
    });

    // Create a template in team 1
    const template = await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          ...getSampleNotebook(),
          name: 'fake template',
          teamId: team1._id,
        } satisfies PostCreateTemplateInput),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Create a project in team 1
    const project = await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Update Team Project',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
          teamId: team1._id,
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Get the template and project
    const templateData = await getTemplate(template._id);

    // Update template - teamId should persist even if not included in update
    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${template._id}`)
        .send({
          'ui-specification': templateData['ui-specification'],
          metadata: {
            ...templateData.metadata,
            updated_field: 'updated-value',
          },
        }),
      adminToken
    ).expect(200);

    const updatedTemplate = await getTemplate(template._id);
    expect(updatedTemplate.ownedByTeamId).to.equal(team1._id);

    // Update project - teamId should persist
    await requestAuthAndType(
      request(app)
        .put(`${NOTEBOOKS_API_BASE}/${project.notebook}`)
        .send({
          'ui-specification': uispec,
          metadata: {
            test_key: 'updated-value',
          },
        }),
      adminToken
    ).expect(200);

    // Get project data after update
    const projectsDb = await require('../src/couchdb').localGetProjectsDb();
    const updatedProjectDoc = await projectsDb.get(project.notebook);

    expect(updatedProjectDoc.ownedByTeamId).to.equal(team1._id);
  });

  it('can assign a project to a team after creation', async () => {
    // Create a team
    const team = await createTeam(app, {
      teamName: 'Assign Team',
      description: 'Team for assigning projects',
    });

    // Create a project without teamId
    const project = await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'Project to Assign',
          'ui-specification': uispec,
          metadata: {test_key: 'test_value'},
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body);

    // Verify project is created without teamId
    const projectsDb = localGetProjectsDb();
    const projectDoc = await projectsDb.get(project.notebook);
    expect(projectDoc.ownedByTeamId).to.be.undefined;

    // Assign the project to the team
    await requestAuthAndType(
      request(app).put(`${NOTEBOOKS_API_BASE}/${project.notebook}/team`).send({
        teamId: team._id,
      }),
      adminToken
    ).expect(200);

    // Verify the project now has the teamId assigned
    const updatedProjectDoc = await projectsDb.get(project.notebook);
    expect(updatedProjectDoc.ownedByTeamId).to.equal(team._id);
  });

  it('getRelevantUserAssociations with no teams returns empty array', async () => {
    // Create test user with no team roles
    const [user, err] = await createUser({
      username: 'noTeams',
      name: 'User Without Teams',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    const associations = await getRelevantUserAssociations({dbUser: user});
    expect(associations).to.be.an('array');
    expect(associations).to.have.lengthOf(0);
  });

  it('getRelevantUserAssociations for team with no resources returns empty associated resources', async () => {
    // Create a team
    const team = await createTeamDocument({
      name: 'Empty Team',
      description: 'Team with no resources',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create test user with team role
    const [user, err] = await createUser({
      username: 'emptyTeamUser',
      name: 'User In Empty Team',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });

    await saveCouchUser(user);

    const associations = await getRelevantUserAssociations({dbUser: user});
    expect(associations).to.be.an('array');
    // Will have two entries - one for Project associations and one for Template associations
    expect(associations).to.have.lengthOf(2);

    // Both should have empty associated resources arrays
    associations.forEach(association => {
      expect(association.resource.resourceId).to.equal(team._id);
      expect(association.resource.resourceType).to.equal(Resource.TEAM);
      expect(association.associatedResources).to.be.an('array');
      expect(association.associatedResources).to.have.lengthOf(0);
    });
  });

  it('getRelevantUserAssociations for team with mixed resources', async () => {
    // Create a team
    const team = await createTeamDocument({
      name: 'Mixed Resources Team',
      description: 'Team with both projects and templates',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create projects owned by the team
    const project1 = await createNotebook(
      'Team Project 1',
      uispec,
      {},
      undefined,
      team._id
    );
    const project2 = await createNotebook(
      'Team Project 2',
      uispec,
      {},
      undefined,
      team._id
    );

    // Create templates owned by the team
    const template1 = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 1',
        teamId: team._id,
      },
    });
    const template2 = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 2',
        teamId: team._id,
      },
    });

    // Create test user with team role
    const [user, err] = await createUser({
      username: 'mixedTeamUser',
      name: 'User In Mixed Team',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    addTeamRole({
      user,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });

    await saveCouchUser(user);

    const associations = await getRelevantUserAssociations({dbUser: user});
    expect(associations).to.be.an('array');
    expect(associations).to.have.lengthOf(2);

    // Find the project and template associations
    const projectAssociation = associations.find(
      a =>
        a.associatedResources.length > 0 &&
        a.associatedResources[0].resourceType === Resource.PROJECT
    );

    const templateAssociation = associations.find(
      a =>
        a.associatedResources.length > 0 &&
        a.associatedResources[0].resourceType === Resource.TEMPLATE
    );

    // Verify project associations
    expect(projectAssociation).to.not.be.undefined;
    if (projectAssociation) {
      expect(projectAssociation.resource.resourceId).to.equal(team._id);
      expect(projectAssociation.resource.resourceType).to.equal(Resource.TEAM);
      expect(projectAssociation.associatedResources).to.have.lengthOf(2);

      const projectIds = projectAssociation.associatedResources.map(
        r => r.resourceId
      );
      expect(projectIds).to.include(project1);
      expect(projectIds).to.include(project2);
    }

    // Verify template associations
    expect(templateAssociation).to.not.be.undefined;
    if (templateAssociation) {
      expect(templateAssociation.resource.resourceId).to.equal(team._id);
      expect(templateAssociation.resource.resourceType).to.equal(Resource.TEAM);
      expect(templateAssociation.associatedResources).to.have.lengthOf(2);

      const templateIds = templateAssociation.associatedResources.map(
        r => r.resourceId
      );
      expect(templateIds).to.include(template1._id);
      expect(templateIds).to.include(template2._id);
    }
  });

  it('getRelevantUserAssociations handles user with multiple teams', async () => {
    // Create multiple teams
    const team1 = await createTeamDocument({
      name: 'Team One',
      description: 'First team',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const team2 = await createTeamDocument({
      name: 'Team Two',
      description: 'Second team',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const team3 = await createTeamDocument({
      name: 'Team Three',
      description: 'Third team - no resources',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create resources for team 1
    const project1 = await createNotebook(
      'Team 1 Project',
      uispec,
      {},
      undefined,
      team1._id
    );
    await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 1',
        teamId: team1._id,
      },
    });

    // Create resources for team 2
    const project2a = await createNotebook(
      'Team 2 Project A',
      uispec,
      {},
      undefined,
      team2._id
    );
    const project2b = await createNotebook(
      'Team 2 Project B',
      uispec,
      {},
      undefined,
      team2._id
    );
    await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 1',
        teamId: team2._id,
      },
    });

    // Create test user with multiple team roles
    const [user, err] = await createUser({
      username: 'multiTeamUser',
      name: 'User In Multiple Teams',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    // Add user to all three teams with different roles
    addTeamRole({
      user,
      teamId: team1._id,
      role: Role.TEAM_MEMBER,
    });

    addTeamRole({
      user,
      teamId: team2._id,
      role: Role.TEAM_MANAGER,
    });

    addTeamRole({
      user,
      teamId: team3._id,
      role: Role.TEAM_ADMIN,
    });

    await saveCouchUser(user);

    const associations = await getRelevantUserAssociations({dbUser: user});
    expect(associations).to.be.an('array');

    // Should have 6 associations: 2 resource types × 3 teams
    expect(associations).to.have.lengthOf(6);

    // Group associations by team
    const team1Assocs = associations.filter(
      a => a.resource.resourceId === team1._id
    );
    const team2Assocs = associations.filter(
      a => a.resource.resourceId === team2._id
    );
    const team3Assocs = associations.filter(
      a => a.resource.resourceId === team3._id
    );

    // Each team should have 2 associations (one for projects, one for templates)
    expect(team1Assocs).to.have.lengthOf(2);
    expect(team2Assocs).to.have.lengthOf(2);
    expect(team3Assocs).to.have.lengthOf(2);

    // Check team 1 associations
    const team1ProjectAssoc = team1Assocs.find(
      a =>
        a.associatedResources.length > 0 &&
        a.associatedResources[0].resourceType === Resource.PROJECT
    );

    if (team1ProjectAssoc) {
      expect(team1ProjectAssoc.associatedResources).to.have.lengthOf(1);
      expect(team1ProjectAssoc.associatedResources[0].resourceId).to.equal(
        project1
      );
    }

    // Check team 2 associations
    const team2ProjectAssoc = team2Assocs.find(
      a =>
        a.associatedResources.length > 0 &&
        a.associatedResources[0].resourceType === Resource.PROJECT
    );

    if (team2ProjectAssoc) {
      expect(team2ProjectAssoc.associatedResources).to.have.lengthOf(2);
      const projectIds = team2ProjectAssoc.associatedResources.map(
        r => r.resourceId
      );
      expect(projectIds).to.include(project2a);
      expect(projectIds).to.include(project2b);
    }
  });

  it('upgradeDbUserToExpressUser correctly adds virtual roles', async () => {
    // Create a team
    const team = await createTeamDocument({
      name: 'Virtual Role Team',
      description: 'Team for testing virtual roles in upgraded user',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create a project owned by the team
    const projectId = await createNotebook(
      'Team Project',
      uispec,
      {},
      undefined,
      team._id
    );

    // Create a template owned by the team
    const template = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 1',
        teamId: team._id,
      },
    });

    // Create test users with different team roles
    const [memberUser, err1] = await createUser({
      username: 'teamMember',
      name: 'Team Member User',
    });

    const [managerUser, err2] = await createUser({
      username: 'teamManager',
      name: 'Team Manager User',
    });

    const [adminUser, err3] = await createUser({
      username: 'teamAdmin',
      name: 'Team Admin User',
    });

    expect(err1).to.equal('');
    expect(err2).to.equal('');
    expect(err3).to.equal('');

    expect(memberUser).to.not.be.null;
    expect(managerUser).to.not.be.null;
    expect(adminUser).to.not.be.null;

    if (!memberUser || !managerUser || !adminUser) {
      throw new Error(
        'Failed to create users ' + err1 || err2 || err3 || 'Unknown...'
      );
    }

    // Assign different roles to each user
    addTeamRole({
      user: memberUser,
      teamId: team._id,
      role: Role.TEAM_MEMBER,
    });

    addTeamRole({
      user: managerUser,
      teamId: team._id,
      role: Role.TEAM_MANAGER,
    });

    addTeamRole({
      user: adminUser,
      teamId: team._id,
      role: Role.TEAM_ADMIN,
    });

    await saveCouchUser(memberUser);
    await saveCouchUser(managerUser);
    await saveCouchUser(adminUser);

    // Upgrade users
    const upgradedMember = await upgradeCouchUserToExpressUser({
      dbUser: memberUser,
    });
    const upgradedManager = await upgradeCouchUserToExpressUser({
      dbUser: managerUser,
    });
    const upgradedAdmin = await upgradeCouchUserToExpressUser({
      dbUser: adminUser,
    });

    // Check member permissions
    expect(
      userCanDo({
        user: upgradedMember,
        action: Action.READ_PROJECT_METADATA,
        resourceId: projectId,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedMember,
        action: Action.READ_ALL_PROJECT_RECORDS,
        resourceId: projectId,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedMember,
        action: Action.DELETE_PROJECT,
        resourceId: projectId,
      })
    ).to.be.false;

    expect(
      userCanDo({
        user: upgradedMember,
        action: Action.READ_TEMPLATE_DETAILS,
        resourceId: template._id,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedMember,
        action: Action.DELETE_TEMPLATE,
        resourceId: template._id,
      })
    ).to.be.false;

    // Check manager permissions
    expect(
      userCanDo({
        user: upgradedManager,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: projectId,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedManager,
        action: Action.DELETE_PROJECT,
        resourceId: projectId,
      })
    ).to.be.false;

    // Check admin permissions
    expect(
      userCanDo({
        user: upgradedAdmin,
        action: Action.DELETE_PROJECT,
        resourceId: projectId,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedAdmin,
        action: Action.DELETE_TEMPLATE,
        resourceId: template._id,
      })
    ).to.be.true;
  });

  it('upgradeDbUserToExpressUser with complex resource hierarchy', async () => {
    // Create test user with mixed team roles
    const [user, err] = await createUser({
      username: 'complexUser',
      name: 'User With Complex Hierarchy',
    });

    expect(err).to.equal('');
    expect(user).to.not.be.null;

    if (!user) {
      throw new Error('User create failed ' + err);
    }

    // Add global role
    addGlobalRole({
      user,
      role: Role.GENERAL_CREATOR,
    });

    await saveCouchUser(user);

    // Create multiple teams with overlapping resources
    const team1 = await createTeamDocument({
      name: 'Primary Team',
      description: 'Primary team with multiple resources',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const team2 = await createTeamDocument({
      name: 'Secondary Team',
      description: 'Secondary team with some resources',
      createdBy: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create resources for team 1
    const project1a = await createNotebook(
      'Team 1 Project A',
      uispec,
      {},
      undefined,
      team1._id
    );
    await createNotebook('Team 1 Project B', uispec, {}, undefined, team1._id);
    const template1 = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 1',
        teamId: team1._id,
      },
    });

    // Create resources for team 2
    const project2 = await createNotebook(
      'Team 2 Project',
      uispec,
      {},
      undefined,
      team2._id
    );
    await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'template 2',
        teamId: team2._id,
      },
    });

    // Create some non-team resources
    const independentProject = await createNotebook(
      'Independent Project',
      uispec,
      {}
    );

    const independentTemplate = await createTemplate({
      payload: {
        ...getSampleNotebook(),
        name: 'independant template',
      },
    });

    // Make the user an admin of the independent notebook (since they made it)
    addTemplateRole({
      role: Role.TEMPLATE_ADMIN,
      templateId: independentTemplate._id,
      user,
    });

    // Add user to teams with different roles
    addTeamRole({
      user,
      teamId: team1._id,
      role: Role.TEAM_ADMIN,
    });

    addTeamRole({
      user,
      teamId: team2._id,
      role: Role.TEAM_MEMBER,
    });

    // Add direct project role (non-virtual)
    addProjectRole({
      user,
      projectId: independentProject!,
      role: Role.PROJECT_MANAGER,
    });

    await saveCouchUser(user);

    // Upgrade user
    const upgradedUser = await upgradeCouchUserToExpressUser({dbUser: user});

    // Test permissions on team 1 resources (should have admin access)
    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.DELETE_PROJECT,
        resourceId: project1a,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.DELETE_TEMPLATE,
        resourceId: template1._id,
      })
    ).to.be.true;

    // Test permissions on team 2 resources (should have contributor access)
    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.READ_ALL_PROJECT_RECORDS,
        resourceId: project2,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.DELETE_PROJECT,
        resourceId: project2,
      })
    ).to.be.false;

    // Test permissions on independent project (direct role)
    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.UPDATE_PROJECT_DETAILS,
        resourceId: independentProject,
      })
    ).to.be.true;

    // Test permissions on independent template - since user created it - they
    // should have admin
    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.READ_TEMPLATE_DETAILS,
        resourceId: independentTemplate._id,
      })
    ).to.be.true;

    // Test global permissions
    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.CREATE_PROJECT,
        resourceId: undefined,
      })
    ).to.be.true;

    expect(
      userCanDo({
        user: upgradedUser,
        action: Action.CREATE_TEMPLATE,
        resourceId: undefined,
      })
    ).to.be.true;
  });
});
