// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Dedicated Express rate limiter for POST /api/feedback.
 *   Independent of the global IP limiter so authenticated users cannot use
 *   Conductor as an open mail relay when RATE_LIMITER_ENABLED is off.
 */

import {NextFunction, Request, RequestHandler, Response} from 'express';
import RateLimit from 'express-rate-limit';
import {config} from './buildconfig';

/**
 * Per-user when `req.user` is set (the route runs after auth); otherwise IP.
 */
export const feedbackRateLimitKey = (req: Request): string => {
  if (req.user?.user_id) {
    return `user:${req.user.user_id}`;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

/**
 * Reads `config` on each request so tests can opt in by flipping
 * `feedbackRateLimiterEnabled` / `feedbackRateLimiterPerWindow`.
 */
export const FEEDBACK_RATE_LIMITER = RateLimit({
  windowMs: config.feedbackRateLimiterWindowMs,
  max: () => config.feedbackRateLimiterPerWindow,
  message: 'Too many feedback submissions, please try again later.',
  standardHeaders: true,
  legacyHeaders: true,
  skip: () => !config.feedbackRateLimiterEnabled,
  keyGenerator: feedbackRateLimitKey,
});

/** Route middleware — same instance so tests can `resetKey`. */
export const feedbackRateLimit: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => FEEDBACK_RATE_LIMITER(req, res, next);
