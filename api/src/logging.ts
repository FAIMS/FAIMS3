import Bugsnag from '@bugsnag/js';
import {BUGSNAG_API_KEY} from './buildconfig';

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
