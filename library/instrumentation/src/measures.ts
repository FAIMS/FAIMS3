/** Known DASS performance measure names (without dass. prefix). */
export const DASS_MEASURES = {
  SURVEY_ACTIVATE_START: 'survey.activate.start',
  SURVEY_ACTIVATE_STRUCTURE_READY: 'survey.activate.structure_ready',
  SURVEY_ACTIVATE_SYNC_COMPLETE: 'survey.activate.sync_complete',
  SURVEY_ACTIVATE_TOTAL: 'survey.activate.total',
  RECORD_SAVE_LOCAL: 'record.save.local',
  RECORD_SAVE_UI: 'record.save.ui',
  RECORD_SAVE_SYNCED: 'record.save.synced',
  SYNC_PUSH_START: 'sync.push.start',
  SYNC_PUSH_COMPLETE: 'sync.push.complete',
  SYNC_PULL_START: 'sync.pull.start',
  SYNC_PULL_COMPLETE: 'sync.pull.complete',
  SYNC_CONFLICT_DETECTED: 'sync.conflict.detected',
  SYNC_RECONNECT: 'sync.reconnect',
  MAP_RENDER_START: 'map.render.start',
  MAP_RENDER_COMPLETE: 'map.render.complete',
  MAP_RECORDS_RENDER: 'map.records.render',
  EXPORT_REQUEST: 'export.request',
  EXPORT_DOWNLOAD_START: 'export.download_start',
  EXPORT_DOWNLOAD_COMPLETE: 'export.download_complete',
} as const;

export type DassMeasureName =
  (typeof DASS_MEASURES)[keyof typeof DASS_MEASURES];

export const DASS_PREFIX = 'dass';

export function dassMeasureName(name: string): string {
  return `${DASS_PREFIX}.${name}`;
}
