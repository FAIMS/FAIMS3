// SPDX-License-Identifier: Apache-2.0
/**
 * Script to validate that the generated .env file covers all environment
 * variables the consumers (mobile app, Control Centre, Fastlane) expect.
 *
 * The producer side (which keys get generated) is fully controlled by the
 * typed env contract in this package. What we cannot control is the
 * consumers: they still parse their own env schemas (app/src/buildconfig.ts,
 * web/src/constants.ts) and the Fastlane files read ENV[] keys directly.
 *
 * This script therefore extracts the env keys from those consumer sources and
 * checks that the generated .env contains exactly that set — no more, no
 * less — so a new variable introduced in the apps or Fastlane is caught
 * before it silently breaks a build.
 *
 * A consumer that has been migrated to parse via this module no longer has a
 * local `EnvSchema`; it is simply skipped (its keys are now guaranteed by
 * construction to be generated). Only legacy, not-yet-migrated consumers are
 * scanned.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseBuildConfig} from './build-config.js';
import {generateEnv, parseArgs} from './generate-build-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

/**
 * The location of consumer source files that use environment variables
 */
const APP_SCHEMA_PATH = path.resolve(repoRoot, 'app/src/buildconfig.ts');
const WEB_SCHEMA_PATH = path.resolve(repoRoot, 'web/src/constants.ts');
const FASTLANE_ANDROID_DIR = path.resolve(repoRoot, 'app/android/fastlane');
const FASTLANE_IOS_DIR = path.resolve(repoRoot, 'app/ios/App/fastlane');

/**
 * Env keys that are set by the CI pipeline (workflow inputs / version
 * stamping) rather than by the generated config. They are consumed by
 * Fastlane but must not appear in the generated env.
 */
const CI_PROVIDED_KEYS = new Set(['VERSION_NAME', 'ANDROID_DEPLOY_TRACK']);

/**
 * Env keys that Fastlane consumes but whose values are injected by the
 * deployment platform / CI (GitHub secrets) rather than the generated
 * config. The generator still emits them (mobile secrets JSON carries the
 * values for local builds), so a generated env containing them is expected.
 */
const PLATFORM_PROVIDED_KEYS = new Set([
  'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD',
  'MATCH_PASSWORD',
]);

/**
 * Env keys consumed by the CI workflows themselves (not by Fastlane or the
 * apps), e.g. base64 secrets decoded into files before Fastlane runs
 * (see .github/workflows/common-android-build.yml).
 */
const CI_WORKFLOW_CONSUMED_KEYS = new Set([
  'KEYSTORE_FILE',
  'GPLAY_SERVICE_ACCOUNT_KEY_JSON',
]);

/**
 * Parse environment variable names from a .env file text.  Ignores comments and blank lines.
 * @param text The .env file text to parse
 * @returns A map of environment variable names to their values
 */
function parseEnvText(text: string): Map<string, string> {
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

/**
 * Read a TypeScript source file and extract the object literal
 * that defines the environment variable schema.
 * @param sourceText The text of the TypeScript source file
 * @returns The text of the object literal, or null if no EnvSchema is present
 *          (i.e. the consumer has been migrated to parse via this module).
 */
function extractEnvObjectLiteral(sourceText: string): string | null {
  const marker = 'const EnvSchema = z';
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex === -1) {
    return null;
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

/**
 * Given a TypeScript source file, extract the keys of the EnvSchema object literal.
 * @param filePath The path of the TypeScript source file
 * @returns A set of keys defined in the EnvSchema object literal
 */
function extractEnvSchemaKeys(filePath: string): Set<string> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const envObjectText = extractEnvObjectLiteral(sourceText);
  const keys = new Set<string>();

  if (envObjectText === null) {
    // Migrated consumer: no local EnvSchema, so nothing to scan here.
    return keys;
  }

  const matches = envObjectText.matchAll(/\b(VITE_[A-Z0-9_]+)\s*:/g);
  for (const match of matches) {
    keys.add(match[1]);
  }

  return keys;
}

/**
 * Given a Fastlane file, extract the keys of the environment variables used in it.
 * @param filePath
 * @returns A set of keys of environment variables used in the file
 */
function extractFastlaneEnvKeys(filePath: string): Set<string> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const keys = new Set<string>();

  for (const match of sourceText.matchAll(
    /ENV\[(?:"|')([A-Z0-9_]+)(?:"|')\]/g
  )) {
    keys.add(match[1]);
  }

  return keys;
}

/**
 * Gather ENV keys that are used in the Fastlane files for IOS and Android builds,
 * excluding keys provided by the CI pipeline or the deployment platform.
 * @returns A set of ENV keys used in the Fastlane files that the config must supply
 */
function fastlaneEnvKeys(): Set<string> {
  const candidates: string[] = [];

  candidates.push(
    path.join(FASTLANE_ANDROID_DIR, 'Appfile'),
    path.join(FASTLANE_ANDROID_DIR, 'Fastfile')
  );

  candidates.push(
    path.join(FASTLANE_IOS_DIR, 'Appfile'),
    path.join(FASTLANE_IOS_DIR, 'Fastfile')
  );

  const keys = new Set<string>();

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    for (const key of extractFastlaneEnvKeys(candidate)) {
      if (CI_PROVIDED_KEYS.has(key)) continue;
      if (PLATFORM_PROVIDED_KEYS.has(key)) continue;
      keys.add(key);
    }
  }

  return keys;
}

/**
 * Find all the environment variable keys that the not-yet-migrated consumers
 * (the mobile app and Fastlane) expect, plus any still-present in a legacy web
 * `EnvSchema` (web has been migrated, so it contributes nothing today).
 * Migrated consumers read their keys via this module and are therefore
 * covered by construction, so they are intentionally not scanned here.
 * @returns A set of all expected keys
 */
export function getExpectedKeys(): Set<string> {
  const appKeys = extractEnvSchemaKeys(APP_SCHEMA_PATH);
  const webKeys = extractEnvSchemaKeys(WEB_SCHEMA_PATH);
  const fastlaneKeys = fastlaneEnvKeys();

  return new Set([...appKeys, ...webKeys, ...fastlaneKeys]);
}

/**
 * Given the text of a generated .env file, check that it covers every key the
 * not-yet-migrated consumers expect. `missing` is the gate (a consumer needs a
 * key we do not generate); `unexpected` (generated keys no scanned consumer
 * reads) is informational, since migrated consumers read keys that are not
 * scannable here.
 */
export function validateGeneratedEnv({envText}: {envText: string}) {
  const generatedKeys = new Set(parseEnvText(envText).keys());
  const expectedKeys = getExpectedKeys();

  const missing = [...expectedKeys]
    .filter(key => !generatedKeys.has(key))
    .sort();
  const unexpected = [...generatedKeys]
    .filter(key => !expectedKeys.has(key))
    .filter(key => !PLATFORM_PROVIDED_KEYS.has(key))
    .filter(key => !CI_WORKFLOW_CONSUMED_KEYS.has(key))
    .sort();

  return {
    ok: missing.length === 0,
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
      `Usage: pnpm --filter=@faims3/build-config run validate-coverage [--config path/to/config.json]`
    );
    return 0;
  }

  // Generate the .env text either from the supplied config file or from an empty one
  let parsed: ReturnType<typeof parseBuildConfig> | undefined = undefined;
  if (!args.config) {
    parsed = parseBuildConfig({
      endpoints: {},
      branding: {},
      support: {},
      notebookAndRecordUX: {},
      maps: {},
      sync: {},
      attachments: {},
      migration: {},
      auth: {},
      authProviders: {},
      authTokens: {},
      limits: {},
      email: {},
      observability: {},
      teamAndRolePolicy: {},
      webDesignerLimits: {},
      android: {},
      ios: {},
      couchdb: {},
      dev: {},
      pouchdb: {},
      secrets: {},
    });
  } else {
    const configPath = path.resolve(cwd, String(args.config));
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    parsed = parseBuildConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  }
  const envText = generateEnv({
    config: parsed,
    platform: 'apps',
    includeEmpty: true,
  });

  const result = validateGeneratedEnv({
    envText,
  });

  if (result.ok) {
    if (result.unexpected.length > 0) {
      console.log(
        `Generated env covers all consumer env keys ` +
          `(${result.unexpected.length} extra key(s) read by migrated consumers, informational).`
      );
    } else {
      console.log(`Generated env covers all consumer env keys.`);
    }
    return 0;
  }
  console.error(
    `Consumer env keys are not covered by the generated env ` +
      `(app/src/buildconfig.ts, Fastlane files).`
  );

  console.error(
    `Consumer keys not covered by the generated env (${result.missing.length}):`
  );
  for (const key of result.missing) {
    console.error(`  - ${key}`);
  }
  console.error(
    `\nIf these are new consumer variables, add a field + env-contract mapping to @faims3/build-config.`
  );

  if (result.unexpected.length > 0) {
    console.log(
      `\n(Informational) ${result.unexpected.length} generated key(s) are not read by any scanned (not-yet-migrated) consumer — typically consumed by migrated consumers:`
    );
    for (const key of result.unexpected) {
      console.log(`  - ${key}`);
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
