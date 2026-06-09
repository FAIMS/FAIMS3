import {type CollectionProfile, type CollectionStep} from '@faims3/load-testing-shared';
import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {
  addRecordButton,
  finishAnywayButton,
  finishRecordButton,
  saveRecordIndicator,
} from '../selectors.js';
import {sessionLog} from '../session-log.js';
import type {SessionContext} from '../types.js';
import {
  checkboxInField,
  fieldContainer,
  selectControlInField,
  textInputInField,
} from './field-locators.js';
import {interpolateValue, type TemplateContext} from './interpolate.js';

const DEFAULT_STEP_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY = 1;
const DEFAULT_RETRY_DELAY_MS = 500;

export interface ExecuteProfileResult {
  stepsCompleted: number;
  stepsFailed: number;
  finished: boolean;
}

export interface ExecuteProfileOptions {
  recordIndex: number;
  stepId: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stepLabel(step: CollectionStep, index: number): string {
  if ('label' in step && step.label) {
    return step.label;
  }
  if (step.action === 'group') {
    return `group#${index + 1}`;
  }
  return `${step.action}#${index + 1}`;
}

async function withStepRetry(
  step: CollectionStep,
  run: () => Promise<void>
): Promise<void> {
  const retries = step.retry ?? DEFAULT_RETRY;
  const retryDelayMs = step.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await run();
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function waitForFieldVisible(
  page: Page,
  fieldId: string,
  timeoutMs: number
): Promise<void> {
  const container = fieldContainer(page, fieldId);
  await container.waitFor({state: 'attached', timeout: timeoutMs});
  await container.scrollIntoViewIfNeeded().catch(() => undefined);
}

async function runFill(
  page: Page,
  step: Extract<CollectionStep, {action: 'fill'}>,
  context: TemplateContext,
  timeoutMs: number
): Promise<void> {
  await waitForFieldVisible(page, step.field, timeoutMs);
  const container = fieldContainer(page, step.field);
  const input = textInputInField(container, step.multiline);
  await input.waitFor({state: 'visible', timeout: timeoutMs});
  const value = interpolateValue(step.value, context);
  await input.fill(value);
}

async function runSelect(
  page: Page,
  step: Extract<CollectionStep, {action: 'select'}>,
  timeoutMs: number
): Promise<void> {
  await waitForFieldVisible(page, step.field, timeoutMs);
  const container = fieldContainer(page, step.field);
  const control = selectControlInField(container);
  await control.waitFor({state: 'visible', timeout: timeoutMs});
  await control.click();

  const optionLocator = page
    .getByRole('option', {name: step.option, exact: true})
    .or(page.getByRole('option', {name: new RegExp(escapeRegExp(step.option))}))
    .first();

  await optionLocator.waitFor({state: 'visible', timeout: timeoutMs});
  await optionLocator.click();
}

async function runToggle(
  page: Page,
  step: Extract<CollectionStep, {action: 'toggle'}>,
  timeoutMs: number
): Promise<void> {
  await waitForFieldVisible(page, step.field, timeoutMs);
  const container = fieldContainer(page, step.field);
  const control = step.option
    ? container
        .getByRole('checkbox', {
          name: new RegExp(escapeRegExp(step.option), 'i'),
        })
        .or(
          container.getByRole('radio', {
            name: new RegExp(escapeRegExp(step.option), 'i'),
          })
        )
        .first()
    : checkboxInField(container);

  await control.waitFor({state: 'visible', timeout: timeoutMs});
  const checked = await control.isChecked();
  if (checked !== step.checked) {
    await control.click();
  }
}

function sectionNameMatcher(
  section: string,
  match: 'label' | 'id'
): string | RegExp {
  if (match === 'id') {
    return new RegExp(`^${escapeRegExp(section)}$`, 'i');
  }
  return section;
}

function sectionLabelMatches(
  label: string | null | undefined,
  section: string,
  match: 'label' | 'id'
): boolean {
  if (!label) {
    return false;
  }
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (match === 'id') {
    return new RegExp(`^${escapeRegExp(section)}$`, 'i').test(normalized);
  }
  return normalized === section || normalized.includes(section);
}

async function readActiveSectionLabel(page: Page): Promise<string | null> {
  const selectedTab = page.locator('[role="tab"][aria-selected="true"]').first();
  if (await selectedTab.count()) {
    return (await selectedTab.innerText()).replace(/\s+/g, ' ').trim();
  }

  const mobileHeading = page.getByRole('heading', {level: 4}).first();
  if (await mobileHeading.isVisible().catch(() => false)) {
    return (await mobileHeading.innerText()).replace(/\s+/g, ' ').trim();
  }

  return null;
}

async function isOnTargetSection(
  page: Page,
  section: string,
  match: 'label' | 'id'
): Promise<boolean> {
  const tabName = sectionNameMatcher(section, match);
  const tab = page.getByRole('tab', {name: tabName}).first();
  if (await tab.isVisible().catch(() => false)) {
    const selected = await tab.getAttribute('aria-selected');
    if (selected === 'true') {
      return true;
    }
  }

  const activeLabel = await readActiveSectionLabel(page);
  return sectionLabelMatches(activeLabel, section, match);
}

async function clickMobileSectionStep(
  page: Page,
  direction: 'next' | 'back'
): Promise<boolean> {
  const button = page
    .getByRole('button', {name: direction === 'next' ? /^Next$/i : /^Back$/i})
    .first();

  if (!(await button.isVisible().catch(() => false))) {
    return false;
  }
  if (await button.isDisabled()) {
    return false;
  }

  await button.click();
  await page.waitForTimeout(300);
  return true;
}

const MAX_MOBILE_SECTION_STEPS = 20;

async function navigateViaMobileStepper(
  page: Page,
  section: string,
  match: 'label' | 'id',
  direction: 'next' | 'back',
  deadline: number
): Promise<boolean> {
  for (let i = 0; i < MAX_MOBILE_SECTION_STEPS; i += 1) {
    if (Date.now() >= deadline) {
      return false;
    }
    if (await isOnTargetSection(page, section, match)) {
      return true;
    }
    if (!(await clickMobileSectionStep(page, direction))) {
      return false;
    }
  }

  return isOnTargetSection(page, section, match);
}

async function runNavigateSection(
  page: Page,
  step: Extract<CollectionStep, {action: 'navigate_section'}>,
  timeoutMs: number
): Promise<void> {
  const match = step.match ?? 'label';
  const tabName = sectionNameMatcher(step.section, match);
  const deadline = Date.now() + timeoutMs;

  if (await isOnTargetSection(page, step.section, match)) {
    return;
  }

  const tab = page.getByRole('tab', {name: tabName}).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(300);
    if (await isOnTargetSection(page, step.section, match)) {
      return;
    }
  }

  if (
    await navigateViaMobileStepper(page, step.section, match, 'next', deadline)
  ) {
    return;
  }
  if (
    await navigateViaMobileStepper(page, step.section, match, 'back', deadline)
  ) {
    return;
  }

  throw new Error(`timeout navigating to section "${step.section}"`);
}

async function runScrollToField(
  page: Page,
  step: Extract<CollectionStep, {action: 'scroll_to_field'}>,
  timeoutMs: number
): Promise<void> {
  await waitForFieldVisible(page, step.field, timeoutMs);
}

async function runWaitSave(page: Page, timeoutMs: number): Promise<void> {
  const saved = saveRecordIndicator(page);
  await saved.waitFor({timeout: timeoutMs});
}

async function runFinish(
  page: Page,
  ctx: SessionContext,
  step: Extract<CollectionStep, {action: 'finish'}>,
  timeoutMs: number
): Promise<void> {
  const strategy = step.strategy ?? 'finish_anyway';

  if (strategy === 'go_back') {
    await page.goBack({waitUntil: 'domcontentloaded'}).catch(async () => {
      await page.goto(getNotebookUrl(ctx.env), {waitUntil: 'domcontentloaded'});
    });
    return;
  }

  const finishBtn = finishRecordButton(page);
  if (!(await finishBtn.count())) {
    await page.goBack({waitUntil: 'domcontentloaded'}).catch(async () => {
      await page.goto(getNotebookUrl(ctx.env), {waitUntil: 'domcontentloaded'});
    });
    return;
  }

  await finishBtn.click();

  const finishAnyway = finishAnywayButton(page);
  const guarded = await finishAnyway
    .waitFor({timeout: 5000})
    .then(() => true)
    .catch(() => false);

  if (guarded) {
    if (strategy === 'complete') {
      throw new Error('finish guard dialog appeared (incomplete record)');
    }
    await finishAnyway.click();
  } else if (strategy === 'complete') {
    // No guard — record is complete.
  }

  await addRecordButton(page)
    .waitFor({timeout: timeoutMs})
    .catch(() => undefined);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function executeStep(
  page: Page,
  ctx: SessionContext,
  step: CollectionStep,
  templateContext: TemplateContext,
  stepIndex: number
): Promise<void> {
  const timeoutMs = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;

  await withStepRetry(step, async () => {
    switch (step.action) {
      case 'fill':
        await runFill(page, step, templateContext, timeoutMs);
        break;
      case 'select':
        await runSelect(page, step, timeoutMs);
        break;
      case 'toggle':
        await runToggle(page, step, timeoutMs);
        break;
      case 'navigate_section':
        await runNavigateSection(page, step, timeoutMs);
        break;
      case 'scroll_to_field':
        await runScrollToField(page, step, timeoutMs);
        break;
      case 'wait':
        await sleep(step.ms);
        break;
      case 'wait_save':
        await runWaitSave(page, timeoutMs);
        break;
      case 'finish':
        await runFinish(page, ctx, step, timeoutMs);
        break;
      case 'group':
        await executeSteps(page, ctx, step.steps, templateContext);
        break;
    }
  });

  sessionLog(
    ctx.sessionId,
    `collection step ok: ${stepLabel(step, stepIndex)} (${step.action})`
  );
}

async function executeSteps(
  page: Page,
  ctx: SessionContext,
  steps: CollectionStep[],
  templateContext: TemplateContext
): Promise<ExecuteProfileResult> {
  let stepsCompleted = 0;
  let stepsFailed = 0;
  let finished = false;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]!;
    try {
      await executeStep(page, ctx, step, templateContext, i);
      stepsCompleted += 1;
      if (step.action === 'finish') {
        finished = true;
      }
    } catch (err) {
      stepsFailed += 1;
      sessionLog(
        ctx.sessionId,
        `collection step failed: ${stepLabel(step, i)} — ${(err as Error).message}`
      );
      if (step.optional) {
        continue;
      }
      throw err;
    }
  }

  return {stepsCompleted, stepsFailed, finished};
}

async function recoverFromRecordFailure(
  page: Page,
  ctx: SessionContext,
  onFailure: CollectionProfile['onFailure']
): Promise<boolean> {
  if (onFailure === 'skip_record') {
    await page.goto(getNotebookUrl(ctx.env), {
      waitUntil: 'domcontentloaded',
    }).catch(() => undefined);
    return false;
  }

  if (onFailure === 'finish_anyway') {
    try {
      await runFinish(
        page,
        ctx,
        {action: 'finish', strategy: 'finish_anyway'},
        DEFAULT_STEP_TIMEOUT_MS
      );
      return true;
    } catch {
      await page.goto(getNotebookUrl(ctx.env), {
        waitUntil: 'domcontentloaded',
      }).catch(() => undefined);
      return false;
    }
  }

  // abort_record — return to notebook list without counting as success.
  await page.goto(getNotebookUrl(ctx.env), {
    waitUntil: 'domcontentloaded',
  }).catch(() => undefined);
  return false;
}

/** Click add-record, run the profile workflow, and return to the notebook list. */
export async function executeCollectionProfile(
  page: Page,
  ctx: SessionContext,
  profile: CollectionProfile,
  options: ExecuteProfileOptions
): Promise<ExecuteProfileResult | null> {
  const addBtn = addRecordButton(page, profile.formType);
  if (!(await addBtn.count())) {
    sessionLog(ctx.sessionId, 'add-record-button not found');
    return null;
  }

  await addBtn.first().click();
  await page.waitForTimeout(1000);

  const templateContext: TemplateContext = {
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    recordIndex: options.recordIndex,
  };

  try {
    const result = await executeSteps(
      page,
      ctx,
      profile.record.steps,
      templateContext
    );

    if (!result.finished) {
      await runFinish(
        page,
        ctx,
        {action: 'finish', strategy: 'finish_anyway'},
        DEFAULT_STEP_TIMEOUT_MS
      );
      result.finished = true;
    }

    return result;
  } catch (err) {
    sessionLog(
      ctx.sessionId,
      `collection profile failed (${profile.name ?? 'unnamed'}): ${(err as Error).message}`
    );
    const recovered = await recoverFromRecordFailure(
      page,
      ctx,
      profile.onFailure
    );
    if (!recovered) {
      return null;
    }
    return {stepsCompleted: 0, stepsFailed: 1, finished: true};
  }
}
