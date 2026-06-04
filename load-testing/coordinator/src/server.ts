import {serve} from '@hono/node-server';
import {loadSequencePlanFromEnv, parseCoordinatorEnv} from './config';
import {MetricsService} from './metrics';
import {PlanEngine} from './plan-engine';
import {createRoutes} from './routes';
import {Registry, createCoordinatorId, createTestRunId} from './registry';

const env = parseCoordinatorEnv();
const plan = loadSequencePlanFromEnv();
const coordinatorId = createCoordinatorId();
const testRunId = createTestRunId();

const registry = new Registry(env.EXPECTED_AGENT_COUNT);
const metrics = new MetricsService(testRunId, env.PROMETHEUS_PUSHGATEWAY_URL);

const engine = new PlanEngine(plan, testRunId, {
  expectedAgentCount: env.EXPECTED_AGENT_COUNT,
  readinessTimeoutMs: env.READINESS_TIMEOUT_MS,
});

engine.onPlanChange((runState, advancedAt) => {
  metrics.recordRunStateChange(runState, advancedAt);
  console.log(
    `[coordinator] runState → ${runState} at ${new Date(advancedAt).toISOString()}`
  );
  if (runState === 'complete' && engine.allAgentsDone()) {
    setTimeout(() => {
      console.log('[coordinator] all agents finished — test complete');
      process.exit(0);
    }, 1000);
  }
});

metrics.recordRunStateChange('waiting_for_agents', Date.now());
engine.startReadinessTimeout();

const app = createRoutes(registry, engine, metrics, coordinatorId);

console.log(
  `[coordinator] starting on port ${env.PORT}, testRunId=${testRunId}, plan=${plan.name ?? 'unnamed'}, expecting ${env.EXPECTED_AGENT_COUNT} agent(s)`
);

serve({fetch: app.fetch, port: env.PORT});
