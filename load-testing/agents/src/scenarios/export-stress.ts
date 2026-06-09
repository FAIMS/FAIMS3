import {ExportNotebookResponseSchema} from '@faims3/load-testing-shared';
import {sessionLog} from '../session-log.js';
import type {SessionContext} from '../types.js';
import type {MetricBuffer} from '../metric-buffer.js';

/** Request a CSV export and download the signed URL; report timing/errors. */
export async function runExportStress(
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  stepId: string
): Promise<void> {
  if (!ctx.jwtToken) {
    sessionLog(ctx.sessionId, 'skipping export — no JWT from onboarding');
    return;
  }

  sessionLog(ctx.sessionId, 'starting export stress');

  const {env, jwtToken} = ctx;
  const notebookId = env.NOTEBOOK_PROJECT_ID;
  const exportUrl = `${env.FAIMS_API_URL}/api/${env.NOTEBOOK_NAME}s/${notebookId}/records/export?format=csv`;

  const start = Date.now();
  const response = await fetch(exportUrl, {
    headers: {Authorization: `Bearer ${jwtToken}`},
  });

  if (!response.ok) {
    await metricBuffer.report({
      type: 'session_error',
      sessionId: ctx.sessionId,
      stepId,
      timestamp: Date.now(),
      errorType: 'export_request_failed',
      message: `HTTP ${response.status}`,
    });
    return;
  }

  const data: unknown = await response.json();
  const parsed = ExportNotebookResponseSchema.safeParse(data);
  if (!parsed.success) {
    await metricBuffer.report({
      type: 'session_error',
      sessionId: ctx.sessionId,
      stepId,
      timestamp: Date.now(),
      errorType: 'export_response_invalid',
      message: parsed.error.message,
    });
    return;
  }

  const downloadStart = Date.now();
  const downloadResponse = await fetch(parsed.data.url, {
    headers: {Authorization: `Bearer ${jwtToken}`},
  });
  await downloadResponse.arrayBuffer();

  sessionLog(ctx.sessionId, 'export download complete');

  await metricBuffer.report({
    type: 'performance_measure',
    sessionId: ctx.sessionId,
    stepId,
    timestamp: Date.now(),
    durationMs: Date.now() - start,
    name: 'export.download_complete',
    detail: {downloadMs: Date.now() - downloadStart},
  });
}
