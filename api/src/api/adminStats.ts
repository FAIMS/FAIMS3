// SPDX-License-Identifier: Apache-2.0

/*
 * Admin stats API: overall counts plus paginated per-team and per-person rows
 * from a single cached snapshot.
 */

import {
  Action,
  GetAdminStatsListQuerySchema,
  GetAdminStatsPeopleResponse,
  GetAdminStatsQuerySchema,
  GetAdminStatsResponse,
  GetAdminStatsTeamsResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import validate from '../middleware/validate';
import {
  getAdminStatsSnapshot,
  snapshotToOverall,
  snapshotToPeoplePage,
  snapshotToTeamsPage,
} from '../couchdb/adminStats';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import patch from '../utils/patchExpressAsync';

patch();

export const api: express.Router = express.Router();

const statsAuth = [
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_SYSTEM_STATS,
    forbiddenOnDeny: true,
  }),
] as const;

api.get(
  '/',
  ...statsAuth,
  validate({query: GetAdminStatsQuerySchema}),
  async (req, res: Response<GetAdminStatsResponse>) => {
    const snapshot = await getAdminStatsSnapshot({
      refresh: req.query.refresh === 'true',
    });
    res.json(snapshotToOverall(snapshot));
  }
);

api.post(
  '/refresh',
  ...statsAuth,
  async (req, res: Response<GetAdminStatsResponse>) => {
    const snapshot = await getAdminStatsSnapshot({refresh: true});
    res.json(snapshotToOverall(snapshot));
  }
);

api.get(
  '/teams',
  ...statsAuth,
  validate({query: GetAdminStatsListQuerySchema}),
  async (req, res: Response<GetAdminStatsTeamsResponse>) => {
    const snapshot = await getAdminStatsSnapshot({
      refresh: req.query.refresh === 'true',
    });
    res.json(
      snapshotToTeamsPage({
        snapshot,
        limit: req.query.limit,
        offset: req.query.offset,
      })
    );
  }
);

api.get(
  '/people',
  ...statsAuth,
  validate({query: GetAdminStatsListQuerySchema}),
  async (req, res: Response<GetAdminStatsPeopleResponse>) => {
    const snapshot = await getAdminStatsSnapshot({
      refresh: req.query.refresh === 'true',
    });
    res.json(
      snapshotToPeoplePage({
        snapshot,
        limit: req.query.limit,
        offset: req.query.offset,
      })
    );
  }
);
