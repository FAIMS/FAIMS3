import {z} from 'zod';

const booleanFromEnv = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((v: 'true' | 'false' | boolean) => v === true || v === 'true');

export const AgentEnvSchema = z.object({
  COORDINATOR_URL: z.string().url().default('http://localhost:4000'),
  DASS_APP_URL: z.string().url(),
  DASS_API_URL: z.string().url(),
  COUCH_URL: z.string().url(),
  INVITE_CODE: z.string().min(1),
  NOTEBOOK_PROJECT_ID: z.string().min(1),
  NOTEBOOK_SERVER_ID: z.string().min(1).default('local-dev'),
  NOTEBOOK_NAME: z.string().default('notebook'),
  SESSIONS_PER_AGENT: z.coerce.number().int().positive().default(1),
  OFFLINE_DURATION_MS: z.coerce.number().int().positive().default(30000),
  SYNC_STORM_DELAY_MS: z.coerce.number().int().nonnegative().default(60000),
  PARTICIPATE_IN_EXPORT: booleanFromEnv.optional().default(false),
  HEADLESS: z
    .enum(['true', 'false'])
    .transform((v: 'true' | 'false') => v === 'true')
    .default('true'),
  VIEWPORT_WIDTH: z.coerce.number().int().positive().default(393),
  VIEWPORT_HEIGHT: z.coerce.number().int().positive().default(852),
  SLOW_MO: z.coerce.number().int().nonnegative().default(0),
  USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    ),
});

export type AgentEnv = z.infer<typeof AgentEnvSchema>;

export function parseAgentEnv(
  env: Record<string, string | undefined> = process.env
): AgentEnv {
  return AgentEnvSchema.parse(env);
}
