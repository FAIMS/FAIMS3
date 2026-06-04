import {DASS_MEASURES} from '@faims3/instrumentation';
import type {BrowserContext, Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {waitForSyncComplete} from '../selectors.js';
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

  // Ensure the main app bar (sync cloud) is on screen — offline collection may
  // end on a record form or deep route.
  const notebookUrl = getNotebookUrl(env);
  const target = new URL(notebookUrl);
  const current = new URL(page.url());
  if (
    current.origin !== target.origin ||
    !current.pathname.startsWith(target.pathname)
  ) {
    sessionLog(
      ctx.sessionId,
      `navigating to notebook list before sync: ${notebookUrl}`
    );
    await page.goto(notebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  sessionLog(ctx.sessionId, 'back online, waiting for sync to finish');
  await context.setOffline(false);
  metricBuffer.setOnline(true);

  const syncStart = Date.now();
  const {sawSyncing} = await waitForSyncComplete(page, env.SYNC_STORM_DELAY_MS);

  if (!sawSyncing) {
    sessionLog(
      ctx.sessionId,
      'warning: sync never entered syncing state — no pending changes to push?'
    );
  } else {
    sessionLog(ctx.sessionId, 'sync in progress…');
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
