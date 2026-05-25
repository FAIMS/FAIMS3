import {z} from 'zod';
import {Phase} from './phases';

export const RegisterRequestSchema = z.object({
  agentId: z.string().min(1),
  sessionCount: z.number().int().positive(),
  workerId: z.string().min(1),
});

export const RegisterResponseSchema = z.object({
  coordinatorId: z.string(),
  testRunId: z.string(),
});

export const ReadyRequestSchema = z.object({
  agentId: z.string().min(1),
});

export const PhaseResponseSchema = z.object({
  phase: z.nativeEnum(Phase),
  advancedAt: z.number(),
  testRunId: z.string(),
});

export const PhaseCompleteRequestSchema = z.object({
  agentId: z.string().min(1),
  phase: z.nativeEnum(Phase),
  sessionCount: z.number().int().nonnegative(),
});

export const PhaseCompleteResponseSchema = z.object({
  nextPhase: z.nativeEnum(Phase).nullable(),
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
  phase: z.nativeEnum(Phase).optional(),
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

export const StatusResponseSchema = z.object({
  phase: z.nativeEnum(Phase),
  registeredAgents: z.number(),
  readyAgents: z.number(),
  doneAgents: z.number().optional(),
  testRunId: z.string(),
  startedAt: z.number(),
  metricsReceived: z.number(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type ReadyRequest = z.infer<typeof ReadyRequestSchema>;
export type PhaseResponse = z.infer<typeof PhaseResponseSchema>;
export type PhaseCompleteRequest = z.infer<typeof PhaseCompleteRequestSchema>;
export type PhaseCompleteResponse = z.infer<typeof PhaseCompleteResponseSchema>;
export type AgentDoneRequest = z.infer<typeof AgentDoneRequestSchema>;
export type MetricReport = z.infer<typeof MetricReportSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
