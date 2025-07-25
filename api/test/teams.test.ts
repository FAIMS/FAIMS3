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
import {expect} from 'chai';
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
const createSampleTeam = async (
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
      expect(teamList.teams.length).to.equal(1);

      // Get the first entry and check ID matches
      const entry = teamList.teams[0];
      expect(entry._id).to.equal(teamId1);
      expect(entry.name).to.equal('First Test Team');
      expect(entry.description).to.equal('First test team description');

      // Check timestamps and creator fields exist
      expect(entry).to.have.property('createdAt');
      expect(entry).to.have.property('updatedAt');
      expect(entry).to.have.property('createdBy');
    });

    // Get the specific team
    await getATeam(app, teamId1).then(team => {
      // Check properties match
      expect(team._id).to.equal(teamId1);
      expect(team.name).to.equal('First Test Team');
      expect(team.description).to.equal('First test team description');

      // Check timestamps and creator fields exist
      expect(team).to.have.property('createdAt');
      expect(team).to.have.property('updatedAt');
      expect(team).to.have.property('createdBy');
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
      expect(teamList.teams.length).to.equal(2);

      // Find both teams in the list
      const firstTeam = teamList.teams.find(t => t._id === teamId1);
      const secondTeam = teamList.teams.find(t => t._id === teamId2);

      expect(firstTeam).to.not.be.undefined;
      expect(secondTeam).to.not.be.undefined;

      // Check properties of second team
      if (secondTeam) {
        expect(secondTeam.name).to.equal('Second Test Team');
        expect(secondTeam.description).to.equal('Second test team description');
      }
    });

    // Get the second team specifically
    await getATeam(app, teamId2).then(team => {
      expect(team._id).to.equal(teamId2);
      expect(team.name).to.equal('Second Test Team');
      expect(team.description).to.equal('Second test team description');
    });

    // Delete the second team
    await deleteATeam(app, teamId2);

    // List again and check there's only one team
    await listTeams(app).then(teamList => {
      expect(teamList.teams.length).to.equal(1);
      expect(teamList.teams[0]._id).to.equal(teamId1);
    });

    // Delete the first team
    await deleteATeam(app, teamId1);

    // List again and check there are no teams
    await listTeams(app).then(teamList => {
      expect(teamList.teams.length).to.equal(0);
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
      expect(updatedTeam.name).to.equal('Updated Team Name');
      // Description should remain unchanged
      expect(updatedTeam.description).to.equal('Original description');
      // updatedAt should be changed
      expect(updatedTeam.updatedAt).to.be.greaterThan(team.updatedAt);
    });

    // Get the team and verify updates
    await getATeam(app, team._id).then(fetchedTeam => {
      expect(fetchedTeam.name).to.equal('Updated Team Name');
      expect(fetchedTeam.description).to.equal('Original description');
    });

    // Update just the description
    await updateATeam(app, team._id, {
      description: 'Updated description',
    }).then(updatedTeam => {
      expect(updatedTeam.name).to.equal('Updated Team Name');
      expect(updatedTeam.description).to.equal('Updated description');
    });

    // Update both name and description
    await updateATeam(app, team._id, {
      name: 'Final Team Name',
      description: 'Final description',
    }).then(updatedTeam => {
      expect(updatedTeam.name).to.equal('Final Team Name');
      expect(updatedTeam.description).to.equal('Final description');
    });
  });

  // Edge conditions for teams
  //=========================

  it('empty team list', async () => {
    // Make list request on empty database
    await listTeams(app).then(teamList => {
      // Check that the list exists and has empty length
      expect(teamList.teams.length).to.equal(0);
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
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Check for expected error message
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
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
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Check for expected error message
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
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
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Check for expected error message
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
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
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.at.least(1);

        const err = res.body[0];
        expect(err).to.have.property('type');
        expect(err.type).to.equal('Body');
        // Error should mention name field
        expect(JSON.stringify(err.errors)).to.include('name');
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
