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
 *   This module contains utility routes at /api
 */

import {
  ListingsObject,
  PostRefreshTokenInputSchema,
  PostRefreshTokenResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import multer from 'multer';
import {
  CONDUCTOR_DESCRIPTION,
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  CONDUCTOR_SHORT_CODE_PREFIX,
  DEVELOPER_MODE,
} from '../buildconfig';
import {initialiseDatabases} from '../couchdb';
import {restoreFromBackup} from '../couchdb/backupRestore';
import {getProjects} from '../couchdb/notebooks';
import {userIsClusterAdmin} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {optionalAuthenticationJWT, requireAuthenticationAPI} from '../middleware';
import {slugify} from '../utils';

// TODO: configure this directory
const upload = multer({dest: '/tmp/'});

import patch from '../utils/patchExpressAsync';
import {processRequest} from 'zod-express-middleware';
import {validateRefreshToken} from '../couchdb/refreshTokens';
import {generateUserToken} from '../authkeys/create';

// This must occur before express api is used
patch();

export const api = express.Router();

api.get('/hello/', requireAuthenticationAPI, (_req: any, res: any) => {
  res.send({message: 'hello from the api!'});
});

/**
 * POST to /api/initialise does initialisation on the databases
 * - this does not have any auth requirement because it should be used
 *   to set up the users database and create the admin user
 *   if databases exist, this is a no-op
 */
api.post('/initialise/', async (req, res) => {
  initialiseDatabases();
  res.json({success: true});
});

/**
 * Handle info requests, basic identifying information for this server
 */
api.get('/info', async (req, res) => {
  res.json({
    id: slugify(CONDUCTOR_INSTANCE_NAME),
    name: CONDUCTOR_INSTANCE_NAME,
    conductor_url: CONDUCTOR_PUBLIC_URL,
    description: CONDUCTOR_DESCRIPTION,
    prefix: CONDUCTOR_SHORT_CODE_PREFIX,
  } as ListingsObject);
});

api.get('/directory/', requireAuthenticationAPI, async (req, res) => {
  // get the directory of notebooks on this server
  if (!req.user) {
    throw new Exceptions.UnauthorizedException();
  }
  const projects = await getProjects(req.user);
  res.json(projects);
});

/**
 * Refresh - get a new JWT using a refresh token.
 *
 * Anyone can use this route, since your access token may have expired
 */
api.post(
  '/auth/refresh',
  optionalAuthenticationJWT,
  processRequest({body: PostRefreshTokenInputSchema}),
  async (req, res: Response<PostRefreshTokenResponse>) => {
    // If the user is logged in - then record the user ID as an additional
    // security measure - don't allow a user who currently has a JWT of user
    // A, to use a refresh token for user B, but if the user is not logged in
    // at all (e.g. JWT expired) we still want to ensure they can generate a
    // fresh JWT
    const userId: string | undefined = req.user?._id;

    // validate the token
    const {valid, validationError, user} = await validateRefreshToken(
      req.body.refreshToken,
      userId
    );

    // If the refresh token is not valid, let user know
    if (!valid) {
      throw new Exceptions.InvalidRequestException(
        `Validation of refresh token failed. Validation error: ${validationError}.`
      );
    }

    // We know the refresh is valid, generate a JWT (no refresh) for this
    // existing user.
    const {token} = await generateUserToken(user!, false);

    // return the token
    res.json({token});
  }
);

if (DEVELOPER_MODE) {
  api.post(
    '/restore',
    upload.single('backup'),
    requireAuthenticationAPI,
    async (req: any, res) => {
      if (!userIsClusterAdmin(req.user)) {
        throw new Exceptions.UnauthorizedException();
      }
      await restoreFromBackup(req.file.path);
      res.json({status: 'success'});
    }
  );
}
