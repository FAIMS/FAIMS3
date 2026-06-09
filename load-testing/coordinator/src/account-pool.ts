import type {LoadTestAccount} from '@faims3/load-testing-shared';

/** Round-robin pool of pre-seeded accounts with sticky per-agent assignment. */
export class AccountPool {
  private readonly assignments = new Map<string, LoadTestAccount>();
  private nextIndex = 0;

  /** @param accounts Pre-seeded credentials loaded from coordinator env. */
  constructor(private readonly accounts: LoadTestAccount[]) {
    if (accounts.length === 0) {
      throw new Error('Account pool requires at least one account');
    }
  }

  /** Number of accounts available in the pool. */
  size(): number {
    return this.accounts.length;
  }

  /**
   * Sticky assignment per agentId. Round-robin when a new agent requests credentials.
   */
  assign(agentId: string): LoadTestAccount {
    const existing = this.assignments.get(agentId);
    if (existing) {
      return existing;
    }

    const account = this.accounts[this.nextIndex % this.accounts.length];
    this.nextIndex += 1;
    this.assignments.set(agentId, account);
    return account;
  }

  /** Number of distinct agents that have received credentials. */
  assignedCount(): number {
    return this.assignments.size;
  }
}
