import {serve} from '@hono/node-server';
import {Phase} from '@faims3/load-testing-shared';
import {parseCoordinatorEnv} from './config';
import {MetricsService} from './metrics';
import {createRoutes} from './routes';
import {Registry, createCoordinatorId, createTestRunId} from './registry';
import {Sequencer} from './sequencer';

const env = parseCoordinatorEnv();
const coordinatorId = createCoordinatorId();
const testRunId = createTestRunId();

const registry = new Registry(env.EXPECTED_AGENT_COUNT);
const metrics = new MetricsService(testRunId, env.PROMETHEUS_PUSHGATEWAY_URL);

const sequencer = new Sequencer(testRunId, registry, {
  strategy: env.PHASE_ADVANCE_STRATEGY,
  expectedAgentCount: env.EXPECTED_AGENT_COUNT,
  offlineCollectionDurationMs: env.OFFLINE_COLLECTION_DURATION_MS,
  exportStressDurationMs: env.EXPORT_STRESS_DURATION_MS,
  readinessTimeoutMs: env.READINESS_TIMEOUT_MS,
  phaseTimeoutMs: env.PHASE_TIMEOUT_MS,
});

sequencer.onPhaseChange((phase, advancedAt) => {
  metrics.recordPhaseChange(phase, advancedAt);
  console.log(`[coordinator] phase → ${phase} at ${new Date(advancedAt).toISOString()}`);
  if (phase === Phase.ONBOARDING || phase === Phase.SYNC_STORM) {
    sequencer.startPhaseTimeout(phase);
  }
});

metrics.recordPhaseChange(Phase.WAITING_FOR_AGENTS, Date.now());
sequencer.startReadinessTimeout();

const app = createRoutes(registry, sequencer, metrics, coordinatorId);

console.log(
  `[coordinator] starting on port ${env.PORT}, testRunId=${testRunId}, expecting ${env.EXPECTED_AGENT_COUNT} agent(s)`
);

serve({fetch: app.fetch, port: env.PORT});
