import {
  Phase,
  nextPhase,
  type PhaseAdvanceStrategy,
} from '@faims3/load-testing-shared';
import type {Registry} from './registry';

export interface SequencerConfig {
  strategy: PhaseAdvanceStrategy;
  expectedAgentCount: number;
  offlineCollectionDurationMs: number;
  exportStressDurationMs: number;
  readinessTimeoutMs: number;
  phaseTimeoutMs: number;
}

export type PhaseChangeListener = (
  phase: Phase,
  advancedAt: number,
  testRunId: string
) => void;

export class Sequencer {
  private phase: Phase = Phase.WAITING_FOR_AGENTS;
  private advancedAt: number = Date.now();
  private readonly testRunId: string;
  private readonly config: SequencerConfig;
  private readonly registry: Registry;
  private readonly listeners: PhaseChangeListener[] = [];
  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private exportTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private shutdownTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt: number = Date.now();

  constructor(
    testRunId: string,
    registry: Registry,
    config: SequencerConfig
  ) {
    this.testRunId = testRunId;
    this.registry = registry;
    this.config = config;
  }

  onPhaseChange(listener: PhaseChangeListener): void {
    this.listeners.push(listener);
  }

  getPhase(): Phase {
    return this.phase;
  }

  getAdvancedAt(): number {
    return this.advancedAt;
  }

  getTestRunId(): string {
    return this.testRunId;
  }

  getStartedAt(): number {
    return this.startedAt;
  }

  private emitPhaseChange(): void {
    for (const listener of this.listeners) {
      listener(this.phase, this.advancedAt, this.testRunId);
    }
  }

  private advanceTo(next: Phase): void {
    this.phase = next;
    this.advancedAt = Date.now();
    this.clearTimers();
    this.emitPhaseChange();
    this.schedulePhaseTimers();
    if (next === Phase.COMPLETE && this.registry.allAgentsDone()) {
      this.scheduleShutdown();
    }
  }

  private scheduleShutdown(): void {
    if (this.shutdownTimer) return;
    this.shutdownTimer = setTimeout(() => {
      console.log('[coordinator] all agents finished — test complete');
      process.exit(0);
    }, 1000);
  }

  private clearTimers(): void {
    if (this.offlineTimer) clearTimeout(this.offlineTimer);
    if (this.exportTimer) clearTimeout(this.exportTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.offlineTimer = null;
    this.exportTimer = null;
    this.phaseTimer = null;
  }

  private schedulePhaseTimers(): void {
    if (this.phase === Phase.OFFLINE_COLLECTION) {
      this.offlineTimer = setTimeout(() => {
        this.advanceTo(Phase.SYNC_STORM);
      }, this.config.offlineCollectionDurationMs);
    } else if (this.phase === Phase.EXPORT_STRESS) {
      this.exportTimer = setTimeout(() => {
        this.advanceTo(Phase.COMPLETE);
      }, this.config.exportStressDurationMs);
    }
  }

  private shouldAdvanceOnReady(): boolean {
    switch (this.config.strategy) {
      case 'majority':
        return this.registry.majorityAgentsReady();
      case 'timeout':
        return true;
      default:
        return this.registry.allAgentsReady();
    }
  }

  private shouldAdvanceOnPhaseComplete(phase: Phase): boolean {
    switch (this.config.strategy) {
      case 'majority':
        return this.registry.majorityCompletedPhase(phase);
      case 'timeout':
        return true;
      default:
        return this.registry.allAgentsCompletedPhase(phase);
    }
  }

  checkReadinessAdvance(): void {
    if (
      this.phase === Phase.WAITING_FOR_AGENTS &&
      this.shouldAdvanceOnReady()
    ) {
      this.advanceTo(Phase.ONBOARDING);
    }
  }

  checkPhaseCompleteAdvance(completedPhase: Phase): void {
    if (this.phase !== completedPhase) return;

    const completionPhases: Phase[] = [Phase.ONBOARDING, Phase.SYNC_STORM];
    if (!completionPhases.includes(completedPhase)) return;

    if (this.shouldAdvanceOnPhaseComplete(completedPhase)) {
      const next = nextPhase(completedPhase);
      if (next) this.advanceTo(next);
    }
  }

  checkAgentDoneAdvance(): void {
    if (!this.registry.allAgentsDone()) return;

    if (this.phase === Phase.EXPORT_STRESS) {
      this.advanceTo(Phase.COMPLETE);
      return;
    }

    if (this.phase === Phase.COMPLETE) {
      this.scheduleShutdown();
    }
  }

  startReadinessTimeout(): void {
    this.phaseTimer = setTimeout(() => {
      if (this.phase === Phase.WAITING_FOR_AGENTS) {
        this.advanceTo(Phase.ONBOARDING);
      }
    }, this.config.readinessTimeoutMs);
  }

  startPhaseTimeout(phase: Phase): void {
    if (this.config.strategy !== 'timeout') return;
    this.phaseTimer = setTimeout(() => {
      if (this.phase === phase) {
        const next = nextPhase(phase);
        if (next) this.advanceTo(next);
      }
    }, this.config.phaseTimeoutMs);
  }
}
