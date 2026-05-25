import {CoordinatorClient, type MetricReport} from '@faims3/load-testing-shared';

export class MetricsClient {
  private client: CoordinatorClient;
  private agentId: string;
  private defaultPhase?: MetricReport['phase'];

  constructor(coordinatorUrl: string, agentId: string) {
    this.client = new CoordinatorClient(coordinatorUrl);
    this.agentId = agentId;
  }

  setDefaultPhase(phase: MetricReport['phase']): void {
    this.defaultPhase = phase;
  }

  async send(report: Omit<MetricReport, 'agentId' | 'timestamp'> & {timestamp?: number}): Promise<void> {
    await this.client.report({
      ...report,
      agentId: this.agentId,
      phase: report.phase ?? this.defaultPhase,
      timestamp: report.timestamp ?? Date.now(),
    });
  }
}
