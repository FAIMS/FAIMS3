import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z, ZodError} from 'zod';

const nonEmptyString = z.string().trim().min(1);
const regionSlug = z
  .string()
  .regex(/^[a-z]{3}[0-9]$/, 'Expected a region slug such as syd1');
export const DoConfigSchema = z
  .object({
    region: regionSlug,
    conductor: z
      .object({
        imageTag: nonEmptyString.refine(value => value !== 'latest', {
          message: 'A pinned image tag is required; latest is not allowed',
        }),
        instanceSize: nonEmptyString,
      })
      .strict(),
    couch: z
      .object({
        dropletSize: nonEmptyString,
        volumeSize: z.number().int().positive(),
        instanceCount: z.number().int().positive(),
      })
      .strict(),
    storage: z
      .object({
        bucket: nonEmptyString,
        endpoint: z.url().refine(value => value.startsWith('https://'), {
          message: 'The storage endpoint must use HTTPS',
        }),
      })
      .strict(),
  })
  .strict();

export type DoConfig = z.infer<typeof DoConfigSchema>;

export function parseDoConfig(raw: unknown): DoConfig {
  return DoConfigSchema.parse(raw);
}

export function loadDoConfig(configDir: string): DoConfig {
  const filePath = path.join(path.resolve(configDir), 'do.json');
  return parseDoConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function configDirFromArgv(argv: string[]): string {
  const index = argv.indexOf('--config-dir');
  const argument = index >= 0 ? argv[index + 1] : undefined;
  const configDir = argument ?? process.env.CONFIG_DIR;

  if (!configDir) {
    throw new Error(
      'A config directory is required. Pass --config-dir <path> or set CONFIG_DIR.'
    );
  }
  return configDir;
}

export function formatValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return [
      'DigitalOcean configuration validation failed:',
      ...error.issues.map(issue => {
        const location =
          issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `- ${location}: ${issue.message}`;
      }),
    ].join('\n');
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function main(): number {
  try {
    const config = loadDoConfig(configDirFromArgv(process.argv.slice(2)));
    console.log(
      `DigitalOcean configuration is valid. Region: ${config.region}.`
    );
    return 0;
  } catch (error) {
    console.error(formatValidationError(error));
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) process.exit(main());
