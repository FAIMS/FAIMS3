// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  parseBuildConfig,
  toRuntimeConfig,
  type PartialBuildConfig,
} from './build-config.js';
import {
  buildEnvMapFromRuntime,
  type SupportedPlatform,
} from './env-contract.js';
import {envValueToString, escapeEnvNewlines} from './env-value.js';

const HELP_TEXT = `Usage: pnpm --filter=@faims3/build-config run generate -- [--config path/to/config.json] [--platform apps|api|all] [--out path/to/.env]

Generates a build environment file from the shared config JSON used by the app and web builds.
Platforms: 'apps' (VITE_ vars for the mobile app and Control Centre build; android/ios are aliases), 'api' (server env vars).
`;

/** Parsed CLI arguments for `generate-build-config`. */
export interface GenerateBuildConfigArgs {
  help?: boolean;
  config?: string;
  platform?: string;
  target?: string;
  out?: string;
}

/** Parse command-line arguments into {@link GenerateBuildConfigArgs}. */
export function parseArgs(argv: string[]): GenerateBuildConfigArgs {
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

    if (token.startsWith('-')) {
      const key = token.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }

  return args as GenerateBuildConfigArgs;
}

// Read the configuration JSON either from stdin or a file
function readConfigJson(configArg: string, cwd = process.cwd()): unknown {
  if (configArg === 'true') {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    if (!stdin) {
      throw new Error('No config JSON was provided on stdin.');
    }
    return JSON.parse(stdin);
  }

  const configPath = path.resolve(cwd, configArg);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Read and parse the build configuration, injecting the git commit version string
function readConfigForGeneration(configArg: string, cwd = process.cwd()) {
  const parsed = parseBuildConfig(readConfigJson(configArg, cwd));
  const commitVersion = resolveGitCommitVersion(
    parsed.observability.commitVersion
  );

  return parseBuildConfig({
    ...parsed,
    observability: {
      ...parsed.observability,
      commitVersion,
    },
  });
}

// Get a value for the Git Commit version if it hasn't been filled in the configuration
// If the value is a placeholder or missing, attempt to resolve it using `git rev-parse HEAD`
function resolveGitCommitVersion(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const placeholderPattern = /^output\s+of\s+`?git rev-parse HEAD`?$/i;

  if (raw && !placeholderPattern.test(raw)) {
    return raw;
  }

  try {
    const resolved = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
    return resolved || 'local-build';
  } catch {
    return raw || 'local-build';
  }
}

/** Format a partial build config into `.env` lines for the requested platform. */
export function generateEnv({
  config,
  platform,
  includeEmpty = false,
}: {
  config: PartialBuildConfig;
  platform: SupportedPlatform;
  includeEmpty?: boolean;
}): string {
  const runtime = toRuntimeConfig(config);
  const map = buildEnvMapFromRuntime(runtime, platform, {includeEmpty});
  return Object.entries(map)
    .filter(([, value]) =>
      includeEmpty ? true : value !== undefined && value !== null
    )
    .map(
      ([key, value]) =>
        `${key}=${escapeEnvNewlines(envValueToString(value) ?? '')}`
    )
    .join('\n');
}

/** Validate CLI arguments, read config JSON, and return or write the generated `.env`. */
export function generateBuildConfig(
  args: GenerateBuildConfigArgs,
  cwd = process.cwd()
): string {
  if (args.help) {
    return `${HELP_TEXT}\n`;
  }

  const rawPlatform = String(
    args.platform ?? args.target ?? 'all'
  ).toLowerCase();
  // Mobile CI workflows pass --platform android / --platform ios; both are
  // aliases for the shared apps env (VITE_* plus both mobile contracts).
  const platform =
    rawPlatform === 'android' || rawPlatform === 'ios' ? 'apps' : rawPlatform;

  if (platform !== 'apps' && platform !== 'api' && platform !== 'all') {
    throw new Error(
      `Unsupported platform: ${platform}. Expected one of apps, api, all`
    );
  }

  if (!args.config) {
    throw new Error(
      'A config file path is required. Pass --config path/to/config.json'
    );
  }

  const parsed = readConfigForGeneration(String(args.config), cwd);
  const env = generateEnv({config: parsed, platform});

  if (args.out) {
    const outPath = path.resolve(cwd, String(args.out));
    fs.mkdirSync(path.dirname(outPath), {recursive: true});
    fs.writeFileSync(outPath, `${env}\n`, 'utf8');
    return `Generated build config at ${outPath}\n`;
  }

  return `${env}\n`;
}

/** CLI entry point for `generate-build-config`. */
export function main(
  argv: string[] = process.argv.slice(2),
  cwd = process.cwd()
) {
  try {
    const args = parseArgs(argv);
    const output = generateBuildConfig(args, cwd);
    process.stdout.write(output);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  process.exit(main());
}
