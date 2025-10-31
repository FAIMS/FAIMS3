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
 * Filename: invites.ts
 * Description:
 *   This module contains invite related API routes at /api/invites
 */

import {
  Action,
  GetInviteByIdResponse,
  GetProjectInvitesResponse,
  GetTeamInvitesResponse,
  isAuthorized,
  PostCreateInviteInputSchema,
  PostCreateProjectInviteResponse,
  PostCreateTeamInviteResponse,
  projectInviteToAction,
  Resource,
  teamInviteToAction,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  createInvite,
  deleteInvite,
  getInvite,
  getInvitesForResource,
  isInviteValid,
} from '../couchdb/invites';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

/**
 * GET all project invites
 */
api.get(
  '/notebook/:projectId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({projectId: z.string()}),
  }),
  async (
    {user, params: {projectId}},
    res: Response<GetProjectInvitesResponse>
  ) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Check if user has permission to view project invites
    if (
      !isAuthorized({
        action: Action.VIEW_PROJECT_INVITES,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: projectId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to view invites for this project'
      );
    }

    // Project invites
    const invites = (
      await getInvitesForResource({
        resourceType: Resource.PROJECT,
        resourceId: projectId,
      })
    ).filter(invite => isInviteValid({invite}).isValid);

    res.json(invites);
  }
);

/**
 * GET all team invites
 */
api.get(
  '/team/:teamId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({teamId: z.string()}),
  }),
  async ({user, params: {teamId}}, res: Response<GetTeamInvitesResponse>) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Check if user has permission to view team invites
    if (
      !isAuthorized({
        action: Action.VIEW_TEAM_INVITES,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: teamId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to view invites for this team'
      );
    }

    // only return valid invites
    const invites = (
      await getInvitesForResource({
        resourceType: Resource.TEAM,
        resourceId: teamId,
      })
    ).filter(invite => isInviteValid({invite}).isValid);

    res.json(invites);
  }
);

/**
 * POST create a project invite
 */
api.post(
  '/notebook/:projectId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({projectId: z.string()}),
    body: PostCreateInviteInputSchema,
  }),
  async (
    {user, body, params: {projectId}},
    res: Response<PostCreateProjectInviteResponse>
  ) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Get the action needed
    const actionNeeded = projectInviteToAction({
      action: 'create',
      role: body.role,
    });

    if (
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: projectId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to create this invite'
      );
    }

    const invite = await createInvite({
      resourceType: Resource.PROJECT,
      resourceId: projectId,
      role: body.role,
      name: body.name,
      createdBy: user.user_id,
      expiry: body.expiry,
      usesOriginal: body.uses,
    });

    res.json(invite);
  }
);

/**
 * POST create a team invite
 */
api.post(
  '/team/:teamId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({teamId: z.string()}),
    body: PostCreateInviteInputSchema,
  }),
  async (
    {user, body, params: {teamId}},
    res: Response<PostCreateTeamInviteResponse>
  ) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Get the action needed
    const actionNeeded = teamInviteToAction({
      action: 'create',
      role: body.role,
    });

    if (
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: teamId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to create this invite'
      );
    }

    const invite = await createInvite({
      resourceType: Resource.TEAM,
      resourceId: teamId,
      role: body.role,
      name: body.name,
      createdBy: user.user_id,
      expiry: body.expiry,
      usesOriginal: body.uses,
    });

    res.json(invite);
  }
);

/**
 * DELETE a project invite
 */
api.delete(
  '/notebook/:projectId/:inviteId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({
      projectId: z.string(),
      inviteId: z.string(),
    }),
  }),
  async ({user, params: {projectId, inviteId}}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const invite = await getInvite({inviteId});

    if (!invite) {
      throw new Exceptions.ItemNotFoundException('Invite not found');
    }

    // Verify this invite belongs to the specified project
    if (
      invite.resourceType !== Resource.PROJECT ||
      invite.resourceId !== projectId
    ) {
      throw new Exceptions.ValidationException(
        'Invite does not belong to this project'
      );
    }

    // Get the action needed
    const actionNeeded = projectInviteToAction({
      action: 'delete',
      role: invite.role,
    });

    if (
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: projectId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to delete this invite'
      );
    }

    await deleteInvite({invite});
    res.status(200).end();
  }
);

/**
 * DELETE a team invite
 */
api.delete(
  '/team/:teamId/:inviteId',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({
      teamId: z.string(),
      inviteId: z.string(),
    }),
  }),
  async ({user, params: {teamId, inviteId}}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const invite = await getInvite({inviteId});

    if (!invite) {
      throw new Exceptions.ItemNotFoundException('Invite not found');
    }

    // Verify this invite belongs to the specified team
    if (invite.resourceType !== Resource.TEAM || invite.resourceId !== teamId) {
      throw new Exceptions.ValidationException(
        'Invite does not belong to this team'
      );
    }

    // Get the action needed
    const actionNeeded = teamInviteToAction({
      action: 'delete',
      role: invite.role,
    });

    if (
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: teamId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to delete this invite'
      );
    }

    await deleteInvite({invite});
    res.status(200).end();
  }
);

/**
 * GET a specific invite by ID
 */
api.get(
  '/:inviteId',
  processRequest({
    params: z.object({inviteId: z.string()}),
  }),
  async (req, res: Response<GetInviteByIdResponse>) => {
    const invite = await getInvite({inviteId: req.params.inviteId});

    if (!invite) {
      throw new Exceptions.ItemNotFoundException('Invite not found');
    }

    // Check if invite is valid
    const validityCheck = isInviteValid({invite});

    // Return basic info about the invite (without sensitive data)
    res.json({
      id: invite._id,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      name: invite.name,
      role: invite.role,
      createdAt: invite.createdAt,
      expiry: invite.expiry,
      isValid: validityCheck.isValid,
      invalidReason: validityCheck.reason,
      usesRemaining: invite.usesOriginal
        ? Math.max(0, invite.usesOriginal - invite.usesConsumed)
        : undefined,
    });
  }
);
