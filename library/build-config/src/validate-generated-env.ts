import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseBuildConfig} from './build-config.js';
import {
  generateEnv,
  parseArgs,
  type SupportedPlatform,
} from './generate-build-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const APP_SCHEMA_PATH = path.resolve(repoRoot, 'app/src/buildconfig.ts');
const WEB_SCHEMA_PATH = path.resolve(repoRoot, 'web/src/constants.ts');
const FASTLANE_ANDROID_DIR = path.resolve(repoRoot, 'app/android/fastlane');
const FASTLANE_IOS_DIR = path.resolve(repoRoot, 'app/ios/App/fastlane');

const VALID_PLATFORMS = new Set<SupportedPlatform>([
  'all',
  'android',
  'ios',
  'web',
]);

export function parseEnvText(text: string): Map<string, string> {
  const parsed = new Map<string, string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    parsed.set(key, line.slice(equalsIndex + 1));
  }

  return parsed;
}

function extractEnvObjectLiteral(sourceText: string): string {
  const marker = 'const EnvSchema = z';
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Unable to find EnvSchema declaration in source.');
  }

  const objectOpenIndex = sourceText.indexOf('{', markerIndex);
  if (objectOpenIndex === -1) {
    throw new Error('Unable to find opening brace for EnvSchema object.');
  }

  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;

  for (let i = objectOpenIndex; i < sourceText.length; i++) {
    const ch = sourceText[i];
    const prev = sourceText[i - 1];

    if (inSingleQuote) {
      if (ch === "'" && prev !== '\\') {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"' && prev !== '\\') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === '`' && prev !== '\\') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(objectOpenIndex, i + 1);
      }
    }
  }

  throw new Error('Unbalanced brace while scanning EnvSchema object.');
}

export function extractEnvSchemaKeys(filePath: string): Set<string> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const envObjectText = extractEnvObjectLiteral(sourceText);
  const keys = new Set<string>();

  const matches = envObjectText.matchAll(/\b(VITE_[A-Z0-9_]+)\s*:/g);
  for (const match of matches) {
    keys.add(match[1]);
  }

  return keys;
}

export function extractFastlaneEnvKeys(filePath: string): Set<string> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const keys = new Set<string>();

  for (const match of sourceText.matchAll(
    /ENV\[(?:"|')([A-Z0-9_]+)(?:"|')\]/g
  )) {
    keys.add(match[1]);
  }

  return keys;
}

export function fastlaneEnvKeysForPlatform(
  platform: SupportedPlatform
): Set<string> {
  const candidates: string[] = [];

  if (platform === 'android' || platform === 'all') {
    candidates.push(
      path.join(FASTLANE_ANDROID_DIR, 'Appfile'),
      path.join(FASTLANE_ANDROID_DIR, 'Fastfile')
    );
  }

  if (platform === 'ios' || platform === 'all') {
    candidates.push(
      path.join(FASTLANE_IOS_DIR, 'Appfile'),
      path.join(FASTLANE_IOS_DIR, 'Fastfile')
    );
  }

  const keys = new Set<string>();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    for (const key of extractFastlaneEnvKeys(candidate)) {
      keys.add(key);
    }
  }

  return keys;
}

const FASTLANE_EXPLICIT_EXTRA_KEYS = new Set([
  'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD',
  'MATCH_PASSWORD',
]);

export function expectedKeysForPlatform(
  platform: SupportedPlatform
): Set<string> {
  const appKeys = extractEnvSchemaKeys(APP_SCHEMA_PATH);
  const webKeys = extractEnvSchemaKeys(WEB_SCHEMA_PATH);
  const fastlaneKeys = fastlaneEnvKeysForPlatform(platform);

  if (platform === 'web') {
    return webKeys;
  }

  return new Set([
    ...appKeys,
    ...webKeys,
    ...fastlaneKeys,
    ...FASTLANE_EXPLICIT_EXTRA_KEYS,
  ]);
}

export function validateGeneratedEnv({
  envText,
  config,
  platform,
}: {
  envText?: string;
  config?: ReturnType<typeof parseBuildConfig>;
  platform: SupportedPlatform;
}) {
  if (!envText && !config) {
    throw new Error('Either envText or config must be supplied.');
  }

  const generatedText =
    envText ??
    generateEnv({
      config:
        config ??
        parseBuildConfig({
          app: {},
          web: {},
          mobile: {android: {}, ios: {}},
          build: {},
          secrets: {},
        }),
      platform,
      includeEmpty: true,
    });

  const generatedKeys = new Set(parseEnvText(generatedText).keys());
  const expectedKeys = expectedKeysForPlatform(platform);

  const missing = [...expectedKeys]
    .filter(key => !generatedKeys.has(key))
    .sort();
  const unexpected = [...generatedKeys]
    .filter(key => !expectedKeys.has(key))
    .sort();

  return {
    ok: missing.length === 0 && unexpected.length === 0,
    expected: [...expectedKeys].sort(),
    generated: [...generatedKeys].sort(),
    missing,
    unexpected,
  };
}

export function main(
  argv: string[] = process.argv.slice(2),
  cwd = process.cwd()
) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(
      `Usage: pnpm --filter=@faims3/build-config run validate -- [--config path/to/config.json] [--platform all|android|ios|web] [--env path/to/.env]`
    );
    return 0;
  }

  const rawPlatform = String(
    args.platform ?? args.target ?? 'all'
  ).toLowerCase();
  if (!VALID_PLATFORMS.has(rawPlatform as SupportedPlatform)) {
    throw new Error(
      `Unsupported platform: ${rawPlatform}. Expected one of ${[...VALID_PLATFORMS].join(', ')}`
    );
  }

  if (!args.config) {
    throw new Error(
      'A config file path is required. Pass --config path/to/config.json'
    );
  }

  const configPath = path.resolve(cwd, String(args.config));
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const parsed = parseBuildConfig(
    JSON.parse(fs.readFileSync(configPath, 'utf8'))
  );
  const envPath = args.env ? path.resolve(cwd, String(args.env)) : undefined;
  const envText = envPath ? fs.readFileSync(envPath, 'utf8') : undefined;

  const result = validateGeneratedEnv({
    envText,
    config: parsed,
    platform: rawPlatform as SupportedPlatform,
  });

  if (result.ok) {
    console.log(
      `Generated env matches the app/web schema for platform '${rawPlatform}'.`
    );
    return 0;
  }

  if (result.missing.length > 0) {
    console.error(`Missing expected keys (${result.missing.length}):`);
    for (const key of result.missing) {
      console.error(`  - ${key}`);
    }
  }

  if (result.unexpected.length > 0) {
    console.error(`Unexpected generated keys (${result.unexpected.length}):`);
    for (const key of result.unexpected) {
      console.error(`  - ${key}`);
    }
  }

  return 1;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  process.exit(main());
}
