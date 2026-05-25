import {serve} from '@hono/node-server';
import {Phase, type PhaseAdvanceStrategy} from '@faims3/load-testing-shared';
import {MetricsService} from './metrics';
import {createRoutes} from './routes';
import {Registry, createCoordinatorId, createTestRunId} from './registry';
import {Sequencer} from './sequencer';

function envInt(name: string, defaultValue: number): number {
  const v = process.env[name];
  if (!v) return defaultValue;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function envStrategy(): PhaseAdvanceStrategy {
  const v = process.env.PHASE_ADVANCE_STRATEGY ?? 'all_ready';
  if (v === 'majority' || v === 'timeout') return v;
  return 'all_ready';
}

const port = envInt('PORT', 4000);
const coordinatorId = createCoordinatorId();
const testRunId = createTestRunId();
const expectedAgentCount = envInt('EXPECTED_AGENT_COUNT', 1);

const registry = new Registry(expectedAgentCount);
const metrics = new MetricsService(
  testRunId,
  process.env.PROMETHEUS_PUSHGATEWAY_URL
);

const sequencer = new Sequencer(testRunId, registry, {
  strategy: envStrategy(),
  expectedAgentCount,
  offlineCollectionDurationMs: envInt('OFFLINE_COLLECTION_DURATION_MS', 45000),
  exportStressDurationMs: envInt('EXPORT_STRESS_DURATION_MS', 15000),
  readinessTimeoutMs: envInt('READINESS_TIMEOUT_MS', 30000),
  phaseTimeoutMs: envInt('PHASE_TIMEOUT_MS', 60000),
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

console.log(`[coordinator] starting on port ${port}, testRunId=${testRunId}`);

serve({fetch: app.fetch, port});
