import {DASS_MEASURES} from '@faims3/instrumentation';
import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {
  addRecordButton,
  finishAnywayButton,
  finishRecordButton,
  saveRecordIndicator,
} from '../selectors.js';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';

export async function ensureNotebookList(page: Page, ctx: SessionContext): Promise<void> {
  const addBtn = addRecordButton(page);
  if ((await addBtn.count()) > 0) {
    return;
  }
  const notebookUrl = getNotebookUrl(ctx.env);
  sessionLog(ctx.sessionId, `navigating to notebook ${notebookUrl}`);
  await page.goto(notebookUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await addBtn.waitFor({timeout: 60000});
}

export interface RecordLoopOptions {
  stepId: string;
  deadlineMs: number;
  recordIntervalMs: number;
  maxRecords?: number;
}

/** Create records in a loop until deadline (or maxRecords). */
export async function runRecordLoop(
  page: Page,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  options: RecordLoopOptions
): Promise<number> {
  await ensureNotebookList(page, ctx);
  const addBtn = addRecordButton(page);
  let recordIndex = 0;

  while (Date.now() < options.deadlineMs) {
    if (options.maxRecords !== undefined && recordIndex >= options.maxRecords) {
      break;
    }

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
      const saved = saveRecordIndicator(page);
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
        stepId: options.stepId,
        timestamp: Date.now(),
        durationMs: Date.now() - saveStart,
        name: DASS_MEASURES.RECORD_SAVE_UI,
        detail: {recordIndex},
      });

      const finishBtn = finishRecordButton(page);
      if (await finishBtn.count()) {
        await finishBtn.click();
        const finishAnyway = finishAnywayButton(page);
        const guarded = await finishAnyway
          .waitFor({timeout: 5000})
          .then(() => true)
          .catch(() => false);
        if (guarded) {
          await finishAnyway.click();
        }
      } else {
        await page.goBack({waitUntil: 'domcontentloaded'}).catch(async () => {
          await page.goto(getNotebookUrl(ctx.env), {waitUntil: 'domcontentloaded'});
        });
      }

      await addBtn.waitFor({timeout: 15000}).catch(() => undefined);

      const remaining = options.deadlineMs - Date.now();
      if (remaining <= 0) break;
      await page.waitForTimeout(
        Math.min(options.recordIntervalMs, remaining)
      );
    } catch (err) {
      await metricBuffer.report({
        type: 'session_error',
        sessionId: ctx.sessionId,
        stepId: options.stepId,
        timestamp: Date.now(),
        errorType: 'record_create',
        message: (err as Error).message,
      });
    }
  }

  return recordIndex;
}
