import {Hono} from 'hono';
import {zValidator} from '@hono/zod-validator';
import {
  AgentDoneRequestSchema,
  MetricReportSchema,
  RegisterRequestSchema,
  ReadyRequestSchema,
  StepCompleteRequestSchema,
  metricReportToPrometheusName,
} from '@faims3/load-testing-shared';
import type {MetricsService} from './metrics';
import type {PlanEngine} from './plan-engine';
import type {Registry} from './registry';

export function createRoutes(
  registry: Registry,
  engine: PlanEngine,
  metrics: MetricsService,
  coordinatorId: string
): Hono {
  const app = new Hono();
  const plan = engine.getPlan();

  app.get('/health', c => c.json({status: 'ok'}));

  app.post('/register', zValidator('json', RegisterRequestSchema), c => {
    const body = c.req.valid('json');
    registry.register(body);
    engine.registerAgent(body.agentId);
    metrics.updateAgentCounts(registry.registeredCount(), registry.readyCount());
    return c.json({
      coordinatorId,
      testRunId: engine.getTestRunId(),
      planName: plan.name,
    });
  });

  app.post('/ready', zValidator('json', ReadyRequestSchema), c => {
    const body = c.req.valid('json');
    registry.markReady(body.agentId);
    engine.markReady(body.agentId);
    metrics.updateAgentCounts(registry.registeredCount(), registry.readyCount());
    const step = engine.getStep(body.agentId);
    return c.json({
      runState: engine.getRunState(),
      testRunId: engine.getTestRunId(),
      advancedAt: engine.getAdvancedAt(),
      step,
    });
  });

  app.get('/step', c => {
    const agentId = c.req.query('agentId');
    if (!agentId) {
      return c.json({error: 'agentId required'}, 400);
    }
    const step = engine.getStep(agentId);
    return c.json({
      runState: engine.getRunState(),
      testRunId: engine.getTestRunId(),
      advancedAt: engine.getAdvancedAt(),
      step,
    });
  });

  app.post('/report', zValidator('json', MetricReportSchema), async c => {
    const body = c.req.valid('json');
    const promName = metricReportToPrometheusName(body);
    metrics.ingestReport(body, promName);
    try {
      await metrics.pushAgentMetrics('dass_agent_metrics');
    } catch (err) {
      console.warn('Pushgateway push failed:', err);
    }
    return c.json({ok: true});
  });

  app.post(
    '/step-complete',
    zValidator('json', StepCompleteRequestSchema),
    c => {
      const body = c.req.valid('json');
      engine.completeStep(body.agentId, body.stepId);
      return c.json({
        accepted: true,
        runState: engine.getRunState(),
      });
    }
  );

  app.post('/agent-done', zValidator('json', AgentDoneRequestSchema), c => {
    const body = c.req.valid('json');
    registry.markAgentDone(body.agentId);
    engine.markAgentDone(body.agentId);
    const step = engine.getStep(body.agentId);
    return c.json({
      runState: engine.getRunState(),
      testRunId: engine.getTestRunId(),
      advancedAt: engine.getAdvancedAt(),
      step,
    });
  });

  app.get('/status', c =>
    c.json({
      runState: engine.getRunState(),
      planName: plan.name,
      registeredAgents: registry.registeredCount(),
      readyAgents: registry.readyCount(),
      doneAgents: registry.agentsDoneCount(),
      testRunId: engine.getTestRunId(),
      startedAt: engine.getStartedAt(),
      metricsReceived: metrics.getMetricsReceived(),
      activeSteps: engine.getActiveStepSummary(),
    })
  );

  app.get('/metrics', async c => {
    const text = await metrics.getMetricsText();
    return c.text(text, 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });

  return app;
}
