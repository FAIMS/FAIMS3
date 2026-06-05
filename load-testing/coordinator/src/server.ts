import {serve} from '@hono/node-server';
import {analyzePlan} from '@faims3/load-testing-shared';
import {
  loadSequencePlanFromEnv,
  loadTestAccountsFromEnv,
  parseCoordinatorEnv,
} from './config';
import {AccountPool} from './account-pool';
import {coordinatorLog} from './coordinator-log';
import {MetricsService} from './metrics';
import {PlanEngine} from './plan-engine';
import {buildStatusReport} from './progress-report';
import {createRoutes} from './routes';
import {Registry, createCoordinatorId, createTestRunId} from './registry';

const PROGRESS_LOG_INTERVAL_MS = 60_000;

const env = parseCoordinatorEnv();
const plan = loadSequencePlanFromEnv();
const planAnalysis = analyzePlan(plan);
const coordinatorId = createCoordinatorId();
const testRunId = createTestRunId();

const accountPool = new AccountPool(loadTestAccountsFromEnv());
const registry = new Registry(env.EXPECTED_AGENT_COUNT);
const metrics = new MetricsService(testRunId, env.PROMETHEUS_PUSHGATEWAY_URL, {
  pushIntervalMs: env.METRICS_PUSH_INTERVAL_MS,
});

const engine = new PlanEngine(plan, testRunId, {
  expectedAgentCount: env.EXPECTED_AGENT_COUNT,
  readinessTimeoutMs: env.READINESS_TIMEOUT_MS,
});

let progressLogTimer: ReturnType<typeof setInterval> | null = null;

function logProgressSnapshot(): void {
  const report = buildStatusReport({engine, registry, planAnalysis});
  report.metricsReceived = metrics.getMetricsReceived();
  const active = (report.activeStepGroups ?? [])
    .map(
      group =>
        `${group.stepId}(${group.kind}, ${group.agentCount} agents` +
        (group.remainingMs !== undefined
          ? `, ~${Math.round(group.remainingMs / 1000)}s left`
          : '') +
        ')'
    )
    .join(', ');
  coordinatorLog(
    `progress: ${report.progressPercent ?? 0}% elapsed=${Math.round((report.elapsedMs ?? 0) / 1000)}s` +
      ` agents=${report.readyAgents}/${report.registeredAgents} ready, ${report.doneAgents} done` +
      ` metrics=${report.metricsReceived}` +
      (active.length > 0 ? ` active=[${active}]` : '') +
      ` completed=${(report.completedSteps ?? []).length} steps`
  );
}

function startProgressLogging(): void {
  if (progressLogTimer) return;
  progressLogTimer = setInterval(() => {
    if (engine.getRunState() === 'running') {
      logProgressSnapshot();
    }
  }, PROGRESS_LOG_INTERVAL_MS);
}

function stopProgressLogging(): void {
  if (!progressLogTimer) return;
  clearInterval(progressLogTimer);
  progressLogTimer = null;
}

engine.onPlanChange(event => {
  metrics.recordRunStateChange(
    event.runState,
    event.advancedAt,
    event.stepId
  );

  switch (event.reason) {
    case 'run_started': {
      const trigger =
        event.runStartTrigger === 'timeout'
          ? `readiness timeout (${env.READINESS_TIMEOUT_MS}ms) with ${registry.readyCount()}/${registry.registeredCount()} ready`
          : `all ${registry.readyCount()} agent(s) ready`;
      coordinatorLog(`run started (${trigger})`);
      startProgressLogging();
      logProgressSnapshot();
      break;
    }
    case 'step_completed':
      coordinatorLog(
        `step completed: ${event.stepId} (${event.stepKind ?? 'unknown'})` +
          ` — ${engine.getCompletedSteps().length} steps done`
      );
      break;
    case 'run_completed':
      coordinatorLog(
        `run complete — ${registry.agentsDoneCount()}/${registry.registeredCount()} agents finished`
      );
      stopProgressLogging();
      logProgressSnapshot();
      break;
  }

  if (event.runState === 'complete' && engine.allAgentsDone()) {
    setTimeout(() => {
      void (async () => {
        coordinatorLog('all agents finished — flushing metrics');
        await metrics.shutdown();
        coordinatorLog('test complete');
        process.exit(0);
      })();
    }, 1000);
  }
});

metrics.recordRunStateChange('waiting_for_agents', Date.now());
engine.startReadinessTimeout();

const app = createRoutes(
  registry,
  engine,
  metrics,
  accountPool,
  coordinatorId,
  planAnalysis
);

coordinatorLog(
  `starting on port ${env.PORT}, testRunId=${testRunId}, plan=${plan.name ?? 'unnamed'},` +
    ` est=${Math.round(planAnalysis.estimatedDurationMs / 1000)}s,` +
    ` expecting ${env.EXPECTED_AGENT_COUNT} agent(s), ${accountPool.size()} pre-seeded account(s)`
);
coordinatorLog(
  `waiting for agents (timeout ${env.READINESS_TIMEOUT_MS}ms, pushgateway=${env.PROMETHEUS_PUSHGATEWAY_URL ?? 'disabled'})`
);

serve({fetch: app.fetch, port: env.PORT});
