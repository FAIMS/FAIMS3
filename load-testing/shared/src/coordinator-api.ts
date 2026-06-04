import {z} from 'zod';
import {StepAdvanceModeSchema} from './sequence-plan';

export const RunStateSchema = z.enum([
  'waiting_for_agents',
  'running',
  'complete',
]);

export const PhaseKindSchema = z.enum([
  'onboarding',
  'online_collection',
  'offline_collection',
  'patchy_network',
  'export_stress',
]);

export const RegisterRequestSchema = z.object({
  agentId: z.string().min(1),
  sessionCount: z.number().int().positive(),
  workerId: z.string().min(1),
});

export const RegisterResponseSchema = z.object({
  coordinatorId: z.string(),
  testRunId: z.string(),
  planName: z.string().optional(),
});

export const ReadyRequestSchema = z.object({
  agentId: z.string().min(1),
});

export const ActiveStepSchema = z.object({
  id: z.string(),
  kind: PhaseKindSchema,
  label: z.string().optional(),
  config: z.record(z.unknown()),
  advance: StepAdvanceModeSchema,
  durationMs: z.number().int().positive().optional(),
  startedAt: z.number(),
  endsAt: z.number().int().positive().optional(),
  branchId: z.string().optional(),
});

export const StepResponseSchema = z.object({
  runState: RunStateSchema,
  testRunId: z.string(),
  advancedAt: z.number(),
  step: ActiveStepSchema.nullable(),
});

export const StepCompleteRequestSchema = z.object({
  agentId: z.string().min(1),
  stepId: z.string().min(1),
  sessionCount: z.number().int().nonnegative(),
});

export const StepCompleteResponseSchema = z.object({
  accepted: z.boolean(),
  runState: RunStateSchema,
});

export const MetricReportSchema = z.object({
  type: z.enum([
    'performance_measure',
    'longtask',
    'couch_request',
    'page_load',
    'record_create',
    'sync_duration',
    'session_error',
    'indexeddb_bytes',
    'active_session',
  ]),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  stepId: z.string().optional(),
  timestamp: z.number(),
  name: z.string().optional(),
  durationMs: z.number().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  bytes: z.number().optional(),
  errorType: z.string().optional(),
  message: z.string().optional(),
  detail: z.record(z.unknown()).optional(),
});

export const AgentDoneRequestSchema = z.object({
  agentId: z.string().min(1),
});

export const ActiveStepGroupSchema = z.object({
  stepId: z.string(),
  kind: PhaseKindSchema,
  label: z.string().optional(),
  branchId: z.string().optional(),
  advance: StepAdvanceModeSchema,
  startedAt: z.number(),
  endsAt: z.number().optional(),
  remainingMs: z.number().optional(),
  agentCount: z.number(),
  agentIds: z.array(z.string()),
  barrier: z
    .object({
      advance: StepAdvanceModeSchema,
      completedAgents: z.number(),
      totalAgents: z.number(),
      waitingOn: z.string(),
    })
    .optional(),
});

export const SplitSummarySchema = z.object({
  branchId: z.string(),
  stepId: z.string(),
  kind: z.string(),
  agentCount: z.number(),
  agentIds: z.array(z.string()),
});

export const AgentDetailSchema = z.object({
  agentId: z.string(),
  index: z.number(),
  ready: z.boolean(),
  done: z.boolean(),
  stepId: z.string().optional(),
  stepKind: z.string().optional(),
  branchId: z.string().optional(),
  blockedOnStepId: z.string().nullable().optional(),
});

export const CompletedStepSchema = z.object({
  stepId: z.string(),
  kind: z.string(),
  completedAt: z.number(),
  agentCount: z.number(),
});

export const PlanTimelineStepSchema = z.object({
  id: z.string(),
  kind: PhaseKindSchema.optional(),
  label: z.string().optional(),
  durationMs: z.number(),
  advance: StepAdvanceModeSchema.optional(),
  structural: z.enum(['loop', 'split']).optional(),
  loopCount: z.number().optional(),
});

export const StatusResponseSchema = z.object({
  runState: RunStateSchema,
  planName: z.string().optional(),
  registeredAgents: z.number(),
  readyAgents: z.number(),
  doneAgents: z.number().optional(),
  expectedAgents: z.number().optional(),
  testRunId: z.string(),
  startedAt: z.number(),
  runStartedAt: z.number().nullable().optional(),
  elapsedMs: z.number().optional(),
  estimatedDurationMs: z.number().optional(),
  estimatedRemainingMs: z.number().optional(),
  progressPercent: z.number().optional(),
  metricsReceived: z.number(),
  activeSteps: z.record(z.string()).optional(),
  completedSteps: z.array(CompletedStepSchema).optional(),
  activeStepGroups: z.array(ActiveStepGroupSchema).optional(),
  splitSummary: z.array(SplitSummarySchema).optional(),
  agents: z.array(AgentDetailSchema).optional(),
  planTimeline: z.array(PlanTimelineStepSchema).optional(),
  health: z.enum(['ok']).optional(),
});

export type RunState = z.infer<typeof RunStateSchema>;
export type ActiveStep = z.infer<typeof ActiveStepSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type ReadyRequest = z.infer<typeof ReadyRequestSchema>;
export type StepResponse = z.infer<typeof StepResponseSchema>;
export type StepCompleteRequest = z.infer<typeof StepCompleteRequestSchema>;
export type StepCompleteResponse = z.infer<typeof StepCompleteResponseSchema>;
export type MetricReport = z.infer<typeof MetricReportSchema>;
export type AgentDoneRequest = z.infer<typeof AgentDoneRequestSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

/** @deprecated use StepAdvanceMode from sequence-plan */
export type PhaseAdvanceStrategy = 'all_ready' | 'majority' | 'timeout';
