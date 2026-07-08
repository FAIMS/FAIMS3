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
 * Description:
 *   This module contains user based API routes at /api/users
 */

import {
  Action,
  addGlobalRole,
  GetCurrentUserResponse,
  GetListAllUsersResponse,
  GetListAllUsersResponseSchema,
  isPeopleUserAccountDisabled,
  PostImpersonateUserResponse,
  PostUpdateUserInputSchema,
  removeGlobalRole,
  Role,
  roleDetails,
  RoleScope,
  userHasGlobalRole,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  generateUserToken,
  upgradeCouchUserToExpressUser,
} from '../auth/keySigning/create';
import {
  IMPERSONATION_SESSION_EXPIRY_MINUTES,
  RUNNING_UNDER_TEST,
} from '../buildconfig';
import {
  filterPeopleUsersForList,
  getCouchUserFromEmailOrUserId,
  getUsers,
  removeUser,
  saveCouchUser,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import {nowIso} from '../time';

import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

// update a users roles
api.post(
  '/:id/admin',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.ADD_OR_REMOVE_GLOBAL_USER_ROLE,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
    body: PostUpdateUserInputSchema,
  }),
  async ({body: {role, addrole: addRole}, user, params: {id}}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to update user details.'
      );
    }

    // Get the current user from DB
    const foundUser = await getCouchUserFromEmailOrUserId(id);
    if (!foundUser) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }

    if (isPeopleUserAccountDisabled(foundUser)) {
      throw new Exceptions.ForbiddenException(
        'This user account is disabled. Re-enable it before changing global roles.'
      );
    }

    // Check that the role is a global role
    if (!(roleDetails[role].scope === RoleScope.GLOBAL)) {
      throw new Exceptions.ValidationException(
        `The provided role ${role} is not a globally scoped role, and therefore cannot be added using this API method.`
      );
    }

    if (id === user.user_id) {
      throw new Exceptions.ForbiddenException(
        'You are not allowed to update your own roles.'
      );
    }

    if (addRole) {
      addGlobalRole({role, user: foundUser});
    } else {
      removeGlobalRole({role, user: foundUser});
    }

    await saveCouchUser(foundUser);
    res.status(200).send();
  }
);

// GET current user
api.get(
  '/current',
  requireAuthenticationAPI,
  async (req, res: Response<GetCurrentUserResponse>) => {
    try {
      if (!req.user) {
        throw new Exceptions.UnauthorizedException('Not authenticated.');
      }

      const {_id: id, name, emails, user_id} = req.user;

      return res.json({
        id,
        name,
        // email should always be defined but for admin is not
        email: emails[0]?.email ?? user_id,
        isVerified: emails[0]?.verified ?? false,
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
);

// GET all users
api.get(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.VIEW_USER_LIST}),
  processRequest({
    query: z.object({
      includeArchived: z.enum(['true', 'false']).optional(),
    }),
  }),
  async (req, res: Response<GetListAllUsersResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('You are not logged in.');
    }

    const includeArchived = req.query.includeArchived === 'true';
    const allUsers = filterPeopleUsersForList(
      await getUsers(),
      includeArchived
    );

    // We explicitly parse here so as to make sure we strip out anything we don't want!
    try {
      return res.json(GetListAllUsersResponseSchema.parse(allUsers));
    } catch (e) {
      throw new Exceptions.InternalSystemError(
        `User data from database could not be parsed into the correct model. Error: ${e}.`
      );
    }
  }
);

api.post(
  '/:id/disable',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DISABLE_USER_ACCOUNT,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async ({params: {id}, user}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const target = await getCouchUserFromEmailOrUserId(id);
    if (!target) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }

    if (target.user_id === user.user_id) {
      throw new Exceptions.ForbiddenException(
        'You are not allowed to disable your own account.'
      );
    }

    if (userHasGlobalRole({role: Role.GENERAL_ADMIN, user: target})) {
      throw new Exceptions.ForbiddenException(
        'You are not allowed to disable cluster admins.'
      );
    }

    target.disabled = true;
    await saveCouchUser(target);
    res.status(200).send();
  }
);

api.post(
  '/:id/enable',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.ENABLE_USER_ACCOUNT,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async ({params: {id}}, res) => {
    const target = await getCouchUserFromEmailOrUserId(id);
    if (!target) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }

    target.disabled = false;
    await saveCouchUser(target);
    res.status(200).send();
  }
);

/**
 * Impersonate a user - trade a target user id for a token pair that
 * authenticates as that user. Restricted to system operations administrators
 * (Action.IMPERSONATE_USER).
 *
 * The returned tokens are a normal access + refresh token pair for the target
 * user, so all downstream authorization treats the caller as the target. The
 * access token is tagged with the acting admin's user id for auditing, and the
 * refresh token is given a short lifetime so the impersonation session cannot
 * linger.
 */
api.post(
  '/:id/impersonate',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.IMPERSONATE_USER,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async ({params: {id}, user}, res: Response<PostImpersonateUserResponse>) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    const target = await getCouchUserFromEmailOrUserId(id);
    if (!target) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }

    if (target.user_id === user.user_id) {
      throw new Exceptions.ForbiddenException(
        'You cannot impersonate yourself.'
      );
    }

    if (isPeopleUserAccountDisabled(target)) {
      throw new Exceptions.ForbiddenException(
        'You cannot impersonate a disabled account.'
      );
    }

    if (userHasGlobalRole({role: Role.GENERAL_ADMIN, user: target})) {
      throw new Exceptions.ForbiddenException(
        'You are not allowed to impersonate cluster admins.'
      );
    }

    // Build a token as the target user, tagged with the acting admin id and
    // given a short-lived refresh token.
    const expressTarget = await upgradeCouchUserToExpressUser({dbUser: target});
    const {token, refreshToken} = await generateUserToken(expressTarget, true, {
      impersonatingUserId: user.user_id,
      refreshExpiryMs: IMPERSONATION_SESSION_EXPIRY_MINUTES * 60 * 1000,
    });

    if (!RUNNING_UNDER_TEST) {
      console.log(
        `[Impersonation] ${user.user_id} started impersonating ${target.user_id} at ${nowIso()}`
      );
    }

    res.json({accessToken: token, refreshToken: refreshToken!});
  }
);

// REMOVE a user
api.delete(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_USER,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async ({params: {id}}, res) => {
    if (!id) throw new Exceptions.ValidationException('User ID not specified');

    const userToRemove = await getCouchUserFromEmailOrUserId(id);

    if (!userToRemove)
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );

    if (userHasGlobalRole({role: Role.GENERAL_ADMIN, user: userToRemove}))
      throw new Exceptions.ForbiddenException(
        'You are not allowed to remove cluster admins.'
      );

    try {
      removeUser(userToRemove);
    } catch (e) {
      throw new Exceptions.InternalSystemError('Error removing user');
    }
    res.status(200).send();
  }
);
