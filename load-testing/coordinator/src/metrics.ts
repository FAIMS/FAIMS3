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
import {coordinatorWarn} from './coordinator-log';

const RUN_STATE_NUMERIC: Record<RunState, number> = {
  waiting_for_agents: 0,
  running: 1,
  complete: 2,
};

const DEFAULT_PUSH_INTERVAL_MS = 2000;
const PUSH_WARN_INTERVAL_MS = 30_000;

export interface MetricsServiceOptions {
  pushIntervalMs?: number;
}

/**
 * Throttled async flush — at most one push per intervalMs while reports keep arriving.
 * Unlike debounce, an already-scheduled timer is not reset, so continuous /report
 * traffic cannot starve Pushgateway pushes.
 */
class PushThrottle {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private flushAgain = false;
  private lastWarnAt = 0;

  /** @param push Async Pushgateway flush invoked at most once per interval. */
  constructor(
    private readonly intervalMs: number,
    private readonly push: () => Promise<void>,
    private readonly label: string
  ) {}

  /** Queue a push after `intervalMs`; coalesce bursts of /report traffic. */
  schedule(): void {
    if (this.timer || this.inFlight) {
      if (this.inFlight) {
        this.flushAgain = true;
      }
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.intervalMs);
  }

  /** Execute a pending push immediately, chaining if reports arrived mid-flight. */
  async flush(): Promise<void> {
    if (this.inFlight) {
      this.flushAgain = true;
      await this.inFlight;
      if (this.flushAgain) {
        this.flushAgain = false;
        return this.flush();
      }
      return;
    }

    this.flushAgain = false;
    this.inFlight = this.push()
      .catch(err => {
        const now = Date.now();
        if (now - this.lastWarnAt >= PUSH_WARN_INTERVAL_MS) {
          coordinatorWarn(`Pushgateway ${this.label} push failed`, err);
          this.lastWarnAt = now;
        }
      })
      .finally(() => {
        this.inFlight = null;
      });

    await this.inFlight;

    if (this.flushAgain) {
      this.flushAgain = false;
      return this.flush();
    }
  }

  /** Cancel a scheduled push timer (shutdown). */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** Prometheus registries with throttled Pushgateway export for coordinator + agents. */
export class MetricsService {
  private readonly promRegistry: PromRegistry;
  private readonly agentRegistry: PromRegistry;
  private readonly agentPushgateway: Pushgateway<RegistryContentType> | null;
  private readonly coordinatorPushgateway: Pushgateway<RegistryContentType> | null;
  private readonly testRunId: string;
  private readonly agentPushThrottle: PushThrottle | null;
  private readonly coordinatorPushThrottle: PushThrottle | null;
  private metricsReceived = 0;

  private runStateGauge: Gauge;
  private stepTransitionGauge: Gauge;
  private registeredAgentsGauge: Gauge;
  private readyAgentsGauge: Gauge;

  private histograms = new Map<string, Histogram>();
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();

  /** @param pushgatewayUrl When set, enables throttled Pushgateway export. */
  constructor(
    testRunId: string,
    pushgatewayUrl?: string,
    options: MetricsServiceOptions = {}
  ) {
    const pushIntervalMs =
      options.pushIntervalMs ?? DEFAULT_PUSH_INTERVAL_MS;

    this.testRunId = testRunId;
    this.promRegistry = new PromRegistry();
    this.agentRegistry = new PromRegistry();

    collectDefaultMetrics({register: this.promRegistry});

    this.runStateGauge = new Gauge({
      name: 'faims_run_state',
      help: 'Run state: 0=waiting, 1=running, 2=complete',
      registers: [this.promRegistry],
    });

    this.stepTransitionGauge = new Gauge({
      name: 'faims_step_transition_timestamp',
      help: 'Unix timestamp when run state or step barrier advanced',
      labelNames: ['stepId', 'testRunId'],
      registers: [this.promRegistry],
    });

    this.registeredAgentsGauge = new Gauge({
      name: 'faims_registered_agents',
      help: 'Number of registered agents',
      registers: [this.promRegistry],
    });

    this.readyAgentsGauge = new Gauge({
      name: 'faims_ready_agents',
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

    this.agentPushThrottle = this.agentPushgateway
      ? new PushThrottle(pushIntervalMs, () => this.pushAgentMetrics(), 'agent')
      : null;
    this.coordinatorPushThrottle = this.coordinatorPushgateway
      ? new PushThrottle(
          pushIntervalMs,
          () => this.pushCoordinatorState(),
          'coordinator'
        )
      : null;
  }

  /** Total `/report` payloads ingested this run. */
  getMetricsReceived(): number {
    return this.metricsReceived;
  }

  /** Expose coordinator registry as Prometheus text for `/metrics`. */
  async getMetricsText(): Promise<string> {
    return this.promRegistry.metrics();
  }

  /** Update run-state gauges when the plan advances. */
  recordRunStateChange(runState: RunState, advancedAt: number, stepId?: string): void {
    this.runStateGauge.set(RUN_STATE_NUMERIC[runState]);
    if (stepId) {
      this.stepTransitionGauge.set(
        {stepId, testRunId: this.testRunId},
        advancedAt / 1000
      );
    }
    this.coordinatorPushThrottle?.schedule();
  }

  /** Update registered/ready agent gauges after register or ready calls. */
  updateAgentCounts(registered: number, ready: number): void {
    this.registeredAgentsGauge.set(registered);
    this.readyAgentsGauge.set(ready);
    this.coordinatorPushThrottle?.schedule();
  }

  /** Lazily create a labelled histogram in the agent metrics registry. */
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

  /** Lazily create a labelled counter in the agent metrics registry. */
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

  /** Lazily create a labelled gauge in the agent metrics registry. */
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

  /** Record an agent metric report into the appropriate Prometheus type. */
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

    this.agentPushThrottle?.schedule();
  }

  /** Push coordinator registry to Pushgateway (additive job). */
  async pushCoordinatorState(jobName = 'faims_coordinator'): Promise<void> {
    if (!this.coordinatorPushgateway) return;
    await this.coordinatorPushgateway.pushAdd({jobName});
  }

  /** Push agent metrics registry to Pushgateway (additive job). */
  async pushAgentMetrics(jobName = 'faims_agent_metrics'): Promise<void> {
    if (!this.agentPushgateway) return;
    await this.agentPushgateway.pushAdd({jobName});
  }

  /** Flush pending Pushgateway batches (call before shutdown). */
  async shutdown(): Promise<void> {
    this.agentPushThrottle?.stop();
    this.coordinatorPushThrottle?.stop();
    await Promise.all([
      this.agentPushThrottle?.flush(),
      this.coordinatorPushThrottle?.flush(),
    ]);
  }
}
