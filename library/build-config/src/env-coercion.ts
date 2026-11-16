// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import {
  DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV,
  DEFAULT_GDAL_NUM_THREADS,
  parseCapacityScaleThresholds,
} from './shared-schemas.js';

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

/** Accepted truthy env strings (case-insensitive). */
export const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'] as const;
/** Accepted falsey env strings (case-insensitive). */
export const FALSEY_STRINGS = ['false', '0', 'off', 'no'] as const;

const TRUTHY = new Set<string>(TRUTHY_STRINGS);
const FALSEY = new Set<string>(FALSEY_STRINGS);

function parseBoolValue(value: unknown, ctx: z.RefinementCtx): boolean {
  const lower = String(value).trim().toLowerCase();
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
}

/**
 * A boolean value from the environment. Case-insensitive; anything else is an
 * error. The generator emits `true`/`false`, so this is a strict superset of
 * what this module ever produces.
 */
export const BoolEnvSchema = z.string().transform((value, ctx) => {
  return parseBoolValue(value, ctx);
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

/**
 * Blank or the literal `false` (case-insensitive) means Bugsnag is off.
 * Any other non-empty string is the client API key.
 */
export function parseBugsnagKey(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (v === '' || v.toLowerCase() === 'false') return undefined;
  return v;
}

// ---------------------------------------------------------------------------
// Declarative ENV field builders for client-specific schemas.
// Missing required values fail parse; invalid present values fail parse;
// omitted optional values use an explicit default or stay undefined.
// ---------------------------------------------------------------------------

/** True for missing, null, or whitespace-only env values. */
const isBlankEnv = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

/** Coerce an env cell to a string; null/undefined stay undefined. */
function asEnvString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** Rejects missing or whitespace-only strings, naming the env key. */
export function requiredEnvString(envKey: string) {
  return z.unknown().transform((value, ctx) => {
    const trimmed = (asEnvString(value) ?? '').trim();
    if (!trimmed) {
      ctx.addIssue({
        code: 'custom',
        message: `Missing required env variable ${envKey}`,
      });
      return z.NEVER;
    }
    return trimmed;
  });
}

/** Requires a non-empty URL. Custom schemes (app deep links) are accepted. */
export function requiredEnvUrl(
  envKey: string,
  options: {stripSlash?: boolean} = {}
) {
  const stripSlash = options.stripSlash ?? true;
  return z.unknown().transform((value, ctx) => {
    const trimmed = (asEnvString(value) ?? '').trim();
    if (!trimmed) {
      ctx.addIssue({
        code: 'custom',
        message: `Missing required env variable ${envKey}`,
      });
      return z.NEVER;
    }
    try {
      new URL(trimmed);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: `Invalid URL for ${envKey}: "${trimmed}"`,
      });
      return z.NEVER;
    }
    return stripSlash ? stripTrailingSlash(trimmed) : trimmed;
  });
}

/**
 * CSV of URLs. Requires at least one entry; each entry must parse as a URL
 * (http(s) or a custom scheme such as `org.example.app://auth-return`).
 */
export function requiredUrlCsv(envKey: string) {
  return z.unknown().transform((value, ctx) => {
    const raw = asEnvString(value);
    if (isBlankEnv(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: `Missing required env variable ${envKey}`,
      });
      return z.NEVER;
    }
    const entries = (raw ?? '')
      .split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);
    if (entries.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: `${envKey} must contain at least one valid URL.`,
      });
      return z.NEVER;
    }
    for (const entry of entries) {
      try {
        new URL(entry);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid URL in ${envKey}: "${entry}"`,
        });
        return z.NEVER;
      }
    }
    return entries;
  });
}

/** Blank / missing → `undefined`; otherwise a trimmed string. */
export function optionalEnvString() {
  return z
    .unknown()
    .optional()
    .transform((value): string | undefined => {
      if (isBlankEnv(value)) return undefined;
      return String(value).trim();
    });
}

/** Blank / missing → `def`; otherwise the trimmed string. */
export function stringWithDefault(def: string) {
  return z
    .unknown()
    .optional()
    .transform((value): string => {
      if (isBlankEnv(value)) return def;
      return String(value).trim();
    });
}

/** Blank / missing → `def`; invalid boolean vocabulary fails parse. */
export function boolWithDefault(def: boolean) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return def;
      return parseBoolValue(value, ctx);
    });
}

/** Blank / missing → `undefined`; present values use the boolean vocabulary. */
export function optionalBool() {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return undefined;
      return parseBoolValue(value, ctx);
    });
}

/** Blank / missing → `def`; non-numeric or non-positive fails parse. */
export function intWithDefault(def: number) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return def;
      const raw = String(value).trim();
      if (!/^[0-9]+$/.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be a positive integer.`,
        });
        return z.NEVER;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be a positive integer.`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

/** Blank / missing → `def`; non-numeric or negative fails parse (`0` allowed). */
export function nonNegativeIntWithDefault(def: number) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return def;
      const raw = String(value).trim();
      if (!/^[0-9]+$/.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be a non-negative integer.`,
        });
        return z.NEVER;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be a non-negative integer.`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

/** Blank / missing → `undefined`; non-numeric or negative fails parse (`0` allowed). */
export function optionalNonNegativeInt(envKey?: string) {
  const message = envKey
    ? `${envKey} must be a non-negative integer`
    : 'Must be a non-negative integer.';
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return undefined;
      const raw = String(value).trim();
      if (!/^[0-9]+$/.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message,
        });
        return z.NEVER;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        ctx.addIssue({
          code: 'custom',
          message,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

/** Blank / missing → `undefined`; non-numeric or non-positive fails parse. */
export function optionalPositiveInt(envKey?: string) {
  const message = envKey
    ? `${envKey} must be a positive integer`
    : 'Must be a positive integer.';
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return undefined;
      const raw = String(value).trim();
      if (!/^[0-9]+$/.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message,
        });
        return z.NEVER;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: 'custom',
          message,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

/**
 * `GDAL_NUM_THREADS`: blank / missing → `def`, `ALL_CPUS` (case-insensitive)
 * → `'ALL_CPUS'`, positive integer → stringified integer, else fails parse.
 */
export function gdalNumThreadsWithDefault(
  def: string = DEFAULT_GDAL_NUM_THREADS
) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return def;
      const raw = String(value).trim();
      if (raw.toUpperCase() === 'ALL_CPUS') return 'ALL_CPUS';
      if (!/^[0-9]+$/.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message: 'GDAL_NUM_THREADS must be ALL_CPUS or a positive integer',
        });
        return z.NEVER;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'GDAL_NUM_THREADS must be ALL_CPUS or a positive integer',
        });
        return z.NEVER;
      }
      return String(parsed);
    });
}

/**
 * `CAPACITY_SCALE_THRESHOLDS`: blank / missing → parsed `defCsv`, else
 * strictly increasing positive integers.
 */
export function capacityScaleThresholdsWithDefault(
  defCsv: string = DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV
) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      const raw = isBlankEnv(value) ? defCsv : String(value);
      try {
        return parseCapacityScaleThresholds(raw);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : String(error),
        });
        return z.NEVER;
      }
    });
}

/** Zod enum schema that exposes `.options` for error messages. */
type ZodEnumSchema = z.ZodType<string> & {readonly options: readonly string[]};

/**
 * Match an env string against a Zod enum, trying the raw value then
 * lower/upper case so historical `MAPBOX` / `NONE` still parse.
 */
function parseEnumValue<T extends ZodEnumSchema>(
  enumSchema: T,
  value: unknown
): {success: true; data: z.infer<T>} | {success: false} {
  const raw = String(value).trim();
  for (const candidate of [raw, raw.toLowerCase(), raw.toUpperCase()]) {
    const parsed = enumSchema.safeParse(candidate);
    if (parsed.success) return {success: true, data: parsed.data};
  }
  return {success: false};
}

/**
 * Missing / null → `def`. A present value that is a valid enum member is
 * kept, including `''` when the schema allows it (map source: blank
 * disables the map). Other blank strings still use `def`.
 */
export function enumWithDefault<T extends ZodEnumSchema>(
  enumSchema: T,
  def: z.infer<T>
) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null) return def;
      const parsed = parseEnumValue(enumSchema, value);
      if (parsed.success) return parsed.data;
      if (isBlankEnv(value)) return def;
      ctx.addIssue({
        code: 'custom',
        message: `Invalid value "${value}". Expected one of: ${enumSchema.options.join(', ')}.`,
      });
      return z.NEVER;
    });
}

/** Blank / missing → `undefined`; otherwise must be a member of `enumSchema`. */
export function optionalEnum<T extends ZodEnumSchema>(enumSchema: T) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (isBlankEnv(value)) return undefined;
      const parsed = parseEnumValue(enumSchema, value);
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid value "${value}". Expected one of: ${enumSchema.options.join(', ')}.`,
        });
        return z.NEVER;
      }
      return parsed.data;
    });
}

/** Blank / missing → `def`; otherwise parseMaxLongLivedDays. */
export function maxLongLivedDaysWithDefault(def = 90) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      try {
        return parseMaxLongLivedDays(asEnvString(value), def);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : String(error),
        });
        return z.NEVER;
      }
    });
}
