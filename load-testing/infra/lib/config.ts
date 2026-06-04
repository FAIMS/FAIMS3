import * as fs from 'fs';
import * as path from 'path';
import {z} from 'zod';

const envRecord = (env: NodeJS.ProcessEnv = process.env): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

export const LoadTestInfraConfigSchema = z
  .object({
    STACK_NAME: z.string().min(1),
    AWS_ACCOUNT_ID: z
      .string()
      .regex(/^\d{12}$/, 'AWS_ACCOUNT_ID must be a 12-digit account id'),
    AWS_REGION: z.string().min(1),
    HOSTED_ZONE_ID: z.string().min(1),
    HOSTED_ZONE_NAME: z.string().min(1),
    METRICS_SUBDOMAIN: z.string().min(1).default('loadtest-metrics'),
    DASS_APP_URL: z.string().url(),
    DASS_API_URL: z.string().url(),
    COUCH_URL: z.string().url(),
    COUCH_USER: z.string().min(1).default('admin'),
    COUCH_PASSWORD_SECRET_ARN: z.string().min(1).optional(),
    COUCH_PASSWORD: z.string().min(1).optional(),
    VPC_CIDR: z.string().default('10.30.0.0/16'),
    METRICS_INSTANCE_TYPE: z.string().default('t3.medium'),
    ALLOWED_GRAFANA_CIDR: z.string().default('0.0.0.0/0'),
    ALLOWED_COORDINATOR_CIDR: z.string().default('0.0.0.0/0'),
    COORDINATOR_CPU: z.coerce.number().int().positive().default(2048),
    COORDINATOR_MEMORY_MIB: z.coerce.number().int().positive().default(4096),
    AGENT_CPU: z.coerce.number().int().positive().default(2048),
    AGENT_MEMORY_MIB: z.coerce.number().int().positive().default(4096),
    /** ECS Container Insights: disabled | enabled | enhanced */
    CONTAINER_INSIGHTS: z
      .enum(['disabled', 'enabled', 'enhanced'])
      .default('enhanced'),
    ENABLE_VPC_FLOW_LOGS: z
      .enum(['true', 'false'])
      .default('true'),
  })
  .refine(
    data => data.COUCH_PASSWORD_SECRET_ARN || data.COUCH_PASSWORD,
    {
      message:
        'Set COUCH_PASSWORD_SECRET_ARN and/or COUCH_PASSWORD for the metrics EC2 couchdb-exporter',
      path: ['COUCH_PASSWORD_SECRET_ARN'],
    }
  );

export type LoadTestInfraConfig = z.infer<typeof LoadTestInfraConfigSchema>;

export function loadLoadTestInfraConfig(
  env: NodeJS.ProcessEnv = process.env
): LoadTestInfraConfig {
  return LoadTestInfraConfigSchema.parse(envRecord(env));
}

export function metricsDomain(config: LoadTestInfraConfig): string {
  return `${config.METRICS_SUBDOMAIN}.${config.HOSTED_ZONE_NAME}`;
}

/** Monorepo root (FAIMS3/) from lib/ (ts-node) or build/lib/ (compiled). */
export function repoRootFromHere(importMetaDirname: string): string {
  let dir = importMetaDirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    `Could not locate monorepo root from ${importMetaDirname} (no pnpm-workspace.yaml found)`
  );
}

/** Docker build context exclusions to keep CDK asset hashes stable and small. */
export const DOCKER_ASSET_EXCLUDES = [
  'app/**',
  'web/**',
  'api/**',
  'designer/**',
  'library/forms/**',
  'library/data-model/**',
  'tests/**',
  'e2e/**',
  'infrastructure/**',
  'load-testing/infra/**',
  'load-testing/agents/build/**',
  'load-testing/agents/screenshots/**',
  'load-testing/agents/.env',
  'load-testing/coordinator/build/**',
  'load-testing/coordinator/.env',
  'load-testing/.env',
  '**/.turbo/**',
  '**/node_modules/**',
  '**/.git/**',
  '**/cdk.out/**',
  'docs/**',
  'out/**',
  'coverage/**',
  '*.log',
];
