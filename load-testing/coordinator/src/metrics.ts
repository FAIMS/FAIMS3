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
  Phase,
  phaseToNumeric,
  type MetricReport,
  isCounterMetric,
  isGaugeMetric,
} from '@faims3/load-testing-shared';

export class MetricsService {
  private readonly promRegistry: PromRegistry;
  private readonly agentRegistry: PromRegistry;
  private readonly pushgateway: Pushgateway<RegistryContentType> | null;
  private readonly testRunId: string;
  private metricsReceived = 0;

  private testPhaseGauge: Gauge;
  private phaseTransitionGauge: Gauge;
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

    this.testPhaseGauge = new Gauge({
      name: 'dass_test_phase',
      help: 'Current test phase as numeric enum',
      registers: [this.promRegistry],
    });

    this.phaseTransitionGauge = new Gauge({
      name: 'dass_phase_transition_timestamp',
      help: 'Unix timestamp of phase transitions',
      labelNames: ['phase', 'testRunId'],
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

    this.pushgateway =
      pushgatewayUrl && pushgatewayUrl.length > 0
        ? new Pushgateway(pushgatewayUrl, {}, this.agentRegistry)
        : null;
  }

  getMetricsReceived(): number {
    return this.metricsReceived;
  }

  async getMetricsText(): Promise<string> {
    return this.promRegistry.metrics();
  }

  recordPhaseChange(phase: Phase, advancedAt: number): void {
    this.testPhaseGauge.set(phaseToNumeric(phase));
    this.phaseTransitionGauge.set(
      {phase, testRunId: this.testRunId},
      advancedAt / 1000
    );
  }

  updateAgentCounts(registered: number, ready: number): void {
    this.registeredAgentsGauge.set(registered);
    this.readyAgentsGauge.set(ready);
  }

  private getHistogram(name: string): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram({
        name,
        help: `${name} histogram`,
        labelNames: ['testRunId', 'phase', 'agentId', 'sessionId', 'name'],
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
        labelNames: ['testRunId', 'phase', 'agentId', 'sessionId', 'errorType'],
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
        labelNames: ['testRunId', 'phase', 'agentId', 'sessionId'],
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
      phase: report.phase ?? 'unknown',
      agentId: report.agentId ?? 'unknown',
      sessionId: report.sessionId ?? 'unknown',
      name: report.name ?? 'unknown',
      errorType: report.errorType ?? 'unknown',
    };

    if (isCounterMetric(report)) {
      this.getCounter(promName).inc({
        testRunId: labels.testRunId,
        phase: labels.phase,
        agentId: labels.agentId,
        sessionId: labels.sessionId,
        errorType: labels.errorType,
      });
    } else if (isGaugeMetric(report)) {
      this.getGauge(promName).set(
        {
          testRunId: labels.testRunId,
          phase: labels.phase,
          agentId: labels.agentId,
          sessionId: labels.sessionId,
        },
        report.bytes ?? report.durationMs ?? 1
      );
    } else if (report.durationMs !== undefined) {
      this.getHistogram(promName).observe(
        {
          testRunId: labels.testRunId,
          phase: labels.phase,
          agentId: labels.agentId,
          sessionId: labels.sessionId,
          name: labels.name,
        },
        report.durationMs
      );
    }
  }

  async pushMetrics(jobName = 'dass_coordinator'): Promise<void> {
    if (!this.pushgateway) return;
    await this.pushgateway.pushAdd({jobName});
  }
}
