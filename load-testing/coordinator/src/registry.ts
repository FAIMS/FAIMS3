import {randomUUID} from 'crypto';
import type {RegisterRequest} from '@faims3/load-testing-shared';

export interface AgentRecord {
  agentId: string;
  workerId: string;
  sessionCount: number;
  registeredAt: number;
  readyAt: number | null;
  doneAt: number | null;
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

  markAgentDone(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.doneAt = Date.now();
    return agent;
  }

  agentsDoneCount(): number {
    return [...this.agents.values()].filter(a => a.doneAt !== null).length;
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

  getAllAgents(): AgentRecord[] {
    return [...this.agents.values()];
  }

  setExpectedAgentCount(count: number): void {
    this.expectedAgentCount = count;
  }

  getExpectedAgentCount(): number {
    return this.expectedAgentCount;
  }
}

export function createCoordinatorId(): string {
  return randomUUID();
}

export function createTestRunId(): string {
  return randomUUID();
}
