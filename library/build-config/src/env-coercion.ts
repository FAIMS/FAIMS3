// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';

/**
 * Shared env-string coercion helpers.
 *
 * These implement:
 *  - strict — an invalid value is a parse error, never a silent default.
 *  - one boolean vocabulary for every boolean-typed env value.
 *
 * Env values are always strings here: the generator stringifies every value,
 * and hand-written `.env` files are strings. Coercion to the typed value
 * happens once, in these schemas, so the apps and api env parsers agree.
 */

export const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'] as const;
export const FALSEY_STRINGS = ['false', '0', 'off', 'no'] as const;

const TRUTHY = new Set<string>(TRUTHY_STRINGS);
const FALSEY = new Set<string>(FALSEY_STRINGS);

/**
 * A boolean value from the environment. Case-insensitive; anything else is an
 * error. The generator emits `true`/`false`, so this is a strict superset of
 * what this module ever produces.
 */
export const BoolEnvSchema = z.string().transform((value, ctx) => {
  const lower = value.trim().toLowerCase();
  if (TRUTHY.has(lower)) return true;
  if (FALSEY.has(lower)) return false;
  ctx.addIssue({
    code: 'custom',
    message: `Invalid boolean "${value}". Expected one of: ${[
      ...TRUTHY_STRINGS,
      ...FALSEY_STRINGS,
    ].join(', ')}.`,
  });
  return z.NEVER;
});

/** Positive integer from a decimal string. Strict: non-numeric is an error. */
export const PositiveIntStringSchema = z
  .string()
  .regex(/^[0-9]+$/, {message: 'Must be a positive integer.'})
  .transform(value => Number.parseInt(value, 10))
  .pipe(z.number().int().positive());

/**
 * Comma-separated list of strings. Blank/whitespace-only → empty array.
 * Trims entries and drops empties.
 */
export const OptionalCsvSchema = z.string().transform(value =>
  (value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
);

/** Like OptionalCsvSchema but uppercases each entry (ISO country codes). */
export const UpperCsvSchema = z.string().transform(value =>
  (value ?? '')
    .split(',')
    .map(entry => entry.trim().toUpperCase())
    .filter(entry => entry.length > 0)
);

/** Strip a single trailing slash from a URL string (blank stays blank). */
export const stripTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.substring(0, value.length - 1) : value;

/** Words that mean "no maximum" for the long-lived token duration (D4). */
export const NO_MAXIMUM_WORDS = ['unlimited', 'infinite', 'none'] as const;

/** The canonical no-cap sentinel (matches the JSON schema's `'unlimited'`). */
export const NO_MAXIMUM = 'unlimited' as const;

/**
 * Parse `MAXIMUM_LONG_LIVED_DURATION_DAYS`.
 *  - blank → `def`
 *  - `unlimited` / `infinite` / `none` (case-insensitive) → `'unlimited'`
 *    (the canonical no-cap sentinel)
 *  - positive integer string → that number
 *  - anything else → error (D1).
 */
export function parseMaxLongLivedDays(
  value: string | undefined,
  def = 90
): number | typeof NO_MAXIMUM {
  const v = (value ?? '').trim();
  if (v === '') return def;
  if ((NO_MAXIMUM_WORDS as readonly string[]).includes(v.toLowerCase())) {
    return NO_MAXIMUM;
  }
  if (!/^[0-9]+$/.test(v)) {
    throw new Error(
      `Invalid value "${v}" for MAXIMUM_LONG_LIVED_DURATION_DAYS. ` +
        `Must be a positive integer or one of ${NO_MAXIMUM_WORDS.join(', ')}.`
    );
  }
  const n = Number.parseInt(v, 10);
  if (n <= 0) {
    throw new Error(
      `Invalid value "${v}" for MAXIMUM_LONG_LIVED_DURATION_DAYS. Must be positive.`
    );
  }
  return n;
}

// ---------------------------------------------------------------------------
// Commit-version sanitisation, ported from app/src/buildconfig.ts so the
// shared parser rejects the same garbage the app would hide.
// ---------------------------------------------------------------------------

/** Full or abbreviated git object id (SHA-1 / SHA-256). */
const GIT_COMMIT_HASH = /^[0-9a-f]{7,64}$/i;
/** Store / nightly build stamps, e.g. `v1.2.3-ios-#abc1234`. */
const RELEASE_COMMIT_STAMP =
  /^v\d+\.\d+\.\d+-(?:ios|android)-#[0-9a-f]{7,40}$/i;

const COMMIT_FALSEY = new Set<string>([...FALSEY_STRINGS, 'null', 'undefined']);

/**
 * Accept a git commit hash or a release stamp; treat blanks, falsey words and
 * anything that is not one of those as `undefined`.
 */
export function sanitizeCommitVersion(
  value: string | undefined
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || COMMIT_FALSEY.has(trimmed.toLowerCase()))
    return undefined;
  if (GIT_COMMIT_HASH.test(trimmed) || RELEASE_COMMIT_STAMP.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/**
 * A bugsnag key that is blank or the literal string `false` (case-insensitive)
 * is treated as "off" → `undefined`. Mirrors the app's behaviour.
 */
/**
 * Resolve the Vite `define` inject `__APP_VERSION__` (package.json version
 * at build time — not an import.meta.env key). Falls back to `unknown`.
 */
export function resolveInjectedAppVersion(
  injected: string | undefined
): string {
  if (injected) {
    console.info(`Using APP_VERSION from build: ${injected}`);
    return injected;
  }
  console.warn('__APP_VERSION__ not set in build. Using "unknown"');
  return 'unknown';
}

export function parseBugsnagKey(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (v === '' || v.toLowerCase() === 'false') return undefined;
  return v;
}
