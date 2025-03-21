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
  PostUpdateUserInputSchema,
  removeGlobalRole,
  roleDetails,
  RoleScope,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {getUserFromEmailOrUsername, getUsers, saveUser} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';

import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

// update a user
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
  async ({body: {role, addrole: addRole}, params: {id}}, res) => {
    // Get the current user from DB
    const user = await getUserFromEmailOrUsername(id);
    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }

    // Check that the role is a global role
    if (!(roleDetails[role].scope === RoleScope.GLOBAL)) {
      throw new Exceptions.ValidationException(
        `The provided role ${role} is not a globally scoped role, and therefore cannot be added using this API method.`
      );
    }

    if (addRole) {
      addGlobalRole({role, user});
    } else {
      removeGlobalRole({role, user});
    }
    await saveUser(user);
    res.status(200).send();
  }
);

// GET current user
api.get(
  '/current',
  requireAuthenticationAPI,
  async (
    req: any,
    res: Response<{id: string; name: string; email: string}>
  ) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get the current user.'
      );
    }

    const {_id: id, name, emails} = req.user;
    return res.json({id, name, email: emails[0]});
  }
);

// GET all users
api.get(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.VIEW_USER_LIST}),
  async (req: any, res: Response<Express.User[]>) => {
    return res.json(await getUsers());
  }
);
