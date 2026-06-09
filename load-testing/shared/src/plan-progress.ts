import type {PhaseStep, SequenceNode, SequencePlan, StepAdvanceMode} from './sequence-plan';

export interface PlanTimelineStep {
  id: string;
  kind?: PhaseStep['kind'];
  label?: string;
  durationMs: number;
  advance?: StepAdvanceMode;
  structural?: 'loop' | 'split';
  loopCount?: number;
}

export interface PlanAnalysis {
  name?: string;
  /** Best-effort wall-clock estimate (ms). Onboarding/export without duration excluded or defaulted. */
  estimatedDurationMs: number;
  /** Leaf phase steps in plan order (loops expanded). */
  timeline: PlanTimelineStep[];
  leafPhaseCount: number;
}

const DEFAULT_ONBOARDING_MS = 120_000;

/** Type guard for leaf phase steps. */
function isPhaseStep(node: SequenceNode): node is PhaseStep {
  return 'kind' in node;
}

/** Effective duration for a phase; onboarding defaults when unset. */
function stepDurationMs(step: PhaseStep): number {
  if (step.durationMs !== undefined) {
    return step.durationMs;
  }
  if (step.kind === 'onboarding') {
    return DEFAULT_ONBOARDING_MS;
  }
  return 0;
}

/** Sum phase durations; loops multiply, splits take the longest branch. */
function estimateNodes(nodes: SequenceNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (isPhaseStep(node)) {
      total += stepDurationMs(node);
    } else if ('loop' in node) {
      total += node.loop.count * estimateNodes(node.loop.steps);
    } else if ('split' in node) {
      const branchTotals = node.split.branches.map(b => estimateNodes(b.steps));
      total += Math.max(0, ...branchTotals);
    }
  }
  return total;
}

/** Build a flat timeline with loop/split structural markers for status UI. */
function flattenNodes(
  nodes: SequenceNode[],
  out: PlanTimelineStep[],
  loopMultiplier = 1
): void {
  for (const node of nodes) {
    if (isPhaseStep(node)) {
      for (let i = 0; i < loopMultiplier; i += 1) {
        out.push({
          id: node.id,
          kind: node.kind,
          label: node.label,
          durationMs: stepDurationMs(node),
          advance: node.advance,
        });
      }
    } else if ('loop' in node) {
      out.push({
        id: node.id,
        label: node.label,
        durationMs: node.loop.count * estimateNodes(node.loop.steps),
        structural: 'loop',
        loopCount: node.loop.count,
      });
      for (let i = 0; i < node.loop.count; i += 1) {
        flattenNodes(node.loop.steps, out, 1);
      }
    } else if ('split' in node) {
      const branchTotals = node.split.branches.map(b => estimateNodes(b.steps));
      out.push({
        id: node.id,
        label: node.label,
        durationMs: Math.max(0, ...branchTotals),
        structural: 'split',
      });
      for (const branch of node.split.branches) {
        flattenNodes(branch.steps, out, loopMultiplier);
      }
    }
  }
}

/** Analyse a sequence plan for duration estimates and timeline display. */
export function analyzePlan(plan: SequencePlan): PlanAnalysis {
  const timeline: PlanTimelineStep[] = [];
  flattenNodes(plan.steps, timeline);
  const leafPhaseCount = timeline.filter(t => !t.structural).length;
  return {
    name: plan.name,
    estimatedDurationMs: estimateNodes(plan.steps),
    timeline,
    leafPhaseCount,
  };
}

/** Format milliseconds as a compact human string (e.g. `5m30s`, `1h2m3s`). */
export function formatDurationMs(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}h${m}m${s}s`;
  }
  if (m > 0) {
    return `${m}m${s}s`;
  }
  return `${s}s`;
}
