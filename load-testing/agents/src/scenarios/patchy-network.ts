import {
  PatchyNetworkPhaseConfigSchema,
  type ActiveStep,
} from '@faims3/load-testing-shared';
import type {BrowserContext, Page} from 'playwright';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';
import {collectionProfileFromStepConfig} from '../collection/from-step-config.js';
import {runRecordLoop} from './record-collection.js';

function jitter(baseMs: number, jitterMs: number): number {
  if (jitterMs <= 0) return baseMs;
  const delta = Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs;
  return Math.max(1000, baseMs + delta);
}

export async function runPatchyNetwork(
  page: Page,
  context: BrowserContext,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  step: ActiveStep
): Promise<void> {
  const config = PatchyNetworkPhaseConfigSchema.parse(step.config);
  const deadlineMs =
    step.endsAt ?? step.startedAt + (step.durationMs ?? 600_000);

  sessionLog(
    ctx.sessionId,
    `patchy network until ${new Date(deadlineMs).toISOString()}`
  );

  let online = true;
  await context.setOffline(false);
  metricBuffer.setOnline(true);
  let nextToggleAt = Date.now() + jitter(config.cycleMs, config.cycleJitterMs);

  while (Date.now() < deadlineMs) {
    const now = Date.now();
    if (now >= nextToggleAt) {
      online = !online;
      await context.setOffline(!online);
      metricBuffer.setOnline(online);
      sessionLog(
        ctx.sessionId,
        online ? 'patchy: back online' : 'patchy: went offline'
      );

      if (!online) {
        const offlineMs = jitter(
          config.offlineDurationMs,
          config.offlineJitterMs
        );
        nextToggleAt = now + offlineMs;
      } else {
        nextToggleAt = now + jitter(config.cycleMs, config.cycleJitterMs);
      }
    }

    if (online) {
      const sliceEnd = Math.min(deadlineMs, nextToggleAt);
      if (sliceEnd > Date.now()) {
        await runRecordLoop(page, metricBuffer, ctx, {
          stepId: step.id,
          deadlineMs: sliceEnd,
          recordIntervalMs: config.recordIntervalMs,
          maxRecords: config.maxRecords,
          collectionProfile: collectionProfileFromStepConfig(step.config),
        });
      }
    } else {
      const waitMs = Math.min(nextToggleAt - Date.now(), deadlineMs - Date.now());
      if (waitMs > 0) {
        await page.waitForTimeout(waitMs);
      }
    }
  }

  await context.setOffline(false);
  metricBuffer.setOnline(true);
  sessionLog(ctx.sessionId, 'patchy network phase complete');
}
