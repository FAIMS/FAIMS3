/**
 * Script to validate that the generated .env file matches
 * the expected schema in app/ and web/.
 * Useful to check that we have not introduced any new configuration
 * variables that are not included in the JSON configuration file.
 *
 * The script works by first parsing the application configuration code
 * and the Fastlane files used to build the mobile apps to discover
 * the environment variables that are expected to be present.
 *
 * These are then checked against the generated .env file to ensure that
 * all expected variables are present and that no unexpected variables
 * are present.
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
 * The location of source files that use environment variables
 */
const APP_SCHEMA_PATH = path.resolve(repoRoot, 'app/src/buildconfig.ts');
const WEB_SCHEMA_PATH = path.resolve(repoRoot, 'web/src/constants.ts');
const FASTLANE_ANDROID_DIR = path.resolve(repoRoot, 'app/android/fastlane');
const FASTLANE_IOS_DIR = path.resolve(repoRoot, 'app/ios/App/fastlane');

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
 * @returns The text of the object literal that defines the environment variable schema
 */
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

/**
 * Given a TypeScript source file, extract the keys of the EnvSchema object literal.
 * @param filePath The path to the TypeScript source file
 * @returns A set of keys defined in the EnvSchema object literal
 */
function extractEnvSchemaKeys(filePath: string): Set<string> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const envObjectText = extractEnvObjectLiteral(sourceText);
  const keys = new Set<string>();

  const matches = envObjectText.matchAll(/\b(VITE_[A-Z0-9_]+)\s*:/g);
  for (const match of matches) {
    keys.add(match[1]);
  }

  return keys;
}

/**
 * Given a Fastlane file, extract the keys of the environment variables used in it.
 * @param filePath
 * @returns A set of keys of the environment variables used in the Fastlane file
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
 * Gather ENV keys that are used in the Fastlane files for IOS and Android builds
 * @returns A set of ENV keys used in the Fastlane files for IOS and Android builds
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

  // Initialise with two special keys that don't appear explicitly but are
  // required for Fastlane to work properly.
  const keys = new Set([
    'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD',
    'MATCH_PASSWORD',
  ]);

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

/**
 * Find all of the expected environment variable keys from
 * the app and web source files and the Fastlane files.
 * @returns A set of all expected environment variable keys
 */
export function getExpectedKeys(): Set<string> {
  const appKeys = extractEnvSchemaKeys(APP_SCHEMA_PATH);
  const webKeys = extractEnvSchemaKeys(WEB_SCHEMA_PATH);
  const fastlaneKeys = fastlaneEnvKeys();

  return new Set([...appKeys, ...webKeys, ...fastlaneKeys]);
}

/**
 * Given the text of a generated .env file, validate that it
 * contains all expected keys and no unexpected keys.
 */
export function validateGeneratedEnv({envText}: {envText: string}) {
  const generatedKeys = new Set(parseEnvText(envText).keys());
  const expectedKeys = getExpectedKeys();

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
      `Usage: pnpm --filter=@faims3/build-config run validate [--config path/to/config.json]`
    );
    return 0;
  }

  // Generate the .env text either from the supplied config file or from an empty one
  let parsed: ReturnType<typeof parseBuildConfig> | undefined = undefined;
  if (!args.config) {
    parsed = parseBuildConfig({
      app: {},
      web: {},
      mobile: {android: {}, ios: {}},
      build: {},
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
    platform: 'all',
    includeEmpty: true,
  });

  const result = validateGeneratedEnv({
    envText,
  });

  if (result.ok) {
    console.log(`Generated env matches the app/web schema.`);
    return 0;
  }
  console.error(
    `Found a mismatch between the configuration generated 
    by the build-config utility and the required schema in app/ or web/.  
    Check the output below for details.  If this is a new configuration variable,
    it will need to be added to the schema in library/build-config.`
  );

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

process.exit(main());
