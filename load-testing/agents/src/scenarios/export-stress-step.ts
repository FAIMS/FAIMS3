import {
  ExportStressPhaseConfigSchema,
  type ActiveStep,
} from '@faims3/load-testing-shared';
import {sessionLog} from '../session-log.js';
import type {SessionContext} from '../types.js';
import type {MetricBuffer} from '../metric-buffer.js';
import {runExportStress} from './export-stress.js';

/** Gate export stress by plan fraction or `PARTICIPATE_IN_EXPORT` env. */
export async function runExportStressStep(
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  step: ActiveStep
): Promise<void> {
  const config = ExportStressPhaseConfigSchema.parse(step.config);
  const participate =
    config.participateFraction === undefined
      ? ctx.env.PARTICIPATE_IN_EXPORT
      : Math.random() < config.participateFraction;

  if (!participate) {
    sessionLog(ctx.sessionId, `skipping export stress step ${step.id}`);
    return;
  }

  await runExportStress(metricBuffer, ctx, step.id);
}
