import {CoordinatorClient, type MetricReport} from '@faims3/load-testing-shared';

const WARN_INTERVAL_MS = 30_000;

/** Thin wrapper that tags reports with agentId and tolerates coordinator outages. */
export class MetricsClient {
  private client: CoordinatorClient;
  private agentId: string;
  private defaultStepId?: string;
  private lastWarnAt = 0;
  private suppressedWarnings = 0;

  /** @param coordinatorUrl Base URL for coordinator `/report` endpoint. */
  constructor(coordinatorUrl: string, agentId: string) {
    this.client = new CoordinatorClient(coordinatorUrl);
    this.agentId = agentId;
  }

  /** Default stepId applied when reports omit one. */
  setDefaultStepId(stepId: string): void {
    this.defaultStepId = stepId;
  }

  /** Post a metric to coordinator `/report`; warns (throttled) on failure. */
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

  /** Rate-limit unreachable-coordinator warnings to avoid log spam. */
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
