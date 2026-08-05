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
 * Filename: teams.api.test.ts
 * Description:
 *   Tests for the Teams API
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
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
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {Express} from 'express';
import request from 'supertest';
import {app} from '../src/expressSetup';
import {
  adminToken,
  beforeApiTests,
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
  token: string = adminToken
): Promise<GetListTeamsResponse> => {
  return await requestAuthAndType(request(app).get(`${TEAMS_API_BASE}`), token)
    .expect(200)
    .then(res => {
      // Parse the response body against model
      return GetListTeamsResponseSchema.parse(res.body);
    });
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

    // Delete the second team
    await deleteATeam(app, teamId2);

    // List again and check there's only one team
    await listTeams(app).then(teamList => {
      expect(teamList.teams.length).toBe(1);
      expect(teamList.teams[0]._id).toBe(teamId1);
    });

    // Delete the first team
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
});
