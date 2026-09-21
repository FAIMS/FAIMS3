/**
 * Typed accessors for e2e environment configuration.
 * Load dotenv before reading (see wdio hooks / loadE2eEnv).
 *
 * Only `e2e/.env` (falling back to `e2e/.env.dist`) is read. Never load
 * `api/.env` or the repo-root `.env` — those often hold staging/prod Couch
 * credentials.
 */
import {config as loadDotenv} from 'dotenv';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Couch URL keys that must look local unless {@link E2E_ALLOW_REMOTE_COUCH} is set. */
export const COUCH_TARGET_ENV_KEYS = [
  'COUCHDB_INTERNAL_URL',
  'COUCHDB_PUBLIC_URL',
] as const;

/**
 * Opt-out for the local-only Couch guard. Accepts the same truthy strings as
 * the shared config helpers (`true` / `1` / `on` / `yes`).
 */
export const E2E_ALLOW_REMOTE_COUCH = 'E2E_ALLOW_REMOTE_COUCH';

const TRUTHY_FLAG = new Set(['true', '1', 'on', 'yes']);

let envLoaded = false;

function isTruthyFlag(value: string | undefined): boolean {
  return value !== undefined && TRUTHY_FLAG.has(value.toLowerCase());
}

/** Loopback IPv4 (`127.0.0.0/8`), IPv6 (`::1`), `localhost`, and `*.localhost`. */
export function isLocalCouchHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  return octets.every(n => n <= 255) && octets[0] === 127;
}

/**
 * Parse a Couch target and throw unless the host looks local.
 * `allowRemote` skips the host check (the URL must still be valid http(s)).
 */
export function parseCouchTargetUrl(
  raw: string,
  name: string,
  allowRemote = false
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `${name} is not a valid URL. Expected an absolute http(s) CouchDB target.`
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `${name} must be http(s) (got ${url.protocol}). Refusing to use this CouchDB target.`
    );
  }
  if (!allowRemote && !isLocalCouchHostname(url.hostname)) {
    throw new Error(
      `${name} host "${url.hostname}" does not look local. ` +
        `e2e refuses remote CouchDB targets unless ${E2E_ALLOW_REMOTE_COUCH}=true.`
    );
  }
  return url;
}

/** Structured Couch settings after the local-target guard. */
export type ParsedCouchEnv = {
  internalUrl?: string;
  publicUrl?: string;
  allowRemote: boolean;
};

/**
 * Parse CouchDB targets from an env object. Throws if any set target does not
 * look local, unless {@link E2E_ALLOW_REMOTE_COUCH} is truthy.
 */
export function parseCouchEnv(
  env: NodeJS.ProcessEnv = process.env
): ParsedCouchEnv {
  const allowRemote = isTruthyFlag(env[E2E_ALLOW_REMOTE_COUCH]);
  for (const key of COUCH_TARGET_ENV_KEYS) {
    const value = env[key];
    if (!value) continue;
    parseCouchTargetUrl(value, key, allowRemote);
  }
  return {
    internalUrl: env.COUCHDB_INTERNAL_URL || undefined,
    publicUrl: env.COUCHDB_PUBLIC_URL || undefined,
    allowRemote,
  };
}

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
  parseCouchEnv();
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
  | 'projectGuest'
  | 'schemaTester';

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
  /** Contributor on the schema-compatibility fixture notebooks only (seed). */
  schemaTester: {
    user: 'TEST_SCHEMA_TESTER_USERNAME',
    pass: 'TEST_SCHEMA_TESTER_PASSWORD',
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
