/**
 * Canonical FAIMS performance measure names.
 *
 * Values are the logical name **without** the `faims.` prefix. Pass them to
 * `perf.mark()` / `perf.measure()` / `perf.wrap()`; the perf layer prepends
 * `FAIMS_PREFIX` when writing to the User Timing API.
 *
 * Keep this list in sync with load-test agents and Grafana dashboards — agents
 * import these constants so reported metric names match app-side measures.
 */

/** Survey / notebook activation lifecycle. */
const SURVEY_ACTIVATION = {
  /** User initiated activation (before local DB + sync setup). */
  SURVEY_ACTIVATE_START: 'survey.activate.start',
  /** Notebook structure / UI spec ready for interaction. */
  SURVEY_ACTIVATE_STRUCTURE_READY: 'survey.activate.structure_ready',
  /** Initial sync or design-doc bootstrap finished. */
  SURVEY_ACTIVATE_SYNC_COMPLETE: 'survey.activate.sync_complete',
  /** End-to-end activation (often used with `perf.wrap`). */
  SURVEY_ACTIVATE_TOTAL: 'survey.activate.total',
} as const;

/** Record save path from UI through local storage (and optionally sync). */
const RECORD_SAVE = {
  /** Revision persisted to local PouchDB. */
  RECORD_SAVE_LOCAL: 'record.save.local',
  /** Save button → local persist (user-perceived save latency). */
  RECORD_SAVE_UI: 'record.save.ui',
  /** Local revision observed synced to remote (not yet wired everywhere). */
  RECORD_SAVE_SYNCED: 'record.save.synced',
} as const;

/**
 * PouchDB replication events.
 *
 * These fire frequently during sync. Instrument only at coarse boundaries
 * (start/complete of a push or pull), not on every `change` callback, unless
 * the performance impact has been validated.
 */
const SYNC = {
  SYNC_PUSH_START: 'sync.push.start',
  SYNC_PUSH_COMPLETE: 'sync.push.complete',
  SYNC_PULL_START: 'sync.pull.start',
  SYNC_PULL_COMPLETE: 'sync.pull.complete',
  SYNC_CONFLICT_DETECTED: 'sync.conflict.detected',
  SYNC_RECONNECT: 'sync.reconnect',
} as const;

/** Map view rendering. */
const MAP = {
  MAP_RENDER_START: 'map.render.start',
  MAP_RENDER_COMPLETE: 'map.render.complete',
  MAP_RECORDS_RENDER: 'map.records.render',
} as const;

/** Data export download flow. */
const EXPORT = {
  EXPORT_REQUEST: 'export.request',
  EXPORT_DOWNLOAD_START: 'export.download_start',
  EXPORT_DOWNLOAD_COMPLETE: 'export.download_complete',
} as const;

/** Known FAIMS performance measure names (without `faims.` prefix). */
export const FAIMS_MEASURES = {
  ...SURVEY_ACTIVATION,
  ...RECORD_SAVE,
  ...SYNC,
  ...MAP,
  ...EXPORT,
} as const;

/** Union of all values in {@link FAIMS_MEASURES}. */
export type FaimsMeasureName =
  (typeof FAIMS_MEASURES)[keyof typeof FAIMS_MEASURES];

/** Prefix applied to every User Timing mark/measure name (`faims.survey.activate.start`). */
export const FAIMS_PREFIX = 'faims';

/**
 * Build the full Performance Timeline entry name for a logical measure.
 *
 * @example faimsMeasureName('record.save.ui') // 'faims.record.save.ui'
 */
export function faimsMeasureName(name: string): string {
  return `${FAIMS_PREFIX}.${name}`;
}
