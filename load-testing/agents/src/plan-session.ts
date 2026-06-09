import type {ActiveStep, StepCompleteRequest} from '@faims3/load-testing-shared';
import type {BrowserContext, CDPSession, Page} from 'playwright';
import {CoordinatorClient} from '@faims3/load-testing-shared';
import type {MetricBuffer} from './metric-buffer.js';
import {sessionLog} from './session-log.js';
import type {SessionContext} from './types.js';
import {runExportStressStep} from './scenarios/export-stress-step.js';
import {runOfflineCollection} from './scenarios/offline-collection.js';
import {runOnlineCollection} from './scenarios/online-collection.js';
import {runOnboarding} from './scenarios/onboarding.js';
import {runPatchyNetwork} from './scenarios/patchy-network.js';

const POLL_MS = 3000;
const COORDINATOR_RETRY_BASE_MS = 500;
const COORDINATOR_RETRY_MAX_MS = 5000;
const COORDINATOR_WARN_INTERVAL_MS = 30_000;

/** Promise-based delay for coordinator polling. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Retry coordinator calls indefinitely with exponential backoff. */
async function withCoordinatorRetry<T>(
  sessionId: string,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  let attempt = 0;
  let lastWarnAt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const now = Date.now();
      if (now - lastWarnAt >= COORDINATOR_WARN_INTERVAL_MS) {
        sessionLog(
          sessionId,
          `coordinator ${label} failed (${(err as Error).message}) — retrying`
        );
        lastWarnAt = now;
      }
      const backoff = Math.min(
        COORDINATOR_RETRY_MAX_MS,
        COORDINATOR_RETRY_BASE_MS * attempt
      );
      await sleep(backoff);
    }
  }
}

/** Poll `/step` with resilient retries. */
async function getStepResilient(
  client: CoordinatorClient,
  agentId: string,
  sessionId: string
) {
  return withCoordinatorRetry(sessionId, 'getStep', () =>
    client.getStep(agentId)
  );
}

/** Post `/step-complete` with resilient retries. */
async function stepCompleteResilient(
  client: CoordinatorClient,
  body: StepCompleteRequest,
  sessionId: string
) {
  return withCoordinatorRetry(sessionId, 'stepComplete', () =>
    client.stepComplete(body)
  );
}

/** Block until the coordinator run is `running` and returns a step. */
async function waitForRunningStep(
  client: CoordinatorClient,
  agentId: string,
  sessionId: string
): Promise<ActiveStep | null> {
  while (true) {
    const {runState, step} = await getStepResilient(client, agentId, sessionId);
    if (runState === 'complete') {
      return null;
    }
    if (runState === 'running' && step) {
      return step;
    }
    await sleep(POLL_MS);
    sessionLog(sessionId, `waiting for plan start (runState=${runState})…`);
  }
}

/** True when the coordinator advanced to a new step instance (id or startedAt). */
function isNewStepInstance(completed: ActiveStep, next: ActiveStep): boolean {
  return completed.id !== next.id || completed.startedAt !== next.startedAt;
}

/** Poll until the coordinator assigns the next step after completion. */
async function waitForNextStep(
  client: CoordinatorClient,
  agentId: string,
  sessionId: string,
  completedStep: ActiveStep
): Promise<ActiveStep | null> {
  while (true) {
    const {runState, step} = await getStepResilient(client, agentId, sessionId);
    if (runState === 'complete' || !step) {
      return null;
    }
    if (isNewStepInstance(completedStep, step)) {
      return step;
    }
    await sleep(POLL_MS);
  }
}

/** Dispatch a single phase step to the matching scenario handler. */
async function runPlanStep(
  client: CoordinatorClient,
  step: ActiveStep,
  page: Page,
  context: BrowserContext,
  cdp: CDPSession,
  metricBuffer: MetricBuffer,
  ctx: SessionContext
): Promise<void> {
  sessionLog(
    ctx.sessionId,
    `running step ${step.id} (${step.kind})${step.branchId ? ` branch=${step.branchId}` : ''}`
  );

  switch (step.kind) {
    case 'onboarding': {
      const onboarding = await runOnboarding(page, ctx, client);
      ctx.jwtToken = onboarding.jwtToken;
      break;
    }
    case 'online_collection':
      await runOnlineCollection(page, metricBuffer, ctx, step);
      break;
    case 'offline_collection':
      await runOfflineCollection(page, context, cdp, metricBuffer, ctx, step);
      break;
    case 'patchy_network':
      await runPatchyNetwork(page, context, metricBuffer, ctx, step);
      break;
    case 'export_stress':
      await runExportStressStep(metricBuffer, ctx, step);
      break;
    default:
      throw new Error(`unknown step kind: ${(step as ActiveStep).kind}`);
  }
}

/** Main session loop: run steps until the coordinator reports plan complete. */
export async function executeSequencePlan(
  client: CoordinatorClient,
  page: Page,
  context: BrowserContext,
  cdp: CDPSession,
  metricBuffer: MetricBuffer,
  ctx: SessionContext
): Promise<void> {
  let step = await waitForRunningStep(client, ctx.agentId, ctx.sessionId);
  while (step) {
    metricBuffer.setStepId(step.id);
    await runPlanStep(client, step, page, context, cdp, metricBuffer, ctx);
    await stepCompleteResilient(
      client,
      {
        agentId: ctx.agentId,
        stepId: step.id,
        sessionCount: 1,
      },
      ctx.sessionId
    );
    step = await waitForNextStep(client, ctx.agentId, ctx.sessionId, step);
  }
}
