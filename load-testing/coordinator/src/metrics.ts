import {
  Counter,
  Gauge,
  Histogram,
  Pushgateway,
  Registry as PromRegistry,
  collectDefaultMetrics,
  type RegistryContentType,
} from 'prom-client';
import {
  type MetricReport,
  type RunState,
  isCounterMetric,
  isGaugeMetric,
} from '@faims3/load-testing-shared';

const RUN_STATE_NUMERIC: Record<RunState, number> = {
  waiting_for_agents: 0,
  running: 1,
  complete: 2,
};

export class MetricsService {
  private readonly promRegistry: PromRegistry;
  private readonly agentRegistry: PromRegistry;
  private readonly agentPushgateway: Pushgateway<RegistryContentType> | null;
  private readonly coordinatorPushgateway: Pushgateway<RegistryContentType> | null;
  private readonly testRunId: string;
  private metricsReceived = 0;

  private runStateGauge: Gauge;
  private stepTransitionGauge: Gauge;
  private registeredAgentsGauge: Gauge;
  private readyAgentsGauge: Gauge;

  private histograms = new Map<string, Histogram>();
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();

  constructor(testRunId: string, pushgatewayUrl?: string) {
    this.testRunId = testRunId;
    this.promRegistry = new PromRegistry();
    this.agentRegistry = new PromRegistry();

    collectDefaultMetrics({register: this.promRegistry});

    this.runStateGauge = new Gauge({
      name: 'dass_run_state',
      help: 'Run state: 0=waiting, 1=running, 2=complete',
      registers: [this.promRegistry],
    });

    this.stepTransitionGauge = new Gauge({
      name: 'dass_step_transition_timestamp',
      help: 'Unix timestamp when run state or step barrier advanced',
      labelNames: ['stepId', 'testRunId'],
      registers: [this.promRegistry],
    });

    this.registeredAgentsGauge = new Gauge({
      name: 'dass_registered_agents',
      help: 'Number of registered agents',
      registers: [this.promRegistry],
    });

    this.readyAgentsGauge = new Gauge({
      name: 'dass_ready_agents',
      help: 'Number of ready agents',
      registers: [this.promRegistry],
    });

    const pushUrl =
      pushgatewayUrl && pushgatewayUrl.length > 0 ? pushgatewayUrl : undefined;
    this.agentPushgateway = pushUrl
      ? new Pushgateway(pushUrl, {}, this.agentRegistry)
      : null;
    this.coordinatorPushgateway = pushUrl
      ? new Pushgateway(pushUrl, {}, this.promRegistry)
      : null;
  }

  private pushCoordinatorStateFireAndForget(): void {
    void this.pushCoordinatorState().catch(err => {
      console.warn('Pushgateway coordinator push failed:', err);
    });
  }

  getMetricsReceived(): number {
    return this.metricsReceived;
  }

  async getMetricsText(): Promise<string> {
    return this.promRegistry.metrics();
  }

  recordRunStateChange(runState: RunState, advancedAt: number, stepId?: string): void {
    this.runStateGauge.set(RUN_STATE_NUMERIC[runState]);
    if (stepId) {
      this.stepTransitionGauge.set(
        {stepId, testRunId: this.testRunId},
        advancedAt / 1000
      );
    }
    this.pushCoordinatorStateFireAndForget();
  }

  updateAgentCounts(registered: number, ready: number): void {
    this.registeredAgentsGauge.set(registered);
    this.readyAgentsGauge.set(ready);
    this.pushCoordinatorStateFireAndForget();
  }

  private getHistogram(name: string): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram({
        name,
        help: `${name} histogram`,
        labelNames: ['testRunId', 'stepId', 'agentId', 'sessionId', 'name'],
        buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
        registers: [this.agentRegistry],
      });
      this.histograms.set(name, h);
    }
    return h;
  }

  private getCounter(name: string): Counter {
    let c = this.counters.get(name);
    if (!c) {
      c = new Counter({
        name,
        help: `${name} counter`,
        labelNames: ['testRunId', 'stepId', 'agentId', 'sessionId', 'errorType'],
        registers: [this.agentRegistry],
      });
      this.counters.set(name, c);
    }
    return c;
  }

  private getGauge(name: string): Gauge {
    let g = this.gauges.get(name);
    if (!g) {
      g = new Gauge({
        name,
        help: `${name} gauge`,
        labelNames: ['testRunId', 'stepId', 'agentId', 'sessionId'],
        registers: [this.agentRegistry],
      });
      this.gauges.set(name, g);
    }
    return g;
  }

  ingestReport(report: MetricReport, promName: string): void {
    this.metricsReceived += 1;
    const labels = {
      testRunId: this.testRunId,
      stepId: report.stepId ?? 'unknown',
      agentId: report.agentId ?? 'unknown',
      sessionId: report.sessionId ?? 'unknown',
      name: report.name ?? 'unknown',
      errorType: report.errorType ?? 'unknown',
    };

    if (isCounterMetric(report)) {
      this.getCounter(promName).inc({
        testRunId: labels.testRunId,
        stepId: labels.stepId,
        agentId: labels.agentId,
        sessionId: labels.sessionId,
        errorType: labels.errorType,
      });
    } else if (isGaugeMetric(report)) {
      this.getGauge(promName).set(
        {
          testRunId: labels.testRunId,
          stepId: labels.stepId,
          agentId: labels.agentId,
          sessionId: labels.sessionId,
        },
        report.bytes ?? report.durationMs ?? 1
      );
    } else if (report.durationMs !== undefined) {
      this.getHistogram(promName).observe(
        {
          testRunId: labels.testRunId,
          stepId: labels.stepId,
          agentId: labels.agentId,
          sessionId: labels.sessionId,
          name: labels.name,
        },
        report.durationMs
      );
    }
  }

  async pushCoordinatorState(jobName = 'dass_coordinator'): Promise<void> {
    if (!this.coordinatorPushgateway) return;
    await this.coordinatorPushgateway.pushAdd({jobName});
  }

  async pushAgentMetrics(jobName = 'dass_agent_metrics'): Promise<void> {
    if (!this.agentPushgateway) return;
    await this.agentPushgateway.pushAdd({jobName});
  }
}
