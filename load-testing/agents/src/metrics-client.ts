import {CoordinatorClient, type MetricReport} from '@faims3/load-testing-shared';

const WARN_INTERVAL_MS = 30_000;

export class MetricsClient {
  private client: CoordinatorClient;
  private agentId: string;
  private defaultStepId?: string;
  private lastWarnAt = 0;
  private suppressedWarnings = 0;

  constructor(coordinatorUrl: string, agentId: string) {
    this.client = new CoordinatorClient(coordinatorUrl);
    this.agentId = agentId;
  }

  setDefaultStepId(stepId: string): void {
    this.defaultStepId = stepId;
  }

  async send(
    report: Omit<MetricReport, 'agentId' | 'timestamp'> & {timestamp?: number}
  ): Promise<void> {
    const ok = await this.client.report({
      ...report,
      agentId: this.agentId,
      stepId: report.stepId ?? this.defaultStepId,
      timestamp: report.timestamp ?? Date.now(),
    });

    if (!ok) {
      this.warnCoordinatorUnreachable();
    }
  }

  private warnCoordinatorUnreachable(): void {
    const now = Date.now();
    if (now - this.lastWarnAt >= WARN_INTERVAL_MS) {
      const suppressed =
        this.suppressedWarnings > 0
          ? ` (${this.suppressedWarnings} similar failures suppressed)`
          : '';
      console.warn(
        `[metrics] coordinator /report unreachable — metrics dropped (load test continues)${suppressed}`
      );
      this.lastWarnAt = now;
      this.suppressedWarnings = 0;
      return;
    }
    this.suppressedWarnings += 1;
  }
}
