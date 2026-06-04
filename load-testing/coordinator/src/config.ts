import {z} from 'zod';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {
  parseSequencePlan,
  parseSequencePlanFromEnv,
  SEQUENCE_PLAN_B64_ENV_VAR,
  SEQUENCE_PLAN_ENV_VAR,
} from '@faims3/load-testing-shared';

export const CoordinatorEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  EXPECTED_AGENT_COUNT: z.coerce.number().int().positive().default(1),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PROMETHEUS_PUSHGATEWAY_URL: z.string().url().optional(),
  /** Debounce interval for batched Pushgateway pushes (default 2s). */
  METRICS_PUSH_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  SEQUENCE_PLAN_FILE: z.string().optional(),
});

export type CoordinatorEnv = z.infer<typeof CoordinatorEnvSchema>;

export function loadSequencePlanFromEnv(
  env: Record<string, string | undefined> = process.env
): ReturnType<typeof parseSequencePlan> {
  if (env[SEQUENCE_PLAN_ENV_VAR]?.trim() || env[SEQUENCE_PLAN_B64_ENV_VAR]?.trim()) {
    return parseSequencePlanFromEnv(env);
  }
  const file = env.SEQUENCE_PLAN_FILE?.trim();
  if (file) {
    const json = readFileSync(resolve(file), 'utf8');
    return parseSequencePlan(json);
  }
  throw new Error(
    `Missing sequence plan: set ${SEQUENCE_PLAN_ENV_VAR}, ${SEQUENCE_PLAN_B64_ENV_VAR}, or SEQUENCE_PLAN_FILE`
  );
}

export function parseCoordinatorEnv(
  env: Record<string, string | undefined> = process.env
): CoordinatorEnv {
  loadSequencePlanFromEnv(env);
  return CoordinatorEnvSchema.parse(env);
}
