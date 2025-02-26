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

import express, {Response} from 'express';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  getUsers,
  removeOtherRoleFromUser,
  removeUser,
  saveUser,
  userIsClusterAdmin,
} from '../couchdb/users';
import {processRequest} from 'zod-express-middleware';
import {z} from 'zod';
import {
  CLUSTER_ADMIN_GROUP_NAME,
  PostUpdateUserInputSchema,
} from '@faims3/data-model';

import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

// update a user
api.post(
  '/:id/admin',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({id: z.string()}),
    body: PostUpdateUserInputSchema,
  }),
  async (req, res) => {
    // Cluster admins only
    if (!userIsClusterAdmin(req.user)) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to update user details.'
      );
    }

    // Get the current user from DB
    const user = await getUserFromEmailOrUsername(req.params.id);
    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );
    }
    if (req.body.addrole) {
      addOtherRoleToUser(user, req.body.role);
    } else {
      removeOtherRoleFromUser(user, req.body.role);
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
    res: Response<{
      id: string;
      name: string;
      email: string;
      cluster_admin: boolean;
    }>
  ) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get the current user.'
      );
    }

    const {_id: id, name, emails} = req.user;

    return res.json({
      id,
      name,
      email: emails[0],
      cluster_admin: req.user.other_roles.includes(CLUSTER_ADMIN_GROUP_NAME),
    });
  }
);

// GET all users
api.get(
  '/',
  requireAuthenticationAPI,
  async (req: any, res: Response<Express.User[]>) => {
    if (!req.user || !userIsClusterAdmin(req.user)) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get users.'
      );
    }

    return res.json(await getUsers());
  }
);

// REMOVE a user
api.delete(
  '/:id',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async ({params: {id}, user}, res) => {
    if (!userIsClusterAdmin(user))
      throw new Exceptions.UnauthorizedException(
        'Only cluster admins can remove users.'
      );

    if (!id) throw new Exceptions.ValidationException('User ID not specified');

    const userToRemove = await getUserFromEmailOrUsername(id);

    if (!userToRemove)
      throw new Exceptions.ItemNotFoundException(
        'Username cannot be found in user database.'
      );

    if (userIsClusterAdmin(userToRemove))
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to remove cluster admins.'
      );

    removeUser(userToRemove);

    res.status(200).send();
  }
);
