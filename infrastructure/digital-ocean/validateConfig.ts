import {execFileSync} from 'node:child_process';
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
    backup: z
      .object({
        bucket: nonEmptyString,
        endpoint: z.url().refine(value => value.startsWith('https://'), {
          message: 'The backup endpoint must use HTTPS',
        }),
      })
      .strict(),
  })
  .strict();

export type DoConfig = z.infer<typeof DoConfigSchema>;

export const DoSecretsSchema = z
  .object({
    backup: z
      .object({
        accessKeyId: nonEmptyString,
        secretAccessKey: nonEmptyString,
        resticPassword: nonEmptyString,
      })
      .strict(),
  })
  .strict();

export type DoSecrets = z.infer<typeof DoSecretsSchema>;

export const DigitalOceanConfigSchema = z
  .object({
    do: DoConfigSchema,
    secrets: DoSecretsSchema,
  })
  .strict();

export type DigitalOceanConfig = z.infer<typeof DigitalOceanConfigSchema>;

export function parseDoConfig(raw: unknown): DoConfig {
  return DoConfigSchema.parse(raw);
}

export function loadDoConfig(configDir: string): DoConfig {
  const filePath = path.join(path.resolve(configDir), 'do.json');
  return parseDoConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function loadDoSecrets(configDir: string): DoSecrets {
  const filePath = path.join(path.resolve(configDir), 'do-secrets.enc.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`DigitalOcean secrets file not found: ${filePath}`);
  }
  if (
    !process.env.SOPS_AGE_KEY?.trim() &&
    !process.env.SOPS_AGE_KEY_FILE?.trim()
  ) {
    throw new Error(
      'SOPS_AGE_KEY or SOPS_AGE_KEY_FILE is required to validate do-secrets.enc.json'
    );
  }
  const decrypted = execFileSync('sops', ['--decrypt', filePath], {
    encoding: 'utf8',
  });
  return DoSecretsSchema.parse(JSON.parse(decrypted));
}

export function parseDoSecrets(raw: unknown): DoSecrets {
  return DoSecretsSchema.parse(raw);
}

export function parseDigitalOceanConfig(
  doConfigRaw: unknown,
  doSecretsRaw: unknown
): DigitalOceanConfig {
  return DigitalOceanConfigSchema.parse({
    do: doConfigRaw,
    secrets: doSecretsRaw,
  });
}

export function doSecretsToTerraformOutput(secrets: DoSecrets): {
  backup_access_key_id: string;
  backup_secret_access_key: string;
  restic_password: string;
} {
  return {
    backup_access_key_id: secrets.backup.accessKeyId,
    backup_secret_access_key: secrets.backup.secretAccessKey,
    restic_password: secrets.backup.resticPassword,
  };
}

export function doSecretsFileExists(configDir: string): boolean {
  return fs.existsSync(
    path.join(path.resolve(configDir), 'do-secrets.enc.json')
  );
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

function formatFromArgv(argv: string[]): 'text' | 'terraform-json' {
  const index = argv.indexOf('--format');
  const format = index >= 0 ? argv[index + 1] : 'text';
  if (format !== 'text' && format !== 'terraform-json') {
    throw new Error(
      'Unsupported format. Expected --format text or --format terraform-json.'
    );
  }
  return format;
}

function secretsFromArgv(argv: string[]): unknown {
  const index = argv.indexOf('--secrets');
  if (index < 0) return undefined;
  const secretsArg = argv[index + 1];
  if (!secretsArg) throw new Error('--secrets requires a JSON file or -');
  if (secretsArg === '-') {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    if (!stdin) throw new Error('No do-secrets JSON was provided on stdin');
    return JSON.parse(stdin);
  }
  return JSON.parse(fs.readFileSync(path.resolve(secretsArg), 'utf8'));
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
    const argv = process.argv.slice(2);
    const configDir = configDirFromArgv(argv);
    const config = loadDoConfig(configDir);
    const format = formatFromArgv(argv);
    const secretsArg = secretsFromArgv(argv);
    const secretsRaw =
      secretsArg ??
      (doSecretsFileExists(configDir) ? loadDoSecrets(configDir) : undefined);
    if (format === 'terraform-json') {
      if (secretsRaw === undefined) {
        throw new Error('A do-secrets JSON overlay is required');
      }
      const parsed = parseDigitalOceanConfig(config, secretsRaw);
      process.stdout.write(
        JSON.stringify(doSecretsToTerraformOutput(parsed.secrets))
      );
      return 0;
    }
    if (secretsRaw !== undefined) {
      parseDigitalOceanConfig(config, secretsRaw);
    }
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
