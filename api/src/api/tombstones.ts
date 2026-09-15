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
 * Filename: tombstones.ts
 * Description:
 *   Survey tombstone lookup API routes at /api/tombstones
 */

import {Action, GetTombstoneByIdResponse} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import validate from '../middleware/validate';
import {getTombstoneById} from '../couchdb/tombstones';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

/**
 * GET tombstone by deleted survey / project ID.
 * Returns the tombstone document if the survey was permanently deleted.
 */
api.get(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.READ_PROJECT_TOMBSTONE}),
  validate({
    params: z.object({id: z.string().min(1)}),
  }),
  async (req, res: Response<GetTombstoneByIdResponse>) => {
    const tombstone = await getTombstoneById(req.params.id);
    res.json(tombstone);
  }
);
