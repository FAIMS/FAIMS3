// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: teams.api.test.ts
 * Description:
 *   Tests for the Teams API
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  addTeamRole,
  GetListTeamsResponse,
  GetListTeamsResponseSchema,
  GetTeamByIdResponse,
  GetTeamByIdResponseSchema,
  PostCreateTeamInput,
  PostCreateTeamResponse,
  PostCreateTeamResponseSchema,
  PutUpdateTeamInput,
  PutUpdateTeamResponse,
  PutUpdateTeamResponseSchema,
  Role,
  userHasTeamRole,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {Express} from 'express';
import request from 'supertest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {keyService} from '../src/buildconfig';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {
  EMPTY_UI_SPECIFICATION,
  sampleCreateTemplatePayload,
  testNotebookDescription,
} from './sampleNotebook';
import {
  adminToken,
  beforeApiTests,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

// Define the base URL for the Teams API
const TEAMS_API_BASE = '/api/teams';

/**
 * Creates a new team through API
 * @param app The express API app
 * @param options Custom options for team creation
 * @param token Auth token to use (defaults to admin)
 * @returns The created team document
 */
export const createSampleTeam = async (
  app: Express,
  options: {
    teamName?: string;
    description?: string;
  },
  token: string = adminToken
): Promise<PostCreateTeamResponse> => {
  const teamData: PostCreateTeamInput = {
    name: options.teamName || 'Test Team',
    description: options.description || 'This is a test team for API testing',
  };

  return await requestAuthAndType(
    request(app).post(`${TEAMS_API_BASE}`).send(teamData),
    token
  )
    .expect(200)
    .then(res => {
      // Parse the response as proper model
      return PostCreateTeamResponseSchema.parse(res.body);
    });
};

/**
 * Lists all teams through API
 * @param app The express API app
 * @param token Auth token to use (defaults to admin)
 * @returns List of teams
 */
export const listTeams = async (
  app: Express,
  token: string = adminToken,
  query?: {includeArchived?: boolean}
): Promise<GetListTeamsResponse> => {
  const qs = query?.includeArchived === true ? '?includeArchived=true' : '';
  return await requestAuthAndType(
    request(app).get(`${TEAMS_API_BASE}${qs}`),
    token
  )
    .expect(200)
    .then(res => {
      // Parse the response body against model
      return GetListTeamsResponseSchema.parse(res.body);
    });
};

const setTeamArchived = async (
  app: Express,
  teamId: string,
  archive: boolean,
  token: string = adminToken
) => {
  return await requestAuthAndType(
    request(app).put(`${TEAMS_API_BASE}/${teamId}/archive`).send({archive}),
    token
  ).expect(200);
};

/**
 * Fetches a team by ID through API
 * @param app The express API app
 * @param teamId The team ID to fetch
 * @param token Auth token to use (defaults to admin)
 * @returns The team document
 */
const getATeam = async (
  app: Express,
  teamId: string,
  token: string = adminToken
): Promise<GetTeamByIdResponse> => {
  return await requestAuthAndType(
    request(app).get(`${TEAMS_API_BASE}/${teamId}`),
    token
  )
    .expect(200)
    .then(res => {
      // Parse the response body against model
      return GetTeamByIdResponseSchema.parse(res.body);
    });
};

/**
 * Updates a team through API
 * @param app The express API app
 * @param teamId The team ID to update
 * @param payload Update payload
 * @param token Auth token to use (defaults to admin)
 * @returns The updated team document
 */
const updateATeam = async (
  app: Express,
  teamId: string,
  payload: PutUpdateTeamInput,
  token: string = adminToken
): Promise<PutUpdateTeamResponse> => {
  return await requestAuthAndType(
    request(app).put(`${TEAMS_API_BASE}/${teamId}`).send(payload),
    token
  )
    .expect(200)
    .then(res => {
      // Parse the response as proper model
      return PutUpdateTeamResponseSchema.parse(res.body);
    });
};

/**
 * Deletes a team through API
 * @param app The express API app
 * @param teamId The team ID to delete
 * @param token Auth token to use (defaults to admin)
 */
const deleteATeam = async (
  app: Express,
  teamId: string,
  token: string = adminToken
) => {
  return await requestAuthAndType(
    request(app).post(`${TEAMS_API_BASE}/${teamId}/delete`),
    token
  )
    .send()
    .expect(200);
};

describe('Teams API tests', () => {
  beforeEach(beforeApiTests);

  //======= TEAMS ===========
  //========================

  it('create, list, get, delete', async () => {
    // Create a team
    const team1 = await createSampleTeam(app, {
      teamName: 'First Test Team',
      description: 'First test team description',
    });
    const teamId1 = team1._id;

    // List and verify the new team
    await listTeams(app).then(teamList => {
      // Check that the list exists and has one entry
      expect(teamList.teams.length).toBe(1);

      // Get the first entry and check ID matches
      const entry = teamList.teams[0];
      expect(entry._id).toBe(teamId1);
      expect(entry.name).toBe('First Test Team');
      expect(entry.description).toBe('First test team description');

      // Check timestamps and creator fields exist
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');
      expect(entry).toHaveProperty('createdBy');
    });

    // Get the specific team
    await getATeam(app, teamId1).then(team => {
      // Check properties match
      expect(team._id).toBe(teamId1);
      expect(team.name).toBe('First Test Team');
      expect(team.description).toBe('First test team description');

      // Check timestamps and creator fields exist
      expect(team).toHaveProperty('createdAt');
      expect(team).toHaveProperty('updatedAt');
      expect(team).toHaveProperty('createdBy');
    });

    // Create another team
    const team2 = await createSampleTeam(app, {
      teamName: 'Second Test Team',
      description: 'Second test team description',
    });
    const teamId2 = team2._id;

    // List and check for both teams
    await listTeams(app).then(teamList => {
      // Check that the list exists and has two entries
      expect(teamList.teams.length).toBe(2);

      // Find both teams in the list
      const firstTeam = teamList.teams.find(t => t._id === teamId1);
      const secondTeam = teamList.teams.find(t => t._id === teamId2);

      expect(firstTeam).not.toBeUndefined();
      expect(secondTeam).not.toBeUndefined();

      // Check properties of second team
      if (secondTeam) {
        expect(secondTeam.name).toBe('Second Test Team');
        expect(secondTeam.description).toBe('Second test team description');
      }
    });

    // Get the second team specifically
    await getATeam(app, teamId2).then(team => {
      expect(team._id).toBe(teamId2);
      expect(team.name).toBe('Second Test Team');
      expect(team.description).toBe('Second test team description');
    });

    // Delete the second team (must be archived first)
    await setTeamArchived(app, teamId2, true);
    await deleteATeam(app, teamId2);

    // List again and check there's only one team
    await listTeams(app).then(teamList => {
      expect(teamList.teams.length).toBe(1);
      expect(teamList.teams[0]._id).toBe(teamId1);
    });

    // Delete the first team
    await setTeamArchived(app, teamId1, true);
    await deleteATeam(app, teamId1);

    // List again and check there are no teams
    await listTeams(app).then(teamList => {
      expect(teamList.teams.length).toBe(0);
    });
  });

  it('update team details', async () => {
    // Create a team
    const team = await createSampleTeam(app, {
      teamName: 'Original Team Name',
      description: 'Original description',
    });

    // Update the team name
    await updateATeam(app, team._id, {
      name: 'Updated Team Name',
    }).then(updatedTeam => {
      // Check the updated properties
      expect(updatedTeam.name).toBe('Updated Team Name');
      // Description should remain unchanged
      expect(updatedTeam.description).toBe('Original description');
      // updatedAt should be changed
      expect(updatedTeam.updatedAt).toBeGreaterThan(team.updatedAt);
    });

    // Get the team and verify updates
    await getATeam(app, team._id).then(fetchedTeam => {
      expect(fetchedTeam.name).toBe('Updated Team Name');
      expect(fetchedTeam.description).toBe('Original description');
    });

    // Update just the description
    await updateATeam(app, team._id, {
      description: 'Updated description',
    }).then(updatedTeam => {
      expect(updatedTeam.name).toBe('Updated Team Name');
      expect(updatedTeam.description).toBe('Updated description');
    });

    // Update both name and description
    await updateATeam(app, team._id, {
      name: 'Final Team Name',
      description: 'Final description',
    }).then(updatedTeam => {
      expect(updatedTeam.name).toBe('Final Team Name');
      expect(updatedTeam.description).toBe('Final description');
    });
  });

  // Edge conditions for teams
  //=========================

  it('empty team list', async () => {
    // Make list request on empty database
    await listTeams(app).then(teamList => {
      // Check that the list exists and has empty length
      expect(teamList.teams.length).toBe(0);
    });
  });

  it("update team which doesn't exist", async () => {
    // Try updating non-existent team
    const fakeId = 'nonexistent-team-id';
    await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${fakeId}`)
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        } as PutUpdateTeamInput)
    )
      // Expect 404 not found
      .expect(404)
      // Check the error response
      .then(res => {
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('status');
        // Check for expected error message
        expect(res.body.error.message).toContain(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).toBe(404);
      });

    // Create a team first to make sure other teams are working
    await createSampleTeam(app, {});
    // Still expect 404 for nonexistent team
    await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${fakeId}`)
        .send({
          name: 'Updated Name',
        } as PutUpdateTeamInput)
    ).expect(404);
  });

  it("delete team which doesn't exist", async () => {
    // Try deleting non-existent team
    const fakeId = 'nonexistent-team-id';
    await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${fakeId}/delete`)
    )
      // Expect 404 not found
      .expect(404)
      // Check the error response
      .then(res => {
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('status');
        // Check for expected error message
        expect(res.body.error.message).toContain(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).toBe(404);
      });

    // Create a team first to make sure other teams are working
    await createSampleTeam(app, {});
    // Still expect 404 for nonexistent team
    await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${fakeId}/delete`)
    ).expect(404);
  });

  it("get team which doesn't exist", async () => {
    // Try getting non-existent team
    const fakeId = 'nonexistent-team-id';
    await requestAuthAndType(request(app).get(`${TEAMS_API_BASE}/${fakeId}`))
      // Expect 404 not found
      .expect(404)
      // Check the error response
      .then(res => {
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('status');
        // Check for expected error message
        expect(res.body.error.message).toContain(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).toBe(404);
      });
  });

  it('invalid input due to missing required fields', async () => {
    // Try to create a team with missing required field (name)
    await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}`).send({
        // Missing name
        description: 'Test description',
      })
    )
      // Expect 400 bad request
      .expect(400)
      // Check error response
      .then(res => {
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBeGreaterThanOrEqual(1);

        const err = res.body[0];
        expect(err).toHaveProperty('type');
        expect(err.type).toBe('Body');
        // Error should mention name field
        expect(JSON.stringify(err.errors)).toContain('name');
      });
  });

  // Auth checks
  // ===========
  it('list teams not authorized', async () => {
    await request(app)
      .get(`${TEAMS_API_BASE}`)
      .set('Content-Type', 'application/json')
      .send()
      .expect(401);
  });

  it('get team not authorized', async () => {
    await request(app).get(`${TEAMS_API_BASE}/123456`).send().expect(401);
  });

  it('update team not authorized', async () => {
    await request(app)
      .put(`${TEAMS_API_BASE}/123456`)
      .send({
        name: 'Updated Name',
        description: 'Updated description',
      } as PutUpdateTeamInput)
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('create team not authorized', async () => {
    return await request(app)
      .post(`${TEAMS_API_BASE}`)
      .send({
        name: 'New Team',
        description: 'New description',
      } as PostCreateTeamInput)
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('delete team not authorized', async () => {
    return await request(app)
      .post(`${TEAMS_API_BASE}/123456/delete`)
      .send()
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('not allowed to create team with local user', async () => {
    return await requestAuthAndType(
      request(app)
        .post(`${TEAMS_API_BASE}`)
        .send({
          name: 'New Team',
          description: 'New description',
        } as PostCreateTeamInput),
      localUserToken
    )
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('not allowed to update team with local user', async () => {
    return await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/123456`)
        .send({
          name: 'Updated Name',
        } as PutUpdateTeamInput),
      localUserToken
    ).expect(401);
  });

  it('not allowed to delete team with local user', async () => {
    return await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/123456/delete`).send(),
      localUserToken
    ).expect(401);
  });

  it('excludes archived teams by default; includeArchived lists archived only', async () => {
    const activeTeam = await createSampleTeam(app, {
      teamName: 'Active Archive List Team',
    });
    const archivedTeam = await createSampleTeam(app, {
      teamName: 'Archived Archive List Team',
    });
    await setTeamArchived(app, archivedTeam._id, true);

    const defaultList = await listTeams(app);
    expect(defaultList.teams.map(t => t._id).sort()).toEqual(
      [activeTeam._id].sort()
    );

    const archivedOnly = await listTeams(app, adminToken, {
      includeArchived: true,
    });
    expect(archivedOnly.teams.map(t => t._id).sort()).toEqual(
      [archivedTeam._id].sort()
    );
  });

  it('PUT archive removes team from default list; GET by id still returns it; restore lists update', async () => {
    const team = await createSampleTeam(app, {
      teamName: 'Archive Restore Cycle Team',
    });
    const id = team._id;

    let defaultList = await listTeams(app);
    expect(defaultList.teams.map(t => t._id)).toContain(id);

    await setTeamArchived(app, id, true);
    const archivedDoc = await getATeam(app, id);
    expect(archivedDoc.archived).toBe(true);
    expect(archivedDoc.updatedAt).toBeGreaterThanOrEqual(team.updatedAt);

    defaultList = await listTeams(app);
    expect(defaultList.teams.map(t => t._id)).not.toContain(id);
    const archivedOnly = await listTeams(app, adminToken, {
      includeArchived: true,
    });
    expect(archivedOnly.teams.map(t => t._id)).toContain(id);

    await setTeamArchived(app, id, false);
    const restored = await getATeam(app, id);
    expect(restored.archived).toBe(false);
    expect(restored._id).toBe(id);

    defaultList = await listTeams(app);
    expect(defaultList.teams.map(t => t._id)).toContain(id);
    const archivedAfter = await listTeams(app, adminToken, {
      includeArchived: true,
    });
    expect(archivedAfter.teams.map(t => t._id)).not.toContain(id);
  });

  it('PUT archive {archive:false} rejects when team is not archived', async () => {
    const team = await createSampleTeam(app, {
      teamName: 'Not Archived Restore Team',
    });
    const response = await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${team._id}/archive`)
        .send({archive: false}),
      adminToken
    );
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Only archived teams can be restored.'
    );
  });

  it('TEAM_MANAGER cannot archive; TEAM_ADMIN can; local user cannot', async () => {
    const team = await createSampleTeam(app, {
      teamName: 'Permission Archive Team',
    });
    const signingKey = await keyService.getSigningKey();

    const [manager, managerErr] = await createUser({
      username: 'team-archive-manager',
      name: 'Team Archive Manager',
    });
    const [admin, adminErr] = await createUser({
      username: 'team-archive-admin',
      name: 'Team Archive Admin',
    });
    expect(managerErr).toBe('');
    expect(adminErr).toBe('');
    expect(manager).not.toBeNull();
    expect(admin).not.toBeNull();

    addTeamRole({
      user: manager!,
      teamId: team._id,
      role: Role.TEAM_MANAGER,
    });
    addTeamRole({
      user: admin!,
      teamId: team._id,
      role: Role.TEAM_ADMIN,
    });
    await saveCouchUser(manager!);
    await saveCouchUser(admin!);

    const managerToken = await generateJwtFromUser({
      user: await upgradeCouchUserToExpressUser({dbUser: manager!}),
      signingKey,
    });
    const adminUserToken = await generateJwtFromUser({
      user: await upgradeCouchUserToExpressUser({dbUser: admin!}),
      signingKey,
    });

    await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${team._id}/archive`)
        .send({archive: true}),
      managerToken
    ).expect(401);

    await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${team._id}/archive`)
        .send({archive: true}),
      localUserToken
    ).expect(401);

    await setTeamArchived(app, team._id, true, adminUserToken);
    await getATeam(app, team._id).then(doc => {
      expect(doc.archived).toBe(true);
    });

    await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${team._id}/archive`)
        .send({archive: false}),
      managerToken
    ).expect(401);

    await setTeamArchived(app, team._id, false, adminUserToken);
  });

  it('refuses team-as-container mutations while archived and allows them after restore', async () => {
    const team = await createSampleTeam(app, {
      teamName: 'Frozen Container Team',
    });
    await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${team._id}/members`).send({
        username: localUserName,
        role: Role.TEAM_MEMBER,
        action: 'ADD_ROLE',
      }),
      adminToken
    ).expect(200);

    await setTeamArchived(app, team._id, true);

    const updateRes = await requestAuthAndType(
      request(app)
        .put(`${TEAMS_API_BASE}/${team._id}`)
        .send({name: 'Should Not Persist'}),
      adminToken
    );
    expect(updateRes.status).toBe(400);
    await getATeam(app, team._id).then(doc => {
      expect(doc.name).toBe('Frozen Container Team');
    });

    const memberRes = await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${team._id}/members`).send({
        username: localUserName,
        role: Role.TEAM_MANAGER,
        action: 'ADD_ROLE',
      }),
      adminToken
    );
    expect(memberRes.status).toBe(400);

    const inviteRes = await requestAuthAndType(
      request(app).post(`/api/invites/team/${team._id}`).send({
        role: Role.TEAM_MEMBER,
        name: 'Archived team invite',
      }),
      adminToken
    );
    expect(inviteRes.status).toBe(400);

    await requestAuthAndType(
      request(app).get(`${TEAMS_API_BASE}/${team._id}`),
      adminToken
    ).expect(200);
    await requestAuthAndType(
      request(app).get(`${TEAMS_API_BASE}/${team._id}/members`),
      adminToken
    ).expect(200);
    await requestAuthAndType(
      request(app).get(`/api/invites/team/${team._id}`),
      adminToken
    ).expect(200);

    await setTeamArchived(app, team._id, false);

    await updateATeam(app, team._id, {name: 'Restored Container Team'}).then(
      updated => {
        expect(updated.name).toBe('Restored Container Team');
      }
    );
    await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${team._id}/members`).send({
        username: localUserName,
        role: Role.TEAM_MANAGER,
        action: 'ADD_ROLE',
      }),
      adminToken
    ).expect(200);
    await requestAuthAndType(
      request(app).post(`/api/invites/team/${team._id}`).send({
        role: Role.TEAM_MEMBER,
        name: 'Restored team invite',
      }),
      adminToken
    ).expect(200);

    const localUser = await getCouchUserFromEmailOrUserId(localUserName);
    expect(localUser).not.toBeNull();
    expect(
      userHasTeamRole({
        user: localUser!,
        teamId: team._id,
        role: Role.TEAM_MEMBER,
      })
    ).toBe(true);
  });

  it('refuses in-team creates and assign-to archived team; allows moving a child off', async () => {
    const archivedTeam = await createSampleTeam(app, {
      teamName: 'Archived Target Team',
    });
    const activeTeam = await createSampleTeam(app, {
      teamName: 'Active Target Team',
    });
    const notebook = await requestAuthAndType(
      request(app).post('/api/notebooks').send({
        name: 'Owned by archived team',
        description: testNotebookDescription,
        uiSpecification: EMPTY_UI_SPECIFICATION,
        teamId: archivedTeam._id,
      }),
      adminToken
    )
      .expect(200)
      .then(res => res.body as {notebook: string});

    const template = await requestAuthAndType(
      request(app)
        .post('/api/templates')
        .send({
          ...sampleCreateTemplatePayload('owned template'),
          teamId: archivedTeam._id,
        }),
      adminToken
    )
      .expect(200)
      .then(res => res.body as {_id: string});

    await setTeamArchived(app, archivedTeam._id, true);

    const createNotebookRes = await requestAuthAndType(
      request(app).post('/api/notebooks').send({
        name: 'Blocked notebook',
        description: testNotebookDescription,
        uiSpecification: EMPTY_UI_SPECIFICATION,
        teamId: archivedTeam._id,
      }),
      adminToken
    );
    expect(createNotebookRes.status).toBe(400);

    const createTemplateRes = await requestAuthAndType(
      request(app)
        .post('/api/templates')
        .send({
          ...sampleCreateTemplatePayload('blocked template'),
          teamId: archivedTeam._id,
        }),
      adminToken
    );
    expect(createTemplateRes.status).toBe(400);

    const assignNotebookRes = await requestAuthAndType(
      request(app).put(`/api/notebooks/${notebook.notebook}/team`).send({
        teamId: archivedTeam._id,
      }),
      adminToken
    );
    expect(assignNotebookRes.status).toBe(400);

    const assignTemplateRes = await requestAuthAndType(
      request(app).put(`/api/templates/${template._id}/team`).send({
        teamId: archivedTeam._id,
      }),
      adminToken
    );
    expect(assignTemplateRes.status).toBe(400);

    await requestAuthAndType(
      request(app).get(`/api/notebooks?teamId=${archivedTeam._id}`),
      adminToken
    ).expect(200);

    await requestAuthAndType(
      request(app).put(`/api/notebooks/${notebook.notebook}/team`).send({
        teamId: activeTeam._id,
      }),
      adminToken
    ).expect(200);

    await setTeamArchived(app, archivedTeam._id, false);
    await requestAuthAndType(
      request(app).post('/api/notebooks').send({
        name: 'Allowed after restore',
        description: testNotebookDescription,
        uiSpecification: EMPTY_UI_SPECIFICATION,
        teamId: archivedTeam._id,
      }),
      adminToken
    ).expect(200);
  });

  it('POST delete requires archive and empty children', async () => {
    const team = await createSampleTeam(app, {
      teamName: 'Delete Gate Team',
    });

    const liveDelete = await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${team._id}/delete`),
      adminToken
    );
    expect(liveDelete.status).toBe(400);
    expect(liveDelete.body.error.message).toMatch(/archived/i);
    await getATeam(app, team._id);

    await requestAuthAndType(
      request(app).post('/api/notebooks').send({
        name: 'Child of delete-gate team',
        description: testNotebookDescription,
        uiSpecification: EMPTY_UI_SPECIFICATION,
        teamId: team._id,
      }),
      adminToken
    ).expect(200);

    await setTeamArchived(app, team._id, true);
    const withChild = await requestAuthAndType(
      request(app).post(`${TEAMS_API_BASE}/${team._id}/delete`),
      adminToken
    );
    expect(withChild.status).toBe(400);
    await getATeam(app, team._id);

    const emptyTeam = await createSampleTeam(app, {
      teamName: 'Empty Delete Team',
    });
    await setTeamArchived(app, emptyTeam._id, true);
    await deleteATeam(app, emptyTeam._id);
    await requestAuthAndType(
      request(app).get(`${TEAMS_API_BASE}/${emptyTeam._id}`),
      adminToken
    ).expect(404);
    const defaultList = await listTeams(app);
    expect(defaultList.teams.map(t => t._id)).not.toContain(emptyTeam._id);
    const archivedOnly = await listTeams(app, adminToken, {
      includeArchived: true,
    });
    expect(archivedOnly.teams.map(t => t._id)).not.toContain(emptyTeam._id);
  });
});
