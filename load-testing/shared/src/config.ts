import {z} from 'zod';

export const SharedEnvSchema = z.object({
  DASS_APP_URL: z.string().url(),
  DASS_API_URL: z.string().url(),
  COUCH_URL: z.string().url(),
  COORDINATOR_URL: z.string().url().default('http://localhost:4000'),
  INVITE_CODE: z.string().min(1),
  NOTEBOOK_PROJECT_ID: z.string().min(1),
  NOTEBOOK_SERVER_ID: z.string().min(1).default('local-dev'),
  RECORD_VIEW_ID: z.string().optional(),
  SESSIONS_PER_AGENT: z.coerce.number().int().positive().default(1),
  OFFLINE_DURATION_MS: z.coerce.number().int().positive().default(30000),
  SYNC_STORM_DELAY_MS: z.coerce.number().int().nonnegative().default(60000),
  PARTICIPATE_IN_EXPORT: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform(v => v === true || v === 'true')
    .default(false),
  HEADLESS: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .default('true'),
  BROWSER: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  VIEWPORT_WIDTH: z.coerce.number().int().positive().default(393),
  VIEWPORT_HEIGHT: z.coerce.number().int().positive().default(852),
});

export type SharedEnv = z.infer<typeof SharedEnvSchema>;

export function parseSharedEnv(
  env: Record<string, string | undefined> = process.env
): SharedEnv {
  return SharedEnvSchema.parse(env);
}
