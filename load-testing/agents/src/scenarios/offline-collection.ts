import {DASS_MEASURES} from '@faims3/instrumentation';
import {
  OfflineCollectionPhaseConfigSchema,
  type ActiveStep,
} from '@faims3/load-testing-shared';
import type {BrowserContext, CDPSession, Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {waitForSyncComplete} from '../selectors.js';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';
import {collectionProfileFromStepConfig} from '../collection/from-step-config.js';
import {runRecordLoop} from './record-collection.js';

export async function runOfflineCollection(
  page: Page,
  context: BrowserContext,
  cdp: CDPSession,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  step: ActiveStep
): Promise<void> {
  const config = OfflineCollectionPhaseConfigSchema.parse(step.config);
  const deadlineMs =
    step.endsAt ?? step.startedAt + (step.durationMs ?? 60_000);

  try {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (50 * 1024) / 8,
      uploadThroughput: (20 * 1024) / 8,
      latency: 500,
    });
  } catch {
    // CDP network emulation may be unavailable
  }

  await context.setOffline(true);
  metricBuffer.setOnline(false);

  sessionLog(
    ctx.sessionId,
    `offline collection until ${new Date(deadlineMs).toISOString()}`
  );

  const count = await runRecordLoop(page, metricBuffer, ctx, {
    stepId: step.id,
    deadlineMs,
    recordIntervalMs: config.recordIntervalMs ?? 5000,
    maxRecords: config.maxRecords,
    collectionProfile: collectionProfileFromStepConfig(step.config),
  });

  sessionLog(
    ctx.sessionId,
    `offline collection done (${count} records), reconnecting…`
  );

  const jitterCapMs = Math.min(10000, config.reconnectJitterMaxMs);
  const jitterMs = Math.floor(Math.random() * (jitterCapMs + 1));
  await page.waitForTimeout(jitterMs);

  const notebookUrl = getNotebookUrl(ctx.env);
  const target = new URL(notebookUrl);
  const current = new URL(page.url());
  if (
    current.origin !== target.origin ||
    !current.pathname.startsWith(target.pathname)
  ) {
    await page.goto(notebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  await context.setOffline(false);
  metricBuffer.setOnline(true);

  const syncStart = Date.now();
  const {sawSyncing} = await waitForSyncComplete(page, config.syncTimeoutMs);

  if (!sawSyncing) {
    sessionLog(ctx.sessionId, 'warning: sync never entered syncing state');
  }

  await metricBuffer.report({
    type: 'sync_duration',
    sessionId: ctx.sessionId,
    stepId: step.id,
    timestamp: Date.now(),
    durationMs: Date.now() - syncStart,
    name: DASS_MEASURES.SYNC_PUSH_COMPLETE,
    detail: {jitterMs, sawSyncing, recordCount: count},
  });

  sessionLog(
    ctx.sessionId,
    `offline phase complete (sync ${Math.round((Date.now() - syncStart) / 1000)}s)`
  );
}
