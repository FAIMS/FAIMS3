import {DASS_MEASURES} from '@faims3/instrumentation';
import type {BrowserContext, CDPSession, Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';

export async function runOfflineCollection(
  page: Page,
  context: BrowserContext,
  cdp: CDPSession,
  metricBuffer: MetricBuffer,
  ctx: SessionContext
): Promise<void> {
  const {env} = ctx;

  const addBtn = page.getByTestId('add-record-button');
  if ((await addBtn.count()) === 0) {
    const notebookUrl = getNotebookUrl(env);
    sessionLog(ctx.sessionId, `navigating to notebook ${notebookUrl}`);
    await page.goto(notebookUrl, {waitUntil: 'networkidle', timeout: 120000});
    await addBtn.waitFor({timeout: 60000});
  }

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

  await page.waitForTimeout(1000);
  await context.setOffline(true);
  metricBuffer.setOnline(false);

  const durationSec = Math.round(env.OFFLINE_DURATION_MS / 1000);
  sessionLog(
    ctx.sessionId,
    `starting offline collection (${durationSec}s, creating records while offline)`
  );

  const endTime = Date.now() + env.OFFLINE_DURATION_MS;
  let recordIndex = 0;

  while (Date.now() < endTime) {
    try {
      if (!(await addBtn.count())) {
        sessionLog(ctx.sessionId, 'add-record-button not found, stopping collection');
        break;
      }

      await addBtn.first().click();
      await page.waitForTimeout(1000);

      const field = page.locator('input, textarea').first();
      if (!(await field.count())) {
        sessionLog(ctx.sessionId, 'no form field found after add-record click');
        break;
      }

      await field.fill(`load-test-${recordIndex}-${Date.now()}`);

      const saveStart = Date.now();
      const saved = page.getByTestId('save-record-indicator');
      const saveConfirmed = await saved
        .waitFor({timeout: 10000})
        .then(() => true)
        .catch(() => false);

      if (!saveConfirmed) {
        sessionLog(
          ctx.sessionId,
          `record ${recordIndex + 1} save not confirmed — skipping`
        );
        continue;
      }

      recordIndex += 1;
      sessionLog(ctx.sessionId, `collected record ${recordIndex}`);

      await metricBuffer.report({
        type: 'record_create',
        sessionId: ctx.sessionId,
        timestamp: Date.now(),
        durationMs: Date.now() - saveStart,
        name: DASS_MEASURES.RECORD_SAVE_UI,
        detail: {recordIndex},
      });

      await page.goBack({waitUntil: 'domcontentloaded'}).catch(async () => {
        await page.goto(getNotebookUrl(env), {waitUntil: 'domcontentloaded'});
      });
      await addBtn.waitFor({timeout: 10000}).catch(() => undefined);
      await page.waitForTimeout(1000);
    } catch (err) {
      await metricBuffer.report({
        type: 'session_error',
        sessionId: ctx.sessionId,
        timestamp: Date.now(),
        errorType: 'offline_record_create',
        message: (err as Error).message,
      });
    }
  }

  sessionLog(
    ctx.sessionId,
    `offline collection complete (${recordIndex} record${recordIndex === 1 ? '' : 's'})`
  );
}
