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
 *   Dedicated Express rate limiter for notebook export mint/redeem routes.
 *   Independent of the global IP limiter so ZIP/GDAL work stays capped even
 *   when RATE_LIMITER_ENABLED is off (upstream WAF / e2e).
 */

import {NextFunction, Request, RequestHandler, Response} from 'express';
import RateLimit from 'express-rate-limit';
import {config} from './buildconfig';

/**
 * Per-user when `req.user` is set (mint runs after auth); otherwise IP
 * (unauthenticated download probes).
 */
export const exportRateLimitKey = (req: Request): string => {
  if (req.user?.user_id) {
    return `user:${req.user.user_id}`;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

/**
 * Reads `config` on each request so tests can opt in by flipping
 * `exportRateLimiterEnabled` / `exportRateLimiterPerWindow`.
 */
export const EXPORT_RATE_LIMITER = RateLimit({
  windowMs: config.exportRateLimiterWindowMs,
  max: () => config.exportRateLimiterPerWindow,
  message: 'Too many export requests, please try again later',
  standardHeaders: true,
  legacyHeaders: true,
  skip: () => !config.exportRateLimiterEnabled,
  keyGenerator: exportRateLimitKey,
});

/** Route middleware — same instance for mint and redeem so they share config. */
export const exportRateLimit: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => EXPORT_RATE_LIMITER(req, res, next);
