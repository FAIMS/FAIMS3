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

import {ListingInformation} from '@faims3/data-model';
import express from 'express';
import multer from 'multer';
import {
  CONDUCTOR_DESCRIPTION,
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  DEVELOPER_MODE,
} from '../buildconfig';
import {initialiseDatabases} from '../couchdb';
import {restoreFromBackup} from '../couchdb/backupRestore';
import {getProjects} from '../couchdb/notebooks';
import {userIsClusterAdmin} from '../couchdb/users';
import {requireAuthenticationAPI} from '../middleware';
import {slugify} from '../utils';

// TODO: configure this directory
const upload = multer({dest: '/tmp/'});

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
  const info: ListingInformation = {
    id: slugify(CONDUCTOR_INSTANCE_NAME),
    name: CONDUCTOR_INSTANCE_NAME,
    conductor_url: CONDUCTOR_PUBLIC_URL,
    description: CONDUCTOR_DESCRIPTION,
  };
  res.json(info);
});

api.get('/directory/', requireAuthenticationAPI, async (req, res) => {
  // get the directory of notebooks on this server
  if (req.user) {
    const projects = await getProjects(req.user);
    res.json(projects);
  } else {
    res.json([]);
  }
});

if (DEVELOPER_MODE) {
  api.post(
    '/restore',
    upload.single('backup'),
    requireAuthenticationAPI,
    async (req: any, res) => {
      if (userIsClusterAdmin(req.user)) {
        await restoreFromBackup(req.file.path);
        res.json({status: 'success'});
      } else {
        res.status(401).end();
      }
    }
  );
}
