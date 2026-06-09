import {FAIMS_MEASURES} from '@faims3/instrumentation';
import type {CollectionProfile} from '@faims3/load-testing-shared';
import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {
  executeCollectionProfile,
} from '../collection/execute-profile.js';
import {
  addRecordButton,
  finishAnywayButton,
  finishRecordButton,
  saveRecordIndicator,
} from '../selectors.js';
import {sessionLog} from '../session-log.js';
import type {MetricBuffer} from '../metric-buffer.js';
import type {SessionContext} from '../types.js';

/** Navigate to the notebook list if the add-record button is not visible. */
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
  collectionProfile?: CollectionProfile;
}

/** Fallback record flow: fill first field, save, and finish without a profile. */
async function runSimpleRecord(
  page: Page,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  options: RecordLoopOptions,
  recordIndex: number
): Promise<boolean> {
  const addBtn = addRecordButton(page);
  if (!(await addBtn.count())) {
    sessionLog(ctx.sessionId, 'add-record-button not found, stopping collection');
    return false;
  }

  await addBtn.first().click();
  await page.waitForTimeout(1000);

  const field = page.locator('input, textarea').first();
  if (!(await field.count())) {
    sessionLog(ctx.sessionId, 'no form field found after add-record click');
    return false;
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
    return false;
  }

  await metricBuffer.report({
    type: 'record_create',
    sessionId: ctx.sessionId,
    stepId: options.stepId,
    timestamp: Date.now(),
    durationMs: Date.now() - saveStart,
    name: FAIMS_MEASURES.RECORD_SAVE_UI,
    detail: {recordIndex: recordIndex + 1, profile: 'simple'},
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
  return true;
}

/** Create records in a loop until deadline (or maxRecords). */
export async function runRecordLoop(
  page: Page,
  metricBuffer: MetricBuffer,
  ctx: SessionContext,
  options: RecordLoopOptions
): Promise<number> {
  await ensureNotebookList(page, ctx);
  let recordIndex = 0;

  while (Date.now() < options.deadlineMs) {
    if (options.maxRecords !== undefined && recordIndex >= options.maxRecords) {
      break;
    }

    try {
      const saveStart = Date.now();
      let collected = false;
      let profileDetail: Record<string, unknown> = {profile: 'simple'};

      if (options.collectionProfile) {
        const result = await executeCollectionProfile(
          page,
          ctx,
          options.collectionProfile,
          {recordIndex, stepId: options.stepId}
        );
        collected = result !== null && result.finished;
        profileDetail = {
          profile: options.collectionProfile.name ?? 'unnamed',
          stepsCompleted: result?.stepsCompleted ?? 0,
          stepsFailed: result?.stepsFailed ?? 0,
        };
      } else {
        collected = await runSimpleRecord(page, metricBuffer, ctx, options, recordIndex);
      }

      if (!collected) {
        continue;
      }

      recordIndex += 1;
      sessionLog(ctx.sessionId, `collected record ${recordIndex}`);

      if (options.collectionProfile) {
        await metricBuffer.report({
          type: 'record_create',
          sessionId: ctx.sessionId,
          stepId: options.stepId,
          timestamp: Date.now(),
          durationMs: Date.now() - saveStart,
          name: FAIMS_MEASURES.RECORD_SAVE_UI,
          detail: {recordIndex, ...profileDetail},
        });
      }

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
