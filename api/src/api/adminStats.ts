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

/**
 * All stats routes require a signed-in caller with `VIEW_SYSTEM_STATS`.
 * `forbiddenOnDeny` returns 403 (not 401) when the user is authenticated but
 * not an operations / general admin — so the UI can distinguish "log in"
 * from "you cannot see this".
 */
const statsAuth = [
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_SYSTEM_STATS,
    forbiddenOnDeny: true,
  }),
] as const;

/**
 * GET /api/admin/stats — overall instance counts from the cached snapshot.
 * Pass `?refresh=true` to bypass TTL and recompute.
 */
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

/**
 * POST /api/admin/stats/refresh — always recompute, then return overall counts.
 * Same payload as GET /?refresh=true. Control Centre Refresh uses this POST
 * once, then pages teams/people from the new cache without `refresh=true`.
 */
api.post(
  '/refresh',
  ...statsAuth,
  async (req, res: Response<GetAdminStatsResponse>) => {
    const snapshot = await getAdminStatsSnapshot({refresh: true});
    res.json(snapshotToOverall(snapshot));
  }
);

/**
 * GET /api/admin/stats/teams — paginated per-team rows from the same snapshot
 * as overall counts (`limit` / `offset` query params).
 */
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

/**
 * GET /api/admin/stats/people — paginated per-person rows keyed by
 * record/attachment `created_by`, plus users with an active refresh token,
 * from the same snapshot as overall counts.
 */
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
