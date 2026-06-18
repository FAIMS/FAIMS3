import {
  advancePastPhaseStep,
  createAgentCursor,
  isPlanComplete,
  resolvePhaseStep,
  type AgentCursor,
} from '@faims3/load-testing-shared';
import type {
  ActiveStep,
  RunState,
  StepAdvanceMode,
} from '@faims3/load-testing-shared';
import type {PhaseStep, SequencePlan} from '@faims3/load-testing-shared';

export interface PlanEngineConfig {
  expectedAgentCount: number;
  readinessTimeoutMs: number;
}

interface AgentRuntime {
  agentId: string;
  index: number;
  cursor: AgentCursor;
  ready: boolean;
  done: boolean;
  blockedOnStepId: string | null;
}

export interface CompletedStepRecord {
  stepId: string;
  kind: string;
  completedAt: number;
  agentCount: number;
}

export interface ActiveBarrierInfo {
  stepId: string;
  advance: StepAdvanceMode;
  startedAt: number;
  durationMs?: number;
  endsAt?: number;
  completedAgents: number;
  totalAgents: number;
  waitingOn: string;
}

export interface AgentDetail {
  agentId: string;
  index: number;
  ready: boolean;
  done: boolean;
  stepId?: string;
  stepKind?: string;
  branchId?: string;
  blockedOnStepId?: string | null;
  step?: ActiveStep | null;
}

interface StepBarrier {
  stepId: string;
  advance: StepAdvanceMode;
  startedAt: number;
  durationMs?: number;
  completed: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
}

export type PlanChangeReason =
  | 'run_started'
  | 'run_completed'
  | 'step_completed';

export interface PlanChangeEvent {
  runState: RunState;
  advancedAt: number;
  testRunId: string;
  reason: PlanChangeReason;
  stepId?: string;
  stepKind?: string;
  runStartTrigger?: 'all_ready' | 'timeout';
}

export type PlanChangeListener = (event: PlanChangeEvent) => void;

/** True when a step barrier should schedule a wall-clock release timer. */
function needsTimer(advance: StepAdvanceMode): boolean {
  return advance === 'timer' || advance === 'timer_or_all_done';
}

/** True when enough agents reported step-complete for the advance mode. */
function barrierSatisfied(
  barrier: StepBarrier,
  agentCount: number,
  strategy: 'all' | 'majority'
): boolean {
  const count = barrier.completed.size;
  if (strategy === 'majority') {
    return count > agentCount / 2;
  }
  return count >= agentCount;
}

/**
 * Drives sequence plan execution: per-agent cursors, step barriers,
 * and run lifecycle (waiting → running → complete).
 */
export class PlanEngine {
  private readonly plan: SequencePlan;
  private readonly testRunId: string;
  private readonly config: PlanEngineConfig;
  private readonly listeners: PlanChangeListener[] = [];
  private agents = new Map<string, AgentRuntime>();
  private barriers = new Map<string, StepBarrier>();
  private runState: RunState = 'waiting_for_agents';
  private advancedAt = Date.now();
  private startedAt = Date.now();
  private runStartedAt: number | null = null;
  private completedSteps: CompletedStepRecord[] = [];
  private readinessTimer: ReturnType<typeof setTimeout> | null = null;
  private nextAgentIndex = 0;

  /** @param plan Resolved sequence plan with inlined collection profiles. */
  constructor(
    plan: SequencePlan,
    testRunId: string,
    config: PlanEngineConfig
  ) {
    this.plan = plan;
    this.testRunId = testRunId;
    this.config = config;
  }

  /** Subscribe to run start, step completion, and run completion events. */
  onPlanChange(listener: PlanChangeListener): void {
    this.listeners.push(listener);
  }

  /** The loaded sequence plan (profiles already resolved). */
  getPlan(): SequencePlan {
    return this.plan;
  }

  /** Current run lifecycle state. */
  getRunState(): RunState {
    return this.runState;
  }

  /** Timestamp of the last plan advance (run start or step barrier release). */
  getAdvancedAt(): number {
    return this.advancedAt;
  }

  /** Coordinator process start time (before agents are ready). */
  getStartedAt(): number {
    return this.startedAt;
  }

  /** Wall-clock time the run entered `running`, or null while waiting. */
  getRunStartedAt(): number | null {
    return this.runStartedAt;
  }

  /** Steps whose barriers have been released, in completion order. */
  getCompletedSteps(): CompletedStepRecord[] {
    return [...this.completedSteps];
  }

  /** Open step barriers and their agent-completion progress. */
  getActiveBarriers(): ActiveBarrierInfo[] {
    const now = Date.now();
    const total = this.agents.size;
    return [...this.barriers.values()].map(barrier => {
      const completed = barrier.completed.size;
      let waitingOn = 'agents';
      if (barrier.advance === 'timer') {
        waitingOn = 'timer';
      } else if (barrier.advance === 'timer_or_all_done' && completed < total) {
        waitingOn = completed > 0 ? 'timer_or_agents' : 'timer_or_agents';
      }
      return {
        stepId: barrier.stepId,
        advance: barrier.advance,
        startedAt: barrier.startedAt,
        durationMs: barrier.durationMs,
        endsAt:
          barrier.durationMs !== undefined
            ? barrier.startedAt + barrier.durationMs
            : undefined,
        completedAgents: completed,
        totalAgents: total,
        waitingOn,
      };
    });
  }

  /** Per-agent cursor position, active step, and blocked state for status UI. */
  getAgentDetails(): AgentDetail[] {
    return [...this.agents.values()].map(agent => {
      let step: ActiveStep | null = null;
      let phase = null;
      if (this.runState === 'running' && !agent.done && !isPlanComplete(agent.cursor)) {
        phase = resolvePhaseStep(
          agent.cursor,
          agent.index,
          agent.agentId,
          this.testRunId
        );
        if (phase) {
          step = this.toActiveStep(agent, phase);
        }
      }
      return {
        agentId: agent.agentId,
        index: agent.index,
        ready: agent.ready,
        done: agent.done,
        stepId: step?.id ?? phase?.id,
        stepKind: step?.kind ?? phase?.kind,
        branchId: step?.branchId,
        blockedOnStepId: agent.blockedOnStepId,
        step,
      };
    });
  }

  /** Test run id propagated to agents and metrics. */
  getTestRunId(): string {
    return this.testRunId;
  }

  /** Initialise per-agent cursor when `/register` is called. */
  registerAgent(agentId: string): void {
    this.agents.set(agentId, {
      agentId,
      index: this.nextAgentIndex++,
      cursor: createAgentCursor(this.plan),
      ready: false,
      done: false,
      blockedOnStepId: null,
    });
  }

  /** Mark agent ready and attempt to start the run. */
  markReady(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.ready = true;
    }
    this.tryStartRun();
  }

  /** Mark agent finished and attempt to complete the run. */
  markAgentDone(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.done = true;
    }
    this.tryCompleteRun();
  }

  /** Agents registered with the plan engine. */
  registeredCount(): number {
    return this.agents.size;
  }

  /** Agents marked ready in the plan engine. */
  readyCount(): number {
    return [...this.agents.values()].filter(a => a.ready).length;
  }

  /** Agents that finished the full plan. */
  doneCount(): number {
    return [...this.agents.values()].filter(a => a.done).length;
  }

  /** True when expected agent count is registered and all are ready. */
  allAgentsReady(): boolean {
    if (this.agents.size < this.config.expectedAgentCount) return false;
    return [...this.agents.values()].every(a => a.ready);
  }

  /** True when every registered agent reported plan completion. */
  allAgentsDone(): boolean {
    if (this.agents.size === 0) return false;
    return [...this.agents.values()].every(a => a.done);
  }

  /** Start timer to begin run even if not all agents register in time. */
  startReadinessTimeout(): void {
    this.readinessTimer = setTimeout(() => {
      if (this.runState === 'waiting_for_agents') {
        this.beginRun('timeout');
      }
    }, this.config.readinessTimeoutMs);
  }

  /** Resolve the active phase step for an agent, including barrier timing. */
  getStep(agentId: string): ActiveStep | null {
    const agent = this.agents.get(agentId);
    if (!agent || this.runState !== 'running') {
      return null;
    }
    if (isPlanComplete(agent.cursor)) {
      return null;
    }

    const phase = resolvePhaseStep(
      agent.cursor,
      agent.index,
      agent.agentId,
      this.testRunId
    );
    if (!phase) {
      return null;
    }

    // Agent finished step but barrier not released — still expose blocked step timing.
    if (agent.blockedOnStepId && agent.blockedOnStepId !== phase.id) {
      const blocked = this.getBarrierStep(agent.blockedOnStepId, phase);
      return blocked;
    }

    this.ensureBarrier(agent, phase);
    return this.toActiveStep(agent, phase);
  }

  /** Record agent step completion; may release barrier for all agents. */
  completeStep(agentId: string, stepId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || this.runState !== 'running') {
      return false;
    }

    const phase = resolvePhaseStep(
      agent.cursor,
      agent.index,
      agent.agentId,
      this.testRunId
    );
    if (!phase || phase.id !== stepId) {
      return false;
    }

    const barrier = this.barriers.get(stepId);
    if (!barrier) {
      this.ensureBarrier(agent, phase);
    }
    const b = this.barriers.get(stepId)!;
    b.completed.add(agentId);

    if (this.shouldReleaseBarrier(b)) {
      this.releaseBarrier(stepId);
    } else {
      agent.blockedOnStepId = stepId;
    }

    return true;
  }

  /** Map of agentId → current step id for legacy status fields. */
  getActiveStepSummary(): Record<string, string> {
    const summary: Record<string, string> = {};
    for (const agent of this.agents.values()) {
      const phase = resolvePhaseStep(
        agent.cursor,
        agent.index,
        agent.agentId,
        this.testRunId
      );
      if (phase) {
        summary[agent.agentId] = phase.id;
      }
    }
    return summary;
  }

  /** Transition to `running` when all expected agents are ready. */
  private tryStartRun(): void {
    if (this.runState !== 'waiting_for_agents') return;
    if (this.allAgentsReady()) {
      this.beginRun('all_ready');
    }
  }

  /** Enter `running` state and emit a run_started event. */
  private beginRun(trigger: 'all_ready' | 'timeout'): void {
    if (this.readinessTimer) {
      clearTimeout(this.readinessTimer);
      this.readinessTimer = null;
    }
    this.runState = 'running';
    this.runStartedAt = Date.now();
    this.advancedAt = this.runStartedAt;
    this.emitChange('run_started', {runStartTrigger: trigger});
  }

  /** Transition to `complete` when every agent has finished the plan. */
  private tryCompleteRun(): void {
    if (this.runState !== 'running') return;
    if (!this.allAgentsDone()) return;
    this.runState = 'complete';
    this.advancedAt = Date.now();
    this.emitChange('run_completed');
    for (const barrier of this.barriers.values()) {
      if (barrier.timer) clearTimeout(barrier.timer);
    }
    this.barriers.clear();
  }

  /** Notify listeners of a plan lifecycle change. */
  private emitChange(
    reason: PlanChangeReason,
    extra?: {
      stepId?: string;
      stepKind?: string;
      runStartTrigger?: 'all_ready' | 'timeout';
    }
  ): void {
    const event: PlanChangeEvent = {
      runState: this.runState,
      advancedAt: this.advancedAt,
      testRunId: this.testRunId,
      reason,
      stepId: extra?.stepId,
      stepKind: extra?.stepKind,
      runStartTrigger: extra?.runStartTrigger,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Create a step barrier (and timer) on first agent access to a phase. */
  private ensureBarrier(agent: AgentRuntime, phase: PhaseStep): void {
    if (this.barriers.has(phase.id)) {
      return;
    }
    const advance = phase.advance ?? 'timer';
    const barrier: StepBarrier = {
      stepId: phase.id,
      advance,
      startedAt: Date.now(),
      durationMs: phase.durationMs,
      completed: new Set(),
      timer: null,
    };
    this.barriers.set(phase.id, barrier);

    if (needsTimer(advance) && phase.durationMs) {
      barrier.timer = setTimeout(() => {
        this.releaseBarrier(phase.id);
      }, phase.durationMs);
    }
  }

  /** True when agent-completion count satisfies the step advance mode. */
  private shouldReleaseBarrier(barrier: StepBarrier): boolean {
    const agentCount = this.agents.size;
    switch (barrier.advance) {
      case 'timer':
        return false;
      case 'majority_done':
        return barrierSatisfied(barrier, agentCount, 'majority');
      case 'timer_or_all_done':
        return barrierSatisfied(barrier, agentCount, 'all');
      case 'all_agents_done':
      default:
        return barrierSatisfied(barrier, agentCount, 'all');
    }
  }

  /** Advance all agents past a step and emit step_completed. */
  private releaseBarrier(stepId: string): void {
    const barrier = this.barriers.get(stepId);
    if (!barrier) return;

    if (barrier.timer) {
      clearTimeout(barrier.timer);
    }
    this.barriers.delete(stepId);

    let kind = stepId;
    for (const agent of this.agents.values()) {
      const phase = resolvePhaseStep(
        agent.cursor,
        agent.index,
        agent.agentId,
        this.testRunId
      );
      if (phase?.id === stepId) {
        kind = phase.kind;
        advancePastPhaseStep(agent.cursor);
        agent.blockedOnStepId = null;
      }
    }

    this.completedSteps.push({
      stepId,
      kind,
      completedAt: Date.now(),
      agentCount: this.agents.size,
    });

    this.advancedAt = Date.now();
    this.emitChange('step_completed', {stepId, stepKind: kind});
  }

  /** Return step view for agents blocked waiting on a barrier. */
  private getBarrierStep(
    blockedStepId: string,
    current: PhaseStep
  ): ActiveStep {
    const barrier = this.barriers.get(blockedStepId);
    const startedAt = barrier?.startedAt ?? Date.now();
    const endsAt =
      barrier?.durationMs !== undefined
        ? startedAt + barrier.durationMs
        : undefined;
    return {
      id: current.id,
      kind: current.kind,
      label: current.label,
      config: current.config as Record<string, unknown>,
      advance: current.advance ?? 'timer',
      durationMs: current.durationMs,
      startedAt,
      endsAt,
      branchId: undefined,
    };
  }

  /** Build HTTP-facing ActiveStep from cursor position and barrier state. */
  private toActiveStep(agent: AgentRuntime, phase: PhaseStep): ActiveStep {
    const barrier = this.barriers.get(phase.id);
    const startedAt = barrier?.startedAt ?? Date.now();
    const endsAt =
      phase.durationMs !== undefined ? startedAt + phase.durationMs : undefined;
    const branchId = Object.entries(agent.cursor.splitBranches).at(-1)?.[1];

    return {
      id: phase.id,
      kind: phase.kind,
      label: phase.label,
      config: phase.config as Record<string, unknown>,
      advance: phase.advance ?? 'timer',
      durationMs: phase.durationMs,
      startedAt,
      endsAt,
      branchId,
    };
  }
}
