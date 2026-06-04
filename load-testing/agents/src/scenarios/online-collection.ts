import {
  OnlineCollectionPhaseConfigSchema,
  type ActiveStep,
} from '@faims3/load-testing-shared';
import type {Page} from 'playwright';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';
import {runRecordLoop} from './record-collection.js';

export async function runOnlineCollection(
  page: Page,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  step: ActiveStep
): Promise<void> {
  const config = OnlineCollectionPhaseConfigSchema.parse(step.config);
  const deadlineMs =
    step.endsAt ?? step.startedAt + (step.durationMs ?? config.recordIntervalMs);

  sessionLog(
    ctx.sessionId,
    `online collection until ${new Date(deadlineMs).toISOString()}`
  );
  metricBuffer.setOnline(true);

  const count = await runRecordLoop(page, metricBuffer, ctx, {
    stepId: step.id,
    deadlineMs,
    recordIntervalMs: config.recordIntervalMs,
    maxRecords: config.maxRecords,
  });

  sessionLog(
    ctx.sessionId,
    `online collection complete (${count} record${count === 1 ? '' : 's'})`
  );
}
