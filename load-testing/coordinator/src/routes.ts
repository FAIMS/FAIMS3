import {Hono} from 'hono';
import {zValidator} from '@hono/zod-validator';
import {
  AgentDoneRequestSchema,
  MetricReportSchema,
  PhaseCompleteRequestSchema,
  RegisterRequestSchema,
  ReadyRequestSchema,
  metricReportToPrometheusName,
} from '@faims3/load-testing-shared';
import type {MetricsService} from './metrics';
import type {Registry} from './registry';
import type {Sequencer} from './sequencer';

export function createRoutes(
  registry: Registry,
  sequencer: Sequencer,
  metrics: MetricsService,
  coordinatorId: string
): Hono {
  const app = new Hono();

  app.get('/health', c => c.json({status: 'ok'}));

  app.post('/register', zValidator('json', RegisterRequestSchema), c => {
    const body = c.req.valid('json');
    registry.register(body);
    metrics.updateAgentCounts(registry.registeredCount(), registry.readyCount());
    return c.json({
      coordinatorId,
      testRunId: sequencer.getTestRunId(),
    });
  });

  app.post('/ready', zValidator('json', ReadyRequestSchema), c => {
    const body = c.req.valid('json');
    registry.markReady(body.agentId);
    metrics.updateAgentCounts(registry.registeredCount(), registry.readyCount());
    sequencer.checkReadinessAdvance();
    return c.json({
      phase: sequencer.getPhase(),
      advancedAt: sequencer.getAdvancedAt(),
      testRunId: sequencer.getTestRunId(),
    });
  });

  app.get('/phase', c =>
    c.json({
      phase: sequencer.getPhase(),
      advancedAt: sequencer.getAdvancedAt(),
      testRunId: sequencer.getTestRunId(),
    })
  );

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
    '/phase-complete',
    zValidator('json', PhaseCompleteRequestSchema),
    c => {
      const body = c.req.valid('json');
      registry.markPhaseComplete(body.agentId, body.phase);
      sequencer.checkPhaseCompleteAdvance(body.phase);
      const next = sequencer.getPhase();
      return c.json({nextPhase: next});
    }
  );

  app.post('/agent-done', zValidator('json', AgentDoneRequestSchema), c => {
    const body = c.req.valid('json');
    registry.markAgentDone(body.agentId);
    sequencer.checkAgentDoneAdvance();
    return c.json({
      phase: sequencer.getPhase(),
      advancedAt: sequencer.getAdvancedAt(),
      testRunId: sequencer.getTestRunId(),
    });
  });

  app.get('/status', c =>
    c.json({
      phase: sequencer.getPhase(),
      registeredAgents: registry.registeredCount(),
      readyAgents: registry.readyCount(),
      doneAgents: registry.agentsDoneCount(),
      testRunId: sequencer.getTestRunId(),
      startedAt: sequencer.getStartedAt(),
      metricsReceived: metrics.getMetricsReceived(),
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
