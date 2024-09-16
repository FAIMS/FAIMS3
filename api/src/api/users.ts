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

import express from 'express';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  removeOtherRoleFromUser,
  saveUser,
  userIsClusterAdmin,
} from '../couchdb/users';
import {processRequest} from 'zod-express-middleware';
import {z} from 'zod';
import {PostUpdateUserInputSchema} from '@faims3/data-model';

// See https://github.com/davidbanham/express-async-errors - this patches
// express to handle async errors without hanging or needing an explicit try
// catch block
require('express-async-errors');

export const api = express.Router();

// update a user
api.post(
  '/:id/admin',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({id: z.string()}),
    body: PostUpdateUserInputSchema,
  }),
  async (req, res, next) => {
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
