import type {PlanAnalysis} from '@faims3/load-testing-shared';
import {
  isPlanComplete,
  resolvePhaseStep,
} from '@faims3/load-testing-shared';
import type {
  ActiveStep,
  RunState,
  StatusResponse,
} from '@faims3/load-testing-shared';
import type {PlanEngine} from './plan-engine';
import type {Registry} from './registry';

export interface BuildStatusOptions {
  engine: PlanEngine;
  registry: Registry;
  planAnalysis: PlanAnalysis;
  now?: number;
}

/** Composite key for grouping agents on the same active step instance. */
function groupKey(step: ActiveStep): string {
  return `${step.id}|${step.kind}|${step.branchId ?? ''}`;
}

/** Assemble `/status` JSON from engine state, registry counts, and plan analysis. */
export function buildStatusReport(options: BuildStatusOptions): StatusResponse {
  const {engine, registry, planAnalysis} = options;
  const now = options.now ?? Date.now();
  const runState = engine.getRunState();
  const runStartedAt = engine.getRunStartedAt();
  const startedAt = engine.getStartedAt();

  const elapsedMs =
    runState === 'running' || runState === 'complete'
      ? runStartedAt !== null
        ? now - runStartedAt
        : now - startedAt
      : now - startedAt;

  const estimatedDurationMs = planAnalysis.estimatedDurationMs;
  const estimatedRemainingMs = Math.max(0, estimatedDurationMs - elapsedMs);
  const progressPercent =
    estimatedDurationMs > 0
      ? Math.min(100, Math.round((elapsedMs / estimatedDurationMs) * 100))
      : undefined;

  const completedSteps = engine.getCompletedSteps();
  const barriers = engine.getActiveBarriers();
  const agentDetails = engine.getAgentDetails();

  const activeStepGroups = new Map<
    string,
    {
      step: ActiveStep;
      agentIds: string[];
    }
  >();

  for (const detail of agentDetails) {
    if (detail.done || !detail.step) continue;
    const key = groupKey(detail.step);
    const existing = activeStepGroups.get(key);
    if (existing) {
      existing.agentIds.push(detail.agentId);
    } else {
      activeStepGroups.set(key, {
        step: detail.step,
        agentIds: [detail.agentId],
      });
    }
  }

  const activeSteps = [...activeStepGroups.values()].map(({step, agentIds}) => {
    const barrier = barriers.find(b => b.stepId === step.id);
    const remainingMs =
      step.endsAt !== undefined ? Math.max(0, step.endsAt - now) : undefined;
    return {
      stepId: step.id,
      kind: step.kind,
      label: step.label,
      branchId: step.branchId,
      advance: step.advance,
      startedAt: step.startedAt,
      endsAt: step.endsAt,
      remainingMs,
      agentCount: agentIds.length,
      agentIds,
      barrier: barrier
        ? {
            advance: barrier.advance,
            completedAgents: barrier.completedAgents,
            totalAgents: barrier.totalAgents,
            waitingOn: barrier.waitingOn,
          }
        : undefined,
    };
  });

  const splitSummary = new Map<
    string,
    {branchId: string; stepId: string; kind: string; agentIds: string[]}
  >();
  for (const detail of agentDetails) {
    if (!detail.branchId || !detail.step) continue;
    const key = detail.branchId;
    const existing = splitSummary.get(key);
    if (existing) {
      existing.agentIds.push(detail.agentId);
    } else {
      splitSummary.set(key, {
        branchId: detail.branchId,
        stepId: detail.step.id,
        kind: detail.step.kind,
        agentIds: [detail.agentId],
      });
    }
  }

  const activeStepsLegacy: Record<string, string> = {};
  for (const detail of agentDetails) {
    if (detail.stepId) {
      activeStepsLegacy[detail.agentId] = detail.stepId;
    }
  }

  return {
    runState,
    planName: planAnalysis.name ?? engine.getPlan().name,
    registeredAgents: registry.registeredCount(),
    readyAgents: registry.readyCount(),
    doneAgents: registry.agentsDoneCount(),
    expectedAgents: registry.getExpectedAgentCount(),
    testRunId: engine.getTestRunId(),
    startedAt,
    runStartedAt,
    elapsedMs,
    estimatedDurationMs,
    estimatedRemainingMs,
    progressPercent,
    metricsReceived: 0,
    activeSteps: activeStepsLegacy,
    completedSteps,
    activeStepGroups: activeSteps,
    splitSummary: [...splitSummary.values()].map(s => ({
      branchId: s.branchId,
      stepId: s.stepId,
      kind: s.kind,
      agentCount: s.agentIds.length,
      agentIds: s.agentIds,
    })),
    agents: agentDetails,
    planTimeline: planAnalysis.timeline,
    health: 'ok' as const,
  };
}
