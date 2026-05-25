import {DASS_MEASURES} from '@faims3/instrumentation';
import type {BrowserContext, Page} from 'playwright';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';

export async function runSyncStorm(
  page: Page,
  context: BrowserContext,
  metricBuffer: MetricBuffer,
  ctx: SessionContext
): Promise<void> {
  const {env} = ctx;
  const jitterCapMs = Math.min(10000, env.SYNC_STORM_DELAY_MS);
  const jitterMs = Math.floor(Math.random() * jitterCapMs);
  sessionLog(ctx.sessionId, `reconnecting in ${Math.round(jitterMs / 1000)}s`);
  await page.waitForTimeout(jitterMs);

  sessionLog(ctx.sessionId, 'back online, waiting for sync to finish');
  await context.setOffline(false);
  metricBuffer.setOnline(true);

  const syncIcon = page.getByTestId('sync-status-icon');
  await syncIcon.waitFor({state: 'visible', timeout: 30000});

  const syncStart = Date.now();
  await page.waitForTimeout(1000);

  const syncing = page.getByTestId('sync-status-syncing');
  const sawSyncing = await syncing
    .waitFor({state: 'attached', timeout: 20000})
    .then(() => true)
    .catch(() => false);

  if (sawSyncing) {
    sessionLog(ctx.sessionId, 'sync in progress…');
    await page.getByTestId('sync-status-idle').waitFor({
      timeout: env.SYNC_STORM_DELAY_MS,
    });
  } else {
    sessionLog(
      ctx.sessionId,
      'warning: sync never entered syncing state — no pending changes to push?'
    );
  }

  sessionLog(
    ctx.sessionId,
    `sync complete (${Math.round((Date.now() - syncStart) / 1000)}s)`
  );

  await metricBuffer.report({
    type: 'sync_duration',
    sessionId: ctx.sessionId,
    timestamp: Date.now(),
    durationMs: Date.now() - syncStart,
    name: DASS_MEASURES.SYNC_PUSH_COMPLETE,
    detail: {jitterMs, sawSyncing},
  });
}
