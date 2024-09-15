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
import {requireAuthenticationAPI} from '../middleware';
import {
  addOtherRoleToUser,
  getUserFromEmailOrUsername,
  removeOtherRoleFromUser,
  saveUser,
  userIsClusterAdmin,
} from '../couchdb/users';
import {
  CLUSTER_ADMIN_GROUP_NAME,
  NOTEBOOK_CREATOR_GROUP_NAME,
} from '../buildconfig';

export const api = express.Router();

// update a user
api.post('/:id/admin', requireAuthenticationAPI, async (req, res) => {
  if (userIsClusterAdmin(req.user)) {
    let error = '';
    const username = req.params.id;
    const addrole = req.body.addrole;
    const role = req.body.role;

    console.log('addrole', addrole, 'role', role, NOTEBOOK_CREATOR_GROUP_NAME);
    const user = await getUserFromEmailOrUsername(username);
    if (user) {
      if (
        role === CLUSTER_ADMIN_GROUP_NAME ||
        role === NOTEBOOK_CREATOR_GROUP_NAME
      ) {
        if (addrole) {
          await addOtherRoleToUser(user, role);
        } else {
          await removeOtherRoleFromUser(user, role);
        }
        await saveUser(user);
        res.json({status: 'success'});
        return;
      } else {
        error = 'Unknown role';
      }
    } else {
      error = 'Unknown user ' + username;
    }

    // user or project not found or bad role
    res.status(404).json({status: 'error', error}).end();
  } else {
    res
      .status(401)
      .json({
        error:
          'you do not have permission to modify user permissions for this server',
      })
      .end();
  }
});
