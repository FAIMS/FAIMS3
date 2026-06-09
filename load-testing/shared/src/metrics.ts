import type {MetricReport} from './coordinator-api';

export const PROMETHEUS_LABELS = [
  'testRunId',
  'stepId',
  'agentId',
  'sessionId',
  'name',
] as const;

/** Map agent metric type to the Prometheus metric name used by the coordinator. */
export function metricReportToPrometheusName(report: MetricReport): string {
  switch (report.type) {
    case 'performance_measure':
      return 'faims_measure_duration_ms';
    case 'longtask':
      return 'faims_longtask_duration_ms';
    case 'couch_request':
      return 'faims_couch_request_ms';
    case 'page_load':
      return 'faims_page_load_ms';
    case 'record_create':
      return 'faims_record_create_ms';
    case 'sync_duration':
      return 'faims_sync_duration_ms';
    case 'session_error':
      return 'faims_session_errors_total';
    case 'indexeddb_bytes':
      return 'faims_indexeddb_bytes';
    case 'active_session':
      return 'faims_active_sessions';
    default:
      return 'faims_unknown_metric';
  }
}

/** True when the report should increment a Prometheus counter. */
export function isCounterMetric(report: MetricReport): boolean {
  return report.type === 'session_error';
}

/** True when the report should set a Prometheus gauge. */
export function isGaugeMetric(report: MetricReport): boolean {
  return (
    report.type === 'indexeddb_bytes' || report.type === 'active_session'
  );
}
