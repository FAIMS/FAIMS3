import {z} from 'zod';
import {
  hasSequencePlanSource,
  parseLoadTestAccounts,
  LOAD_TEST_ACCOUNTS_ENV_VAR,
  sequencePlanSourceHint,
  type LoadTestAccount,
} from '@faims3/load-testing-shared';

export const CoordinatorEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  EXPECTED_AGENT_COUNT: z.coerce.number().int().positive().default(1),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PROMETHEUS_PUSHGATEWAY_URL: z.string().url().optional(),
  /** Throttle interval for batched Pushgateway pushes (default 2s). */
  METRICS_PUSH_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  SEQUENCE_PLAN_FILE: z.string().optional(),
  SEQUENCE_PLAN_S3_URI: z.string().optional(),
  SEQUENCE_PLAN: z.string().optional(),
  SEQUENCE_PLAN_B64: z.string().optional(),
  /** Pre-seeded accounts: `email::password` entries separated by commas or newlines. */
  LOAD_TEST_ACCOUNTS: z.string().min(1),
});

export type CoordinatorEnv = z.infer<typeof CoordinatorEnvSchema>;

export function parseCoordinatorEnv(
  env: Record<string, string | undefined> = process.env
): CoordinatorEnv {
  if (!hasSequencePlanSource(env)) {
    throw new Error(
      `Missing sequence plan: set one of ${sequencePlanSourceHint()}`
    );
  }
  return CoordinatorEnvSchema.parse(env);
}

export function loadTestAccountsFromEnv(
  env: Record<string, string | undefined> = process.env
): LoadTestAccount[] {
  const raw = env[LOAD_TEST_ACCOUNTS_ENV_VAR];
  if (!raw?.trim()) {
    throw new Error(`Missing ${LOAD_TEST_ACCOUNTS_ENV_VAR}`);
  }
  return parseLoadTestAccounts(raw);
}
