// SPDX-License-Identifier: Apache-2.0
/**
 * Start Bugsnag once, before boot migrate, so migration errors can notify.
 *
 * `expressSetup` reuses the same client for the Express plugin. Calling
 * {@link startBugsnag} again is a no-op.
 */
import Bugsnag from '@bugsnag/js';
import BugsnagPluginExpress from '@bugsnag/plugin-express';
import {config} from './buildconfig';
import {shouldReportErrorToBugsnag} from './logging';

let started = false;

/** True after a successful {@link Bugsnag.start} in this process. */
export function isBugsnagStarted(): boolean {
  return started && !!config.bugsnagApiKey;
}

/**
 * Start the Bugsnag client when `config.bugsnagApiKey` is set. Idempotent.
 * @returns whether Bugsnag is enabled after this call
 */
export function startBugsnag(): boolean {
  const enabled = !!config.bugsnagApiKey;
  if (started) {
    return enabled;
  }
  started = true;
  if (!enabled) {
    console.log('Bugsnag not enabled (no API key set)');
    return false;
  }
  Bugsnag.start({
    apiKey: config.bugsnagApiKey!,
    plugins: [BugsnagPluginExpress],
    appVersion: config.apiVersion,
    // Express reports every error passed to next(err). Drop expected 401s and
    // intentional tombstone 404s; keep 429s and other failures.
    onError: event => shouldReportErrorToBugsnag(event.originalError),
  });
  console.log('Bugsnag enabled');
  return true;
}
