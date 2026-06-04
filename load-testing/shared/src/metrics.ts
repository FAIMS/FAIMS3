import type {MetricReport} from './coordinator-api';

export const PROMETHEUS_LABELS = [
  'testRunId',
  'stepId',
  'agentId',
  'sessionId',
  'name',
] as const;

export function metricReportToPrometheusName(report: MetricReport): string {
  switch (report.type) {
    case 'performance_measure':
      return 'dass_measure_duration_ms';
    case 'longtask':
      return 'dass_longtask_duration_ms';
    case 'couch_request':
      return 'dass_couch_request_ms';
    case 'page_load':
      return 'dass_page_load_ms';
    case 'record_create':
      return 'dass_record_create_ms';
    case 'sync_duration':
      return 'dass_sync_duration_ms';
    case 'session_error':
      return 'dass_session_errors_total';
    case 'indexeddb_bytes':
      return 'dass_indexeddb_bytes';
    case 'active_session':
      return 'dass_active_sessions';
    default:
      return 'dass_unknown_metric';
  }
}

export function isCounterMetric(report: MetricReport): boolean {
  return report.type === 'session_error';
}

export function isGaugeMetric(report: MetricReport): boolean {
  return (
    report.type === 'indexeddb_bytes' || report.type === 'active_session'
  );
}
