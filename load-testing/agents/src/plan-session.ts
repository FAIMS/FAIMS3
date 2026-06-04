import type {ActiveStep} from '@faims3/load-testing-shared';
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

async function waitForRunningStep(
  client: CoordinatorClient,
  agentId: string,
  sessionId: string
): Promise<ActiveStep | null> {
  while (true) {
    const {runState, step} = await client.getStep(agentId);
    if (runState === 'complete') {
      return null;
    }
    if (runState === 'running' && step) {
      return step;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
    sessionLog(sessionId, `waiting for plan start (runState=${runState})…`);
  }
}

function isNewStepInstance(completed: ActiveStep, next: ActiveStep): boolean {
  return completed.id !== next.id || completed.startedAt !== next.startedAt;
}

async function waitForNextStep(
  client: CoordinatorClient,
  agentId: string,
  completedStep: ActiveStep
): Promise<ActiveStep | null> {
  while (true) {
    const {runState, step} = await client.getStep(agentId);
    if (runState === 'complete' || !step) {
      return null;
    }
    if (isNewStepInstance(completedStep, step)) {
      return step;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

async function runPlanStep(
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
      const onboarding = await runOnboarding(page, ctx);
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
    await runPlanStep(step, page, context, cdp, metricBuffer, ctx);
    await client.stepComplete({
      agentId: ctx.agentId,
      stepId: step.id,
      sessionCount: 1,
    });
    step = await waitForNextStep(client, ctx.agentId, step);
  }
}
