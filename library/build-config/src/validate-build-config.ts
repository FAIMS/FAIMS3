// SPDX-License-Identifier: Apache-2.0
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ZodError} from 'zod';
import {parseBuildConfig, type SharedBuildConfig} from './build-config.js';

const HELP_TEXT = `Usage: pnpm --filter=@faims3/build-config run validate [--config path/to/core.json | --config-dir path/to/env-folder] [--secrets path/to/secrets.json]

Validates a FAIMS deployment core.json with parseBuildConfig (schema + shared invariants).

  --config <path>        Path to core.json
  --config-dir <path>    Env folder containing core.json (required) and optional secrets.enc.json
  --secrets <path>       Already-decrypted secrets overlay to deep-merge over core.json
  --help                 Show this help

If neither --config nor --config-dir is set, CONFIG_DIR is used (same env
folder the CDK validator reads).

When --config-dir / CONFIG_DIR is used and secrets.enc.json is present, the
overlay is decrypted with sops when SOPS_AGE_KEY or SOPS_AGE_KEY_FILE is set.
Otherwise the encrypted overlay is skipped (core.json is still validated).
`;

/** Parsed CLI arguments for `validate-build-config`. */
export interface ValidateBuildConfigArgs {
  help?: boolean;
  config?: string;
  'config-dir'?: string;
  secrets?: string;
}

/** Optional hooks so tests can stub sops without invoking the binary. */
export interface ValidateBuildConfigOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  decryptEncryptedSecrets?: (
    filePath: string,
    env: NodeJS.ProcessEnv
  ) => unknown;
}

export interface ValidateBuildConfigResult {
  core: SharedBuildConfig;
  merged?: SharedBuildConfig;
  secretsMerged: boolean;
  messages: string[];
  summary: string;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge with jq's `.[0] * .[1]` semantics (objects merge, rest wins).
 * Same rule mobile CI uses: `jq -s '.[0] * .[1]' core.json secrets.json`.
 */
export function deepMerge(a: unknown, b: unknown): unknown {
  if (isJsonObject(a) && isJsonObject(b)) {
    const out: JsonObject = {...a};
    for (const [key, value] of Object.entries(b)) {
      out[key] = deepMerge(a[key], value);
    }
    return out;
  }
  return b === undefined ? a : b;
}

/** Parse command-line arguments into {@link ValidateBuildConfigArgs}. */
export function parseValidateArgs(argv: string[]): ValidateBuildConfigArgs {
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
      continue;
    }
  }

  return args as ValidateBuildConfigArgs;
}

function resolvePath(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON in ${filePath}: ${message}`);
  }
}

function hasSopsKey(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.SOPS_AGE_KEY?.trim() || env.SOPS_AGE_KEY_FILE?.trim());
}

function decryptSopsFile(filePath: string, env: NodeJS.ProcessEnv): unknown {
  try {
    const stdout = execFileSync('sops', ['--decrypt', filePath], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decrypt ${filePath} with sops: ${message}`);
  }
}

function requirePathValue(
  value: string | boolean | undefined,
  flag: string
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${flag} requires a path argument.`);
  }
  return value;
}

function successSummary(
  config: SharedBuildConfig,
  secretsMerged: boolean
): string {
  const appName = config.branding.appName;
  return secretsMerged
    ? `Configuration is valid (core + secrets overlay). App: ${appName}.`
    : `Configuration is valid. App: ${appName}.`;
}

/** Pretty-print Zod issues the same way the CDK validate-config script does. */
export function formatValidateError(error: unknown): string {
  if (error instanceof ZodError) {
    const lines = ['Configuration validation failed:'];
    for (const issue of error.issues) {
      const pathLabel = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      lines.push(`- ${pathLabel}: ${issue.message}`);
    }
    return lines.join('\n');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Validate core.json, and optionally a secrets overlay (plaintext --secrets
 * or sops-decrypted secrets.enc.json in --config-dir / CONFIG_DIR).
 */
export function validateBuildConfig(
  args: ValidateBuildConfigArgs,
  options: ValidateBuildConfigOptions = {}
): ValidateBuildConfigResult {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const decrypt = options.decryptEncryptedSecrets ?? decryptSopsFile;

  const configDirFromArgs = args['config-dir'];
  const configDirFromEnv = env.CONFIG_DIR;
  const hasConfig = args.config !== undefined;
  const hasDir = configDirFromArgs !== undefined;
  if (hasConfig && hasDir) {
    throw new Error(
      'Pass only one of --config <core.json> or --config-dir <env-folder>.'
    );
  }
  if (!hasConfig && !hasDir && !configDirFromEnv) {
    throw new Error(
      'Pass --config <core.json>, --config-dir <env-folder>, or set CONFIG_DIR.'
    );
  }

  const messages: string[] = [];
  let corePath: string;
  let envDir: string | undefined;

  if (hasConfig) {
    corePath = resolvePath(requirePathValue(args.config, '--config'), cwd);
  } else {
    const dirValue = hasDir
      ? requirePathValue(configDirFromArgs, '--config-dir')
      : requirePathValue(configDirFromEnv, 'CONFIG_DIR');
    envDir = resolvePath(dirValue, cwd);
    corePath = path.join(envDir, 'core.json');
  }

  const coreRaw = readJsonFile(corePath);
  const core = parseBuildConfig(coreRaw);

  let overlayRaw: unknown;
  let secretsMerged = false;

  if (args.secrets !== undefined) {
    const secretsPath = resolvePath(
      requirePathValue(args.secrets, '--secrets'),
      cwd
    );
    overlayRaw = readJsonFile(secretsPath);
    secretsMerged = true;
  } else if (envDir) {
    const encryptedPath = path.join(envDir, 'secrets.enc.json');
    if (fs.existsSync(encryptedPath)) {
      if (hasSopsKey(env)) {
        overlayRaw = decrypt(encryptedPath, env);
        secretsMerged = true;
      } else {
        messages.push(
          'Skipping secrets overlay: secrets.enc.json is present but SOPS_AGE_KEY / SOPS_AGE_KEY_FILE is unset.'
        );
      }
    }
  }

  let merged: SharedBuildConfig | undefined;
  if (secretsMerged) {
    merged = parseBuildConfig(deepMerge(coreRaw, overlayRaw));
  }

  const validated = merged ?? core;
  return {
    core,
    merged,
    secretsMerged,
    messages,
    summary: successSummary(validated, secretsMerged),
  };
}

/** CLI entry point for `validate-build-config`. */
export function main(
  argv: string[] = process.argv.slice(2),
  options: ValidateBuildConfigOptions = {}
): number {
  try {
    const args = parseValidateArgs(argv);
    if (args.help) {
      process.stdout.write(`${HELP_TEXT}\n`);
      return 0;
    }
    const result = validateBuildConfig(args, options);
    for (const message of result.messages) {
      process.stdout.write(`${message}\n`);
    }
    process.stdout.write(`${result.summary}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${formatValidateError(error)}\n`);
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  process.exit(main());
}
