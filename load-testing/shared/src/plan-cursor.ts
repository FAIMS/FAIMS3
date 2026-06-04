import {assignSplitBranch} from './split-assignment';
import type {PhaseStep, SequenceNode, SequencePlan, SplitStep} from './sequence-plan';

export interface CursorFrame {
  steps: SequenceNode[];
  index: number;
  loopLeft?: number;
  loopBody?: SequenceNode[];
  splitId?: string;
  branchId?: string;
}

export interface AgentCursor {
  frames: CursorFrame[];
  splitBranches: Record<string, string>;
}

export function createAgentCursor(plan: SequencePlan): AgentCursor {
  return {
    frames: [{steps: plan.steps, index: 0}],
    splitBranches: {},
  };
}

function isPhaseStep(node: SequenceNode): node is PhaseStep {
  return 'kind' in node;
}

function isLoopStep(
  node: SequenceNode
): node is SequenceNode & {loop: {count: number; steps: SequenceNode[]}} {
  return 'loop' in node;
}

function isSplitStep(node: SequenceNode): node is SplitStep {
  return 'split' in node;
}

/** Resolve the active phase step for an agent cursor (descends loop/split). */
export function resolvePhaseStep(
  cursor: AgentCursor,
  agentIndex: number,
  agentId: string,
  testRunId: string
): PhaseStep | null {
  while (true) {
    const frame = cursor.frames[cursor.frames.length - 1];
    if (!frame) {
      return null;
    }

    if (frame.index >= frame.steps.length) {
      if (!popFrame(cursor)) {
        return null;
      }
      continue;
    }

    const node = frame.steps[frame.index]!;

    if (isPhaseStep(node)) {
      return node;
    }

    if (isLoopStep(node)) {
      cursor.frames.push({
        steps: node.loop.steps,
        index: 0,
        loopLeft: node.loop.count,
        loopBody: node.loop.steps,
      });
      continue;
    }

    if (isSplitStep(node)) {
      let branchId = cursor.splitBranches[node.id];
      if (!branchId) {
        branchId = assignSplitBranch(node, agentIndex, agentId, testRunId);
        cursor.splitBranches[node.id] = branchId;
      }
      const branch = node.split.branches.find(b => b.id === branchId);
      if (!branch) {
        throw new Error(`split ${node.id}: unknown branch ${branchId}`);
      }
      cursor.frames.push({
        steps: branch.steps,
        index: 0,
        splitId: node.id,
        branchId,
      });
      frame.index += 1;
      continue;
    }
  }
}

function popFrame(cursor: AgentCursor): boolean {
  const frame = cursor.frames.pop();
  if (!frame) {
    return false;
  }

  if (frame.loopLeft !== undefined && frame.loopBody) {
    const remaining = frame.loopLeft - 1;
    if (remaining > 0) {
      cursor.frames.push({
        steps: frame.loopBody,
        index: 0,
        loopLeft: remaining,
        loopBody: frame.loopBody,
      });
    } else {
      const parent = cursor.frames[cursor.frames.length - 1];
      if (parent) {
        parent.index += 1;
      }
    }
    return cursor.frames.length > 0;
  }

  const parent = cursor.frames[cursor.frames.length - 1];
  if (parent) {
    parent.index += 1;
  }
  return cursor.frames.length > 0;
}

/** Advance past the current phase step after it completes. */
export function advancePastPhaseStep(cursor: AgentCursor): void {
  const frame = cursor.frames[cursor.frames.length - 1];
  if (!frame || frame.index >= frame.steps.length) {
    return;
  }
  const node = frame.steps[frame.index];
  if (node && isPhaseStep(node)) {
    frame.index += 1;
    while (
      cursor.frames.length > 0 &&
      cursor.frames[cursor.frames.length - 1]!.index >=
        cursor.frames[cursor.frames.length - 1]!.steps.length
    ) {
      if (!popFrame(cursor)) {
        break;
      }
    }
  }
}

export function isPlanComplete(cursor: AgentCursor): boolean {
  while (
    cursor.frames.length > 0 &&
    cursor.frames[cursor.frames.length - 1]!.index >=
      cursor.frames[cursor.frames.length - 1]!.steps.length
  ) {
    if (!popFrame(cursor)) {
      break;
    }
  }
  return cursor.frames.length === 0;
}
