import type {MetricReport} from '@faims3/load-testing-shared';

/** Flatten IPC bridge payloads into the shape coordinator ingestReport expects. */
export function normalizeMetricReport(
  raw: MetricReport & {detail?: Record<string, unknown>}
): MetricReport {
  const report: MetricReport = {...raw};
  const detail = raw.detail;

  if (report.durationMs === undefined && detail) {
    if (typeof detail.duration === 'number') {
      report.durationMs = detail.duration;
    } else if (typeof detail.durationMs === 'number') {
      report.durationMs = detail.durationMs;
    }
  }

  if (!report.name && detail && typeof detail.name === 'string') {
    report.name = detail.name.replace(/^dass\./, '');
  }

  if (report.type === 'page_load' && detail) {
    if (typeof detail.durationMs === 'number') {
      report.durationMs = detail.durationMs;
    }
    if (typeof detail.name === 'string') {
      report.name = detail.name;
    }
  }

  return report;
}
