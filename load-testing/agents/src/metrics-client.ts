import {CoordinatorClient, type MetricReport} from '@faims3/load-testing-shared';

export class MetricsClient {
  private client: CoordinatorClient;
  private agentId: string;
  private defaultStepId?: string;

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
    await this.client.report({
      ...report,
      agentId: this.agentId,
      stepId: report.stepId ?? this.defaultStepId,
      timestamp: report.timestamp ?? Date.now(),
    });
  }
}
