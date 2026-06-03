import {z} from 'zod';

const phaseAdvanceStrategy = z.enum(['all_ready', 'majority', 'timeout']);

export const CoordinatorEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  EXPECTED_AGENT_COUNT: z.coerce.number().int().positive().default(1),
  PHASE_ADVANCE_STRATEGY: phaseAdvanceStrategy.default('all_ready'),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PHASE_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  OFFLINE_COLLECTION_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(45000),
  EXPORT_STRESS_DURATION_MS: z.coerce.number().int().positive().default(15000),
  PROMETHEUS_PUSHGATEWAY_URL: z.string().url().optional(),
});

export type CoordinatorEnv = z.infer<typeof CoordinatorEnvSchema>;

export function parseCoordinatorEnv(
  env: Record<string, string | undefined> = process.env
): CoordinatorEnv {
  return CoordinatorEnvSchema.parse(env);
}
