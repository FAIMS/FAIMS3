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

/** Tracks registered agents and their ready/done lifecycle timestamps. */
export class Registry {
  private agents = new Map<string, AgentRecord>();
  private expectedAgentCount: number;

  /** @param expectedAgentCount Target agents before run can start on timeout. */
  constructor(expectedAgentCount: number) {
    this.expectedAgentCount = expectedAgentCount;
  }

  /** Record a new agent at registration time. */
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

  /** Mark an agent as ready (all browser sessions launched). */
  markReady(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.readyAt = Date.now();
    return agent;
  }

  /** Mark an agent as finished (plan complete for all sessions). */
  markAgentDone(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    agent.doneAt = Date.now();
    return agent;
  }

  /** Count agents that reported plan completion. */
  agentsDoneCount(): number {
    return [...this.agents.values()].filter(a => a.doneAt !== null).length;
  }

  /** Lookup a single agent record by id. */
  getAgent(agentId: string): AgentRecord | undefined {
    return this.agents.get(agentId);
  }

  /** Total agents that have called `/register`. */
  registeredCount(): number {
    return this.agents.size;
  }

  /** Agents that have called `/ready`. */
  readyCount(): number {
    return [...this.agents.values()].filter(a => a.readyAt !== null).length;
  }

  /** Snapshot of all agent records. */
  getAllAgents(): AgentRecord[] {
    return [...this.agents.values()];
  }

  /** Override expected agent count (e.g. dynamic scaling). */
  setExpectedAgentCount(count: number): void {
    this.expectedAgentCount = count;
  }

  /** Configured target number of agents for this run. */
  getExpectedAgentCount(): number {
    return this.expectedAgentCount;
  }
}

/** Unique id for this coordinator process instance. */
export function createCoordinatorId(): string {
  return randomUUID();
}

/** Unique id labeling all metrics and logs for one load test run. */
export function createTestRunId(): string {
  return randomUUID();
}
