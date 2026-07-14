/**
 * Typed accessors for e2e environment configuration.
 * Load dotenv before reading (see wdio hooks / loadE2eEnv).
 */
import {config as loadDotenv} from 'dotenv';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let envLoaded = false;

export function loadE2eEnv(): void {
  if (envLoaded) return;
  const envPath = resolve(e2eRoot, '.env');
  if (existsSync(envPath)) {
    loadDotenv({path: envPath});
  } else {
    const distPath = resolve(e2eRoot, '.env.dist');
    if (existsSync(distPath)) {
      loadDotenv({path: distPath});
    }
  }
  envLoaded = true;
}

export type ScreenshotMode = 'off' | 'on' | 'docs' | 'artifacts' | 'all';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy e2e/.env.dist → e2e/.env and seed the dataset.`
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export function getAppUrl(): string {
  return optionalEnv('WEB_APP_PUBLIC_URL', 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
}

export function getWebUrl(): string {
  return optionalEnv(
    'WEB_URL',
    optionalEnv('NEW_CONDUCTOR_URL', 'http://localhost:3001')
  ).replace(/\/$/, '');
}

export function getConductorUrl(): string {
  return optionalEnv('CONDUCTOR_URL', 'http://localhost:8080').replace(
    /\/$/,
    ''
  );
}

export function getScreenshotDir(): string {
  return optionalEnv('SCREENSHOT_DIR', './screenshots');
}

export function getArtifactDir(): string {
  return optionalEnv('ARTIFACT_DIR', './artifacts');
}

/**
 * Suite slug for artifact run ids (`smoke` | `web` | `app` | …).
 * Set via `E2E_SUITE` or `beginSuite()` in each WDIO conf entrypoint.
 */
export function getSuiteSlug(): string {
  const raw = (process.env.E2E_SUITE || 'e2e').toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'e2e';
}

export function setSuiteSlug(suite: string): string {
  const slug = suite
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  process.env.E2E_SUITE = slug || 'e2e';
  return process.env.E2E_SUITE;
}

export function getScreenshotMode(): ScreenshotMode {
  const mode = (process.env.SCREENSHOT_MODE || 'all').toLowerCase();
  if (
    mode === 'off' ||
    mode === 'on' ||
    mode === 'docs' ||
    mode === 'artifacts' ||
    mode === 'all'
  ) {
    return mode;
  }
  return 'all';
}

/** WDIO protocol/logger levels (quiet → loud). Default `warn` avoids flooding CI. */
export type WdioLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'silent';

export function getWdioLogLevel(): WdioLogLevel {
  const level = (process.env.WDIO_LOG_LEVEL || 'warn').toLowerCase();
  if (
    level === 'trace' ||
    level === 'debug' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error' ||
    level === 'silent'
  ) {
    return level;
  }
  return 'warn';
}

export function getTheme(): string {
  return optionalEnv('VITE_THEME', 'default');
}

export type PersonaKey =
  | 'operationsAdmin'
  | 'managerBlue'
  | 'managerCross'
  | 'memberBoth'
  | 'redMemberCreator'
  | 'user'
  | 'projectContributor'
  | 'projectGuest';

const PERSONA_ENV: Record<PersonaKey, {user: string; pass: string}> = {
  operationsAdmin: {
    user: 'TEST_OPERATIONS_ADMIN_USERNAME',
    pass: 'TEST_OPERATIONS_ADMIN_PASSWORD',
  },
  managerBlue: {
    user: 'TEST_MANAGER_BLUE_USERNAME',
    pass: 'TEST_MANAGER_BLUE_PASSWORD',
  },
  managerCross: {
    user: 'TEST_MANAGER_CROSS_USERNAME',
    pass: 'TEST_MANAGER_CROSS_PASSWORD',
  },
  memberBoth: {
    user: 'TEST_MEMBER_BOTH_USERNAME',
    pass: 'TEST_MEMBER_BOTH_PASSWORD',
  },
  redMemberCreator: {
    user: 'TEST_RED_MEMBER_CREATOR_USERNAME',
    pass: 'TEST_RED_MEMBER_CREATOR_PASSWORD',
  },
  user: {
    user: 'TEST_USER_USERNAME',
    pass: 'TEST_USER_PASSWORD',
  },
  projectContributor: {
    user: 'TEST_PROJECT_CONTRIBUTOR_USERNAME',
    pass: 'TEST_PROJECT_CONTRIBUTOR_PASSWORD',
  },
  projectGuest: {
    user: 'TEST_PROJECT_GUEST_USERNAME',
    pass: 'TEST_PROJECT_GUEST_PASSWORD',
  },
};

export type Credentials = {email: string; password: string};

export function getPersona(key: PersonaKey): Credentials {
  const mapping = PERSONA_ENV[key];
  return {
    email: requireEnv(mapping.user),
    password: requireEnv(mapping.pass),
  };
}

export function tryGetPersona(key: PersonaKey): Credentials | null {
  const mapping = PERSONA_ENV[key];
  const email = process.env[mapping.user];
  const password = process.env[mapping.pass];
  if (!email || !password) return null;
  return {email, password};
}
