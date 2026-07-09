import Bugsnag from '@bugsnag/js';
import Express from 'express';
import {BUGSNAG_API_KEY, RUNNING_UNDER_TEST} from './buildconfig';
import {nowIso} from './time';

/**
 * Logs an error to the console and reports it to Bugsnag when configured. TODO:
 * there is a pending PR which properly handles errors and logs them to Bugsnag.
 * But this GDAL error is worthy of particular concern at this stage. Hence this
 * temporary workaround.
 */
export const logError = (error: unknown) => {
  console.error(error);
  if (BUGSNAG_API_KEY) {
    const err = error instanceof Error ? error : new Error(String(error));
    Bugsnag.notify(err);
  }
};

/**
 * When the authenticated user is acting via an impersonation token, writes an
 * audit line to stdout (alongside morgan request logging).
 */
export function logImpersonatedRequest(req: Express.Request): void {
  const user = req.user;
  if (!user?.impersonatingUserId || RUNNING_UNDER_TEST) {
    return;
  }

  console.log(
    `[Impersonation] ${user.impersonatingUserId} performed ${req.method} ${req.originalUrl} as ${user.user_id} at ${nowIso()}`
  );
}
