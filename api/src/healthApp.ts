// SPDX-License-Identifier: Apache-2.0
/**
 * Cheap liveness app bound before startup migrations so ALB/ECS can probe
 * while Couch work runs. No auth, Couch, or other routes.
 *
 * Canonical path is {@link HEALTH_PATH}. {@link DEPRECATED_ROOT_HEALTH_PATH}
 * (`/`) is kept so an older target group still probing `/` stays healthy on
 * new tasks; {@link releaseDeprecatedRootHealth} yields `/` to the home route
 * once the full API attaches.
 */
import express from 'express';

/** Canonical ALB / ECS liveness path. Must stay first on the shared listener. */
export const HEALTH_PATH = '/health';

/**
 * Deprecated liveness alias. Pre-`/health` ALB target groups probed `/`
 * (login 302). Served as health only until {@link releaseDeprecatedRootHealth}.
 */
export const DEPRECATED_ROOT_HEALTH_PATH = '/';

const SERVE_ROOT_AS_HEALTH = 'serveDeprecatedRootHealth';

function sendLiveness(_req: express.Request, res: express.Response): void {
  res.status(200).json({status: 'ok'});
}

/** Tiny Express app with `GET /health` and deprecated `GET /`. */
export function createHealthApp(): express.Express {
  const app = express();
  app.locals[SERVE_ROOT_AS_HEALTH] = true;
  app.get(HEALTH_PATH, sendLiveness);
  // Deprecated: same 200 as /health so a TG still probing `/` does not 404.
  app.get(DEPRECATED_ROOT_HEALTH_PATH, (req, res, next) => {
    if (!req.app.locals[SERVE_ROOT_AS_HEALTH]) {
      next();
      return;
    }
    sendLiveness(req, res);
  });
  return app;
}

/** Let `attachFullApi` take over `GET /` (login / fallback). `/health` stays. */
export function releaseDeprecatedRootHealth(app: express.Express): void {
  app.locals[SERVE_ROOT_AS_HEALTH] = false;
}
