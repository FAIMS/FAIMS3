import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseBuildConfig, toRuntimeConfig} from './build-config.js';
import {buildEnvMapFromRuntime} from './env-contract.js';

const HELP_TEXT = `Usage: pnpm --filter=@faims3/build-config run generate -- [--config path/to/config.json] [--platform all|android|ios|web|api] [--out path/to/.env]

Generates a build environment file from the shared config JSON used by the app and web builds.
`;

type Value =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

export type SupportedPlatform = 'all' | 'android' | 'ios' | 'web' | 'api';

export interface GenerateBuildConfigArgs {
  help?: boolean;
  config?: string;
  platform?: string;
  target?: string;
  out?: string;
}

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

function readConfigForGeneration(configArg: string, cwd = process.cwd()) {
  const parsed = parseBuildConfig(readConfigJson(configArg, cwd));
  const commitVersion = resolveGitCommitVersion(parsed.app.commitVersion);

  return parseBuildConfig({
    ...parsed,
    app: {
      ...parsed.app,
      commitVersion,
    },
  });
}

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

function stringify(value: Value): string {
  if (typeof value === 'string') {
    return value.replace(/\r?\n/g, '\\n');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return (value as Array<string | number | boolean>).join(',');
  }
  return '';
}

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

export function generateEnv({
  config,
  platform,
  includeEmpty = false,
}: {
  config: ReturnType<typeof parseBuildConfig>;
  platform: SupportedPlatform;
  includeEmpty?: boolean;
}): string {
  const runtime = toRuntimeConfig(config);
  const map = buildEnvMapFromRuntime(runtime, platform, {includeEmpty});
  return Object.entries(map)
    .filter(([, value]) =>
      includeEmpty ? true : value !== undefined && value !== null
    )
    .map(([key, value]) => `${key}=${stringify((value ?? '') as Value)}`)
    .join('\n');
}

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
  const validPlatforms = new Set<SupportedPlatform>([
    'all',
    'android',
    'ios',
    'web',
    'api',
  ]);

  if (!validPlatforms.has(rawPlatform as SupportedPlatform)) {
    throw new Error(
      `Unsupported platform: ${rawPlatform}. Expected one of ${[...validPlatforms].join(', ')}`
    );
  }

  const platform = rawPlatform as SupportedPlatform;

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
