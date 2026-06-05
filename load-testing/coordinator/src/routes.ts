import {Hono} from 'hono';
import {zValidator} from '@hono/zod-validator';
import {
  AgentDoneRequestSchema,
  MetricReportSchema,
  RegisterRequestSchema,
  ReadyRequestSchema,
  StepCompleteRequestSchema,
  CredentialsResponseSchema,
  metricReportToPrometheusName,
  type PlanAnalysis,
} from '@faims3/load-testing-shared';
import type {AccountPool} from './account-pool';
import {coordinatorLog, coordinatorWarn} from './coordinator-log';
import type {MetricsService} from './metrics';
import type {PlanEngine} from './plan-engine';
import {buildStatusReport} from './progress-report';
import type {Registry} from './registry';

export function createRoutes(
  registry: Registry,
  engine: PlanEngine,
  metrics: MetricsService,
  accountPool: AccountPool,
  coordinatorId: string,
  planAnalysis: PlanAnalysis
): Hono {
  const app = new Hono();
  const plan = engine.getPlan();

  app.get('/health', c => c.json({status: 'ok'}));

  app.get('/credentials', c => {
    const agentId = c.req.query('agentId');
    if (!agentId) {
      return c.json({error: 'agentId required'}, 400);
    }
    if (!registry.getAgent(agentId)) {
      return c.json({error: 'agent not registered'}, 404);
    }
    const account = accountPool.assign(agentId);
    return c.json(CredentialsResponseSchema.parse(account));
  });

  app.post('/register', zValidator('json', RegisterRequestSchema), c => {
    const body = c.req.valid('json');
    registry.register(body);
    engine.registerAgent(body.agentId);
    metrics.updateAgentCounts(registry.registeredCount(), registry.readyCount());
    coordinatorLog(
      `agent registered: ${body.agentId} (worker=${body.workerId}, sessions=${body.sessionCount})` +
        ` — ${registry.registeredCount()}/${registry.getExpectedAgentCount()} registered`
    );
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
    coordinatorLog(
      `agent ready: ${body.agentId}` +
        ` — ${registry.readyCount()}/${registry.getExpectedAgentCount()} ready` +
        (step ? `, first step=${step.id} (${step.kind})` : '')
    );
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

  app.post('/report', zValidator('json', MetricReportSchema), c => {
    const body = c.req.valid('json');
    const promName = metricReportToPrometheusName(body);
    metrics.ingestReport(body, promName);
    return c.json({ok: true});
  });

  app.post(
    '/step-complete',
    zValidator('json', StepCompleteRequestSchema),
    c => {
      const body = c.req.valid('json');
      const accepted = engine.completeStep(body.agentId, body.stepId);
      if (!accepted) {
        coordinatorWarn(
          `step-complete rejected: agent=${body.agentId} step=${body.stepId}` +
            ` runState=${engine.getRunState()}`
        );
      }
      return c.json({
        accepted,
        runState: engine.getRunState(),
      });
    }
  );

  app.post('/agent-done', zValidator('json', AgentDoneRequestSchema), c => {
    const body = c.req.valid('json');
    registry.markAgentDone(body.agentId);
    engine.markAgentDone(body.agentId);
    const step = engine.getStep(body.agentId);
    coordinatorLog(
      `agent done: ${body.agentId}` +
        ` — ${registry.agentsDoneCount()}/${registry.registeredCount()} finished`
    );
    return c.json({
      runState: engine.getRunState(),
      testRunId: engine.getTestRunId(),
      advancedAt: engine.getAdvancedAt(),
      step,
    });
  });

  app.get('/status', c => {
    const report = buildStatusReport({
      engine,
      registry,
      planAnalysis,
    });
    report.metricsReceived = metrics.getMetricsReceived();
    return c.json(report);
  });

  app.get('/metrics', async c => {
    const text = await metrics.getMetricsText();
    return c.text(text, 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });

  return app;
}
