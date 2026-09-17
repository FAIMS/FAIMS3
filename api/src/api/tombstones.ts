// SPDX-License-Identifier: Apache-2.0

/*
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
