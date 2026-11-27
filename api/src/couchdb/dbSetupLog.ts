// SPDX-License-Identifier: Apache-2.0
/**
 * Console / Bugsnag reporting for versioned design and security initialisation.
 *
 * Per-database `ahead` lines go to stderr; a migration run also sends **one**
 * aggregated {@link logError} so hundreds of data DBs do not create hundreds
 * of Bugsnag events.
 */
import type {DbSetupEvent} from '@faims3/data-model';
import {logError} from '../logging';

export const DB_SETUP_LOG = '[db-setup]';

function formatEvent(event: DbSetupEvent): string {
  return `type=${event.setupType} db=${event.dbName} part=${event.part} recorded=${event.recordedVersion ?? 'none'} target=${event.targetVersion}`;
}

/** Log one setup decision. `ahead` is an error line; it does not notify Bugsnag. */
export function handleDbSetupEvent(event: DbSetupEvent): void {
  if (event.action === 'patch') {
    console.warn(
      `${DB_SETUP_LOG} patch ${formatEvent(event)} recordedHash=${event.recordedHash} newHash=${event.targetHash}`
    );
    return;
  }
  if (event.action === 'forced') {
    console.log(
      `${DB_SETUP_LOG} forced ${formatEvent(event)} recordedHash=${event.recordedHash ?? 'none'} newHash=${event.targetHash}`
    );
    return;
  }
  if (event.action === 'upgrade') {
    console.log(`${DB_SETUP_LOG} upgrade ${formatEvent(event)}`);
    return;
  }
  if (event.action === 'ahead') {
    console.error(`${DB_SETUP_LOG} ahead ${formatEvent(event)}`);
  }
}

/** One aggregated Bugsnag-worthy error for recorded versions newer than this build. */
export function reportAheadSetupEvents(events: readonly DbSetupEvent[]): void {
  const ahead = events.filter(event => event.action === 'ahead');
  if (ahead.length === 0) {
    return;
  }
  const sample = ahead
    .slice(0, 5)
    .map(
      event =>
        `${event.part}:${event.setupType}:${event.dbName}:${event.recordedVersion}>${event.targetVersion}`
    )
    .join(',');
  logError(
    new Error(
      `db-setup recorded versions ahead of this build (${ahead.length})`
    ),
    `${DB_SETUP_LOG} ${ahead.length} recorded version(s) ahead of this build sample=${sample}`
  );
}

/**
 * Collect setup events for one initialise/migrate run. Call {@link flush}
 * once at the end so recorded-ahead errors reach Bugsnag a single time.
 */
export function createDbSetupRunLogger(): {
  onEvent: (event: DbSetupEvent) => void;
  flush: () => void;
} {
  const events: DbSetupEvent[] = [];
  return {
    onEvent: event => {
      handleDbSetupEvent(event);
      events.push(event);
    },
    flush: () => {
      reportAheadSetupEvents(events);
    },
  };
}
