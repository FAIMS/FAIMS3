// SPDX-License-Identifier: Apache-2.0
/**
 * Cheap liveness app bound before startup migrations so ALB/ECS can probe
 * while Couch work runs. No auth, Couch, or other routes.
 *
 * Canonical path is {@link LIVENESS_PATH} (`/up`). Old Conductor images
 * already served this, so a target group probing `/up` stays healthy across
 * the image cutover. {@link READY_PATH} is mounted later by `attachFullApi`.
 */
import express from 'express';

/** Canonical ALB / ECS liveness path. Must stay first on the shared listener. */
export const LIVENESS_PATH = '/up';

/** Readiness path mounted after the full API attaches. */
export const READY_PATH = '/ready';

function sendLiveness(_req: express.Request, res: express.Response): void {
  res.status(200).json({status: 'ok'});
}

/** Tiny Express app with `GET /up` only. */
export function createHealthApp(): express.Express {
  const app = express();
  app.get(LIVENESS_PATH, sendLiveness);
  return app;
}
