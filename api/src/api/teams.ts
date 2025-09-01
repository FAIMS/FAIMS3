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
 * Filename: teams.ts
 * Description:
 *   This module contains the teams CRUD API routes at /api/teams
 */

import {
  Action,
  addTeamRole,
  GetListTeamsResponse,
  GetTeamByIdResponse,
  getTeamMembershipAction,
  GetTeamMembersResponse,
  PostCreateTeamInputSchema,
  PostCreateTeamResponse,
  PutUpdateTeamInputSchema,
  PutUpdateTeamResponse,
  removeTeamRole,
  Resource,
  Role,
  roleDetails,
  TeamMembershipInputSchema,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  createTeamDocument,
  deleteTeam,
  getAllTeams,
  getTeamById,
  updateTeam,
} from '../couchdb/teams';
import {
  getCouchUserFromEmailOrUserId,
  getUsersForTeam,
  saveCouchUser,
  saveExpressUser,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

/**
 * GET list teams
 * Gets a list of all teams from the teams DB.
 */
api.get(
  '/',
  requireAuthenticationAPI,
  async (req, res: Response<GetListTeamsResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const allTeams = await getAllTeams();

    // filter to only visible teams
    const visible = allTeams.filter(t =>
      userCanDo({
        action: Action.VIEW_TEAM_DETAILS,
        user: req.user!,
        resourceId: t._id,
      })
    );
    res.json({teams: visible});
  }
);

/**
 * GET team by id
 * Gets a specific team by ID from the teams DB.
 */
api.get(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_TEAM_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<GetTeamByIdResponse>) => {
    const team = await getTeamById(req.params.id);
    res.json(team);
  }
);

/**
 * POST create new team
 *
 * Creates a new team. The payload is validated by Zod before reaching this
 * function. Expects a document as the response JSON.
 */
api.post(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.CREATE_TEAM}),
  processRequest({
    body: PostCreateTeamInputSchema,
  }),
  async (req, res: Response<PostCreateTeamResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    // Extract user ID from the authenticated request
    const userId = req.user.user_id;

    // Prepare the team document with timestamps and creator information
    const teamData = {
      ...req.body,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create the new team and return it
    const newTeam = await createTeamDocument(teamData);

    // Now add the user as an admin of the team
    addTeamRole({role: Role.TEAM_ADMIN, teamId: newTeam._id, user: req.user});
    await saveExpressUser(req.user);

    res.json(newTeam);
  }
);

/**
 * PUT update existing team
 * Updates an existing team. The payload is validated by Zod before reaching this function.
 * Expects a document as the response JSON.
 */
api.put(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.UPDATE_TEAM_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
    body: PutUpdateTeamInputSchema,
  }),
  async (req, res: Response<PutUpdateTeamResponse>) => {
    // Pull out team ID
    const teamId = req.params.id;

    // Update the team and respond with the updated document
    const updatedTeam = await updateTeam(teamId, req.body);
    res.json(updatedTeam);
  }
);

/**
 * POST delete existing team
 * Deletes an existing team.
 */
api.post(
  '/:id/delete',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_TEAM,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res) => {
    // Pull out team ID
    const teamId = req.params.id;

    // Delete the team
    await deleteTeam(teamId);

    // Indicate successful deletion
    res.sendStatus(200);
  }
);

/**
 * GET team members
 * Gets a list of all members for a specific team
 */
api.get(
  '/:id/members',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_TEAM_MEMBERS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<GetTeamMembersResponse>) => {
    const teamId = req.params.id;

    // First verify team exists
    await getTeamById(teamId);

    // Get all users who have roles for this team
    const teamUsers = await getUsersForTeam({teamId});

    // Define available team roles
    const availableRoles = Object.entries(roleDetails)
      .filter(([, details]) => details.resource === Resource.TEAM)
      .map(([role, details]) => ({
        role: role as Role,
        name: details.name,
        description: details.description,
      }));

    // Format member info
    const members = teamUsers.map(user => {
      return {
        username: user.user_id,
        name: user.name,
        roles: availableRoles.map(roleInfo => ({
          role: roleInfo.role as Role,
          hasRole: user.teamRoles.some(
            r => r.resourceId === teamId && r.role === roleInfo.role
          ),
        })),
      };
    });

    res.json({members, availableRoles});
  }
);

/**
 * POST update team membership
 * Adds or removes a user from a team with a specific role
 */
api.post(
  '/:id/members',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({id: z.string()}),
    body: TeamMembershipInputSchema,
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    const teamId = req.params.id;
    const {username, role, action} = req.body;

    // First verify team exists
    await getTeamById(teamId);

    // Get user to modify
    const targetUser = await getCouchUserFromEmailOrUserId(username);
    if (!targetUser) {
      throw new Exceptions.ItemNotFoundException(
        'User not found. Please check the username or email address.'
      );
    }

    // Cannot modify your own roles as protection
    if (targetUser.user_id === req.user.user_id) {
      throw new Exceptions.ForbiddenException(
        'You cannot change your own role within a team.'
      );
    }

    // Check appropriate permission based on role and operation
    let rolesOfTargetUser: Role[] = [];
    const requiredActions: Action[] = [];

    if (action === 'REMOVE_USER') {
      rolesOfTargetUser = targetUser.teamRoles
        .filter(r => r.resourceId === teamId)
        .map(r => r.role);
    } else if (action === 'ADD_ROLE' || action === 'REMOVE_ROLE') {
      rolesOfTargetUser = [role!];
    }

    for (const roleToCheck of rolesOfTargetUser) {
      requiredActions.push(
        getTeamMembershipAction(
          roleToCheck,
          // add remove based on action
          action === 'REMOVE_USER' || action === 'REMOVE_ROLE' ? false : true
        )
      );
    }
    console.log('Required actions:', requiredActions);

    for (const actionToCheck of requiredActions) {
      if (
        !userCanDo({user: req.user, action: actionToCheck, resourceId: teamId})
      ) {
        throw new Exceptions.UnauthorizedException(
          'You do not have permission to manage team members for this role.'
        );
      }
    }

    // Apply the role change
    if (action === 'ADD_ROLE') {
      addTeamRole({
        user: targetUser,
        teamId,
        // this is defined - see zod model
        role: role!,
      });
    } else if (action === 'REMOVE_ROLE') {
      removeTeamRole({
        user: targetUser,
        teamId,
        // this is defined - see zod model
        role: role!,
      });
    } else if (action === 'REMOVE_USER') {
      for (const hasRole of rolesOfTargetUser) {
        removeTeamRole({
          user: targetUser,
          teamId,
          role: hasRole,
        });
      }
    }

    // Save the user changes
    await saveCouchUser(targetUser);

    res.sendStatus(200);
  }
);
