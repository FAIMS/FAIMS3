import {randomUUID} from 'crypto';
import {
  Phase,
  type PhaseAdvanceStrategy,
  type RegisterRequest,
} from '@faims3/load-testing-shared';

export interface AgentRecord {
  agentId: string;
  workerId: string;
  sessionCount: number;
  registeredAt: number;
  readyAt: number | null;
  doneAt: number | null;
  currentPhase: Phase;
  phaseCompletions: Partial<Record<Phase, number>>;
}

export class Registry {
  private agents = new Map<string, AgentRecord>();
  private expectedAgentCount: number;

  constructor(expectedAgentCount: number) {
    this.expectedAgentCount = expectedAgentCount;
  }

  register(body: RegisterRequest): AgentRecord {
    const record: AgentRecord = {
      agentId: body.agentId,
      workerId: body.workerId,
      sessionCount: body.sessionCount,
      registeredAt: Date.now(),
      readyAt: null,
      doneAt: null,
      currentPhase: Phase.WAITING_FOR_AGENTS,
      phaseCompletions: {},
    };
    this.agents.set(body.agentId, record);
    return record;
  }

  markReady(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.readyAt = Date.now();
    return agent;
  }

  markPhaseComplete(agentId: string, phase: Phase): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.phaseCompletions[phase] = Date.now();
    agent.currentPhase = phase;
    return agent;
  }

  markAgentDone(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.doneAt = Date.now();
    return agent;
  }

  agentsDoneCount(): number {
    return [...this.agents.values()].filter(a => a.doneAt !== null).length;
  }

  allAgentsDone(): boolean {
    if (this.agents.size < this.expectedAgentCount) return false;
    return this.agentsDoneCount() >= this.agents.size;
  }

  getAgent(agentId: string): AgentRecord | undefined {
    return this.agents.get(agentId);
  }

  registeredCount(): number {
    return this.agents.size;
  }

  readyCount(): number {
    return [...this.agents.values()].filter(a => a.readyAt !== null).length;
  }

  agentsCompletedPhase(phase: Phase): number {
    return [...this.agents.values()].filter(
      a => a.phaseCompletions[phase] !== undefined
    ).length;
  }

  allAgentsReady(): boolean {
    if (this.agents.size < this.expectedAgentCount) return false;
    return [...this.agents.values()].every(a => a.readyAt !== null);
  }

  majorityAgentsReady(): boolean {
    if (this.agents.size === 0) return false;
    return this.readyCount() > this.agents.size / 2;
  }

  allAgentsCompletedPhase(phase: Phase): boolean {
    if (this.agents.size === 0) return false;
    return this.agentsCompletedPhase(phase) >= this.agents.size;
  }

  majorityCompletedPhase(phase: Phase): boolean {
    if (this.agents.size === 0) return false;
    return this.agentsCompletedPhase(phase) > this.agents.size / 2;
  }

  getAllAgents(): AgentRecord[] {
    return [...this.agents.values()];
  }

  setExpectedAgentCount(count: number): void {
    this.expectedAgentCount = count;
  }
}

export function createCoordinatorId(): string {
  return randomUUID();
}

export function createTestRunId(): string {
  return randomUUID();
}
