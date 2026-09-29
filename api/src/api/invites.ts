// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: invites.ts
 * Description:
 *   This module contains invite related API routes at /api/invites
 */

import {
  Action,
  ExistingInvitesDBDocument,
  GetInviteByIdResponse,
  GetProjectInvitesResponse,
  GetTeamInvitesResponse,
  IdInputSchema,
  isAuthorized,
  PostCreateResourceInviteInputSchema,
  PostCreateProjectInviteResponse,
  PostCreateTeamInviteResponse,
  PostCreateGlobalInviteResponse,
  projectInviteToAction,
  Resource,
  teamInviteToAction,
  RoleScope,
  GetGlobalInvitesResponse,
  PostCreateGlobalInviteInputSchema,
  PostCreateQuickShareInputSchema,
  PostCreateQuickShareResponse,
  PostUseInviteResponse,
  QUICK_SHARE_KIND,
} from '@faims3/data-model';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import validate from '../middleware/validate';
import {
  createGlobalInvite,
  createQuickShareInvite,
  createResourceInvite,
  deleteInvite,
  getGlobalInvites,
  getInvite,
  getInvitesForResource,
  getProjectInvites,
  getQuickSharesForProjectAndUser,
  isInviteValid,
} from '../couchdb/invites';
import {getProjectById} from '../couchdb/notebooks';
import {getCouchUserFromEmailOrUserId, saveCouchUser} from '../couchdb/users';
import {validateAndApplyInviteToUser} from '../auth/helpers';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from '../auth/keySigning/create';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import patch from '../utils/patchExpressAsync';
import {inviteAuditFromRequest, logInviteAudit} from '../logging';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

function userCanProjectInvite({
  user,
  projectId,
  action,
  role,
}: {
  user: NonNullable<Request['user']>;
  projectId: string;
  action: 'create' | 'delete';
  role: ExistingInvitesDBDocument['role'];
}): boolean {
  return userCanDo({
    user,
    action: projectInviteToAction({action, role}),
    resourceId: projectId,
  });
}

function logInviteSuccess(
  event: 'invite.create' | 'invite.revoke',
  req: Request,
  invite: ExistingInvitesDBDocument,
  userId: string
): void {
  logInviteAudit({
    event,
    outcome: 'success',
    source: 'api',
    inviteId: invite._id,
    userId,
    role: invite.role,
    inviteType: invite.inviteType,
    resourceType: invite.resourceType,
    resourceId: invite.resourceId,
    kind: invite.kind,
    ...inviteAuditFromRequest(req),
  });
}

/**
 * GET all project invites
 */
api.get(
  '/notebook/:projectId',
  requireAuthenticationAPI,
  validate({
    params: z.object({projectId: IdInputSchema}),
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

    // Project invites. Quick shares come from the quickShares view.
    const invites = (await getProjectInvites(projectId)).filter(
      invite => isInviteValid({invite}).isValid
    );

    res.json(invites);
  }
);

/**
 * GET all team invites
 */
api.get(
  '/team/:teamId',
  requireAuthenticationAPI,
  validate({
    params: z.object({teamId: IdInputSchema}),
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
  validate({
    params: z.object({projectId: IdInputSchema}),
    body: PostCreateResourceInviteInputSchema,
  }),
  async (req, res: Response<PostCreateProjectInviteResponse>) => {
    const {user, body, params} = req;
    const {projectId} = params;
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

    const invite = await createResourceInvite({
      resourceType: Resource.PROJECT,
      resourceId: projectId,
      role: body.role,
      name: body.name,
      createdBy: user.user_id,
      expiry: body.expiry,
      usesOriginal: body.uses,
    });

    logInviteSuccess('invite.create', req, invite, user.user_id);
    res.json(invite);
  }
);

/**
 * POST a Quick Share code for one survey. The code always lasts one hour.
 * Permission matches creating an invite for the same role. The document is
 * stored in the invites database and redeemed by the existing scan/use path.
 */
api.post(
  '/notebook/:projectId/quick-share',
  requireAuthenticationAPI,
  validate({
    params: z.object({projectId: IdInputSchema}),
    body: PostCreateQuickShareInputSchema,
  }),
  async (req, res: Response<PostCreateQuickShareResponse>) => {
    const {user, body, params} = req;
    const {projectId} = params;
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    if (
      !userCanProjectInvite({
        user,
        projectId,
        action: 'create',
        role: body.role,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to share this survey at that level'
      );
    }

    const project = await getProjectById(projectId);
    if (project.disableQuickShare === true) {
      throw new Exceptions.ForbiddenException(
        'Quick share is disabled for this survey'
      );
    }

    // One live Quick Share per person per survey. A second generate returns
    // that code only when this person can still create its role. A code above
    // their current access is not handed back, and no second code is minted
    // beside it. The view is already limited to this survey and creator.
    const live = (
      await getQuickSharesForProjectAndUser({
        projectId,
        userId: user.user_id,
      })
    )
      .filter(invite => isInviteValid({invite}).isValid)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (
      live.some(
        invite =>
          !userCanProjectInvite({
            user,
            projectId,
            action: 'create',
            role: invite.role,
          })
      )
    ) {
      // The invite id is the redemption secret, so it stays out of this body.
      // The creator revokes it with DELETE .../quick-share or DELETE by id.
      throw new Exceptions.ForbiddenException(
        'A quick share above your current access is still active. It must be revoked before a new code can be issued.'
      );
    }
    const [existing, ...older] = live;
    if (existing) {
      for (const extra of older) {
        if (
          !userCanProjectInvite({
            user,
            projectId,
            action: 'delete',
            role: extra.role,
          })
        ) {
          continue;
        }
        await deleteInvite({invite: extra});
        logInviteSuccess('invite.revoke', req, extra, user.user_id);
      }
      res.json({...existing, kind: QUICK_SHARE_KIND});
      return;
    }

    const invite = await createQuickShareInvite({
      resourceId: projectId,
      role: body.role,
      createdBy: user.user_id,
    });

    logInviteSuccess('invite.create', req, invite, user.user_id);
    res.json(invite);
  }
);

/**
 * POST create a team invite
 */
api.post(
  '/team/:teamId',
  requireAuthenticationAPI,
  validate({
    params: z.object({teamId: IdInputSchema}),
    body: PostCreateResourceInviteInputSchema,
  }),
  async (req, res: Response<PostCreateTeamInviteResponse>) => {
    const {user, body, params} = req;
    const {teamId} = params;
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

    const invite = await createResourceInvite({
      resourceType: Resource.TEAM,
      resourceId: teamId,
      role: body.role,
      name: body.name,
      createdBy: user.user_id,
      expiry: body.expiry,
      usesOriginal: body.uses,
    });

    logInviteSuccess('invite.create', req, invite, user.user_id);
    res.json(invite);
  }
);

/**
 * DELETE every live Quick Share the caller created for this survey.
 * Registered before `/:inviteId` so "quick-share" is not treated as an id.
 * The response does not include invite ids.
 */
api.delete(
  '/notebook/:projectId/quick-share',
  requireAuthenticationAPI,
  validate({
    params: z.object({projectId: IdInputSchema}),
  }),
  async (req, res) => {
    const {user, params} = req;
    const {projectId} = params;
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const own = (
      await getQuickSharesForProjectAndUser({
        projectId,
        userId: user.user_id,
      })
    ).filter(invite => isInviteValid({invite}).isValid);
    for (const invite of own) {
      await deleteInvite({invite});
      logInviteSuccess('invite.revoke', req, invite, user.user_id);
    }
    res.status(200).json({success: true});
  }
);

/**
 * DELETE a project invite
 */
api.delete(
  '/notebook/:projectId/:inviteId',
  requireAuthenticationAPI,
  validate({
    params: z.object({
      projectId: IdInputSchema,
      inviteId: IdInputSchema,
    }),
  }),
  async (req, res) => {
    const {user, params} = req;
    const {projectId, inviteId} = params;
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

    // The creator can always revoke their own quick share, including after a
    // downgrade. Any other invite still needs delete permission for its role.
    const ownsQuickShare =
      invite.kind === QUICK_SHARE_KIND && invite.createdBy === user.user_id;
    const actionNeeded = projectInviteToAction({
      action: 'delete',
      role: invite.role,
    });

    if (
      !ownsQuickShare &&
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
    if (invite.kind === QUICK_SHARE_KIND) {
      logInviteSuccess('invite.revoke', req, invite, user.user_id);
      // A missed lookup can leave a second redeemable code. Revoking the one
      // stored on the device also removes this person's other live codes.
      // The creator can clear those too. Anyone else still needs delete
      // permission for that role.
      const siblings = (
        await getQuickSharesForProjectAndUser({
          projectId,
          userId: invite.createdBy,
        })
      ).filter(
        other =>
          isInviteValid({invite: other}).isValid &&
          (ownsQuickShare ||
            userCanProjectInvite({
              user,
              projectId,
              action: 'delete',
              role: other.role,
            }))
      );
      for (const sibling of siblings) {
        await deleteInvite({invite: sibling});
        logInviteSuccess('invite.revoke', req, sibling, user.user_id);
      }
    }
    res.status(200).json({success: true});
  }
);

/**
 * DELETE a team invite
 */
api.delete(
  '/team/:teamId/:inviteId',
  requireAuthenticationAPI,
  validate({
    params: z.object({
      teamId: IdInputSchema,
      inviteId: IdInputSchema,
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
 * Global Invites
 */

/**
 * GET all global invites
 */
api.get(
  '/global',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.VIEW_GLOBAL_INVITES}),
  async ({user}, res: Response<GetGlobalInvitesResponse>) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // only return valid invites
    const invites = (await getGlobalInvites()).filter(
      invite => isInviteValid({invite}).isValid
    );

    res.json(invites);
  }
);

/**
 * POST create a global invite
 */
api.post(
  '/global',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.CREATE_GLOBAL_INVITE}),
  validate({
    body: PostCreateGlobalInviteInputSchema,
  }),
  async (req, res: Response<PostCreateGlobalInviteResponse>) => {
    const {user, body} = req;
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const invite = await createGlobalInvite({
      role: body.role,
      name: body.name,
      createdBy: user.user_id,
      expiry: body.expiry,
      usesOriginal: body.uses,
    });

    logInviteSuccess('invite.create', req, invite, user.user_id);
    res.json(invite);
  }
);

/**
 * DELETE a global invite
 */
api.delete(
  '/global/:inviteId',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.DELETE_GLOBAL_INVITE}),
  validate({
    params: z.object({
      inviteId: IdInputSchema,
    }),
  }),
  async ({user, params: {inviteId}}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const invite = await getInvite({inviteId});

    if (!invite) {
      throw new Exceptions.ItemNotFoundException('Invite not found');
    }

    // verify that this invite is a global invite
    if (invite.inviteType !== RoleScope.GLOBAL) {
      throw new Exceptions.ValidationException('Invite is not a global invite');
    }

    await deleteInvite({invite});
    res.status(200).end();
  }
);

/**
 * POST /api/invites/:inviteId/use
 * Consume an invite for the authenticated user and return a new access token
 * whose roles include the grant. Used when the app is already signed in, so
 * the user does not have to register or sign in again.
 */
api.post(
  '/:inviteId/use',
  requireAuthenticationAPI,
  validate({
    params: z.object({inviteId: IdInputSchema}),
  }),
  async (req, res: Response<PostUseInviteResponse>) => {
    const {user} = req;
    const {inviteId} = req.params;
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }
    if (user.impersonatingUserId) {
      throw new Exceptions.ForbiddenException(
        'Cannot redeem an invite while impersonating another user.'
      );
    }

    const dbUser = await getCouchUserFromEmailOrUserId(user.user_id);
    if (!dbUser) {
      throw new Exceptions.UnauthorizedException();
    }

    let updatedUser;
    let invite;
    try {
      ({user: updatedUser, invite} = await validateAndApplyInviteToUser({
        inviteCode: inviteId,
        dbUser,
        req,
        action: 'login',
      }));
    } catch (e) {
      throw new Exceptions.InvalidRequestException(
        e instanceof Error
          ? e.message
          : 'Invite is not valid. It may be expired or already used.'
      );
    }
    await saveCouchUser(updatedUser);

    const expressUser = await upgradeCouchUserToExpressUser({
      dbUser: updatedUser,
    });
    // Keep the replacement access token's lifetime equal to the token that
    // authorised this request. A fresh `accessTokenExpiryMinutes` window
    // would let repeated redemptions chain into a longer session.
    if (req.accessTokenExpiresAt === undefined) {
      throw new Exceptions.UnauthorizedException(
        'Access token is missing an expiry and cannot be reissued.'
      );
    }
    const {token} = await generateUserToken(expressUser, false, {
      expiresAtSeconds: req.accessTokenExpiresAt,
    });

    res.json({
      success: true,
      inviteType: invite.inviteType,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      role: invite.role,
      accessToken: token,
    });
  }
);

/**
 * GET a specific invite by ID
 *  - include this route last so that it doesn't clobber /global above
 */
api.get(
  '/:inviteId',
  validate({
    params: z.object({inviteId: IdInputSchema}),
  }),
  async (req, res: Response<GetInviteByIdResponse>) => {
    const inviteId = req.params.inviteId;
    const requestMeta = inviteAuditFromRequest(req);
    const invite = await getInvite({inviteId});

    if (!invite) {
      logInviteAudit({
        event: 'invite.lookup',
        outcome: 'not_found',
        source: 'api',
        inviteId,
        ...requestMeta,
      });
      throw new Exceptions.ItemNotFoundException('Invite not found');
    }

    // Check if invite is valid
    const validityCheck = isInviteValid({invite});

    logInviteAudit({
      event: 'invite.lookup',
      outcome: validityCheck.isValid ? 'valid' : 'invalid',
      source: 'api',
      inviteId: invite._id,
      reason: validityCheck.reason,
      role: invite.role,
      inviteType: invite.inviteType,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      kind: invite.kind,
      ...requestMeta,
    });

    // Return basic info about the invite (without sensitive data)
    res.json({
      id: invite._id,
      inviteType: invite.inviteType,
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
