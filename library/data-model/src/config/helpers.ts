/*
 * Shared Zod schema factories for environment / runtime configuration.
 *
 * These helpers return Zod schemas — they do not read `process.env` or
 * `import.meta.env` themselves. Wire them into a schema object whose keys are
 * the env var names, then parse the env object once.
 *
 * Prefer importing the namespaced `{configHelpers}` object from
 * `@faims3/data-model` (e.g. `configHelpers.isBlank`, `configHelpers.optionalEnum`)
 * rather than these symbols directly.
 */

import {z} from 'zod';

export const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'] as const;
export const FALSEY_STRINGS = ['false', '0', 'off', 'no'] as const;

/** True when a string env value is missing or empty. */
export const isBlank = (v: string | undefined): v is undefined | '' =>
  v === undefined || v === '';

/** `.env` often supplies `""`; treat that as unset for optional enums. */
export const emptyToUndefined = <T>(v: T): Exclude<T, ''> | undefined =>
  v === undefined || v === '' ? undefined : (v as Exclude<T, ''>);

/**
 * Optional enum; blank/`""` → undefined; invalid values fail parse.
 *
 * Implemented with `.transform().pipe()` (not `preprocess`) so the schema keeps
 * a typed string input and a precise enum output when composed into objects.
 */
export const optionalEnum = <const T extends readonly [string, ...string[]]>(
  values: T
) =>
  z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.enum(values).optional());

/** Enum with default; blank/`""` → default; invalid values fail parse. */
export const enumDefault = <const T extends readonly [string, ...string[]]>(
  values: T,
  def: T[number]
) =>
  z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.enum(values).default(def));

/** Native TS string enum with default; blank/`""` → default; invalid values fail parse. */
export const nativeEnumDefault = <const T extends Record<string, string>>(
  values: T,
  def: T[keyof T]
) =>
  z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.enum(values).default(def));

/**
 * Optional string schema; blank becomes the provided default.
 * When `label` is set (typically the env var name), logs a warning naming the
 * key and the default applied.
 */
export const stringDefault = (def: string, label?: string) =>
  z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        if (label) {
          console.warn(
            `No value for ${label} was provided in the environment. Defaulting to ${def}.`
          );
        }
        return def;
      }
      return v;
    });

/**
 * Integer schema with default. Blank or unparseable falls back to `def`.
 * When `label` is set, unparseable values are logged.
 */
export const intDefault = (def: number, label?: string) =>
  z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) return def;
      const parsed = parseInt(v, 10);
      if (Number.isNaN(parsed)) {
        if (label) console.error(`${label} unparseable, defaulting to ${def}`);
        return def;
      }
      return parsed;
    });

/** Boolean where any of the truthy strings (case-insensitive) means true. */
export const truthyBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform(v =>
      isBlank(v)
        ? def
        : (TRUTHY_STRINGS as readonly string[]).includes(v.toLowerCase())
    );

/**
 * Boolean where only the exact (case-insensitive) string 'true' means true.
 * A blank/undefined value falls back to the provided default.
 */
export const equalsTrueBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform(v => (v === undefined ? def : v.toLowerCase() === 'true'));

/**
 * Boolean schema from the truthy/falsey string sets. Blank → `def`; an
 * unrecognised value fails parse.
 */
export const boolWithDefault = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (isBlank(v)) return def;
      const lower = v.toLowerCase();
      if ((FALSEY_STRINGS as readonly string[]).includes(lower)) return false;
      if ((TRUTHY_STRINGS as readonly string[]).includes(lower)) return true;
      ctx.addIssue({
        code: 'custom',
        message: `Invalid boolean value "${v}". Expected one of: ${[
          ...TRUTHY_STRINGS,
          ...FALSEY_STRINGS,
        ].join(', ')}`,
      });
      return z.NEVER;
    });

/** Truthy-string boolean with a default when blank. */
export const truthyOnlyBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform(v =>
      isBlank(v)
        ? def
        : (TRUTHY_STRINGS as readonly string[]).includes(v.toLowerCase())
    );

/** Boolean that is only true when the (exact) value equals `match`. */
export const truthyOnlyEquals = (match: string) =>
  z
    .string()
    .optional()
    .transform(v => v === match);

/** Comma-separated uppercase list schema; blank → `def`. */
export const csvUpperWithDefault = (def: string[]) =>
  z
    .string()
    .optional()
    .transform(v =>
      v === undefined || v.trim() === ''
        ? def
        : v
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean)
    );

/**
 * URL-like string that strips a trailing slash. Blank uses `def` and logs
 * via `label`.
 */
export const urlNoTrailingSlash = (def: string, label: string) =>
  z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log(`${label} not set, using default`);
        return def;
      }
      if (v.endsWith('/')) {
        console.log(`${label} should not end with / - removing it`);
        return v.substring(0, v.length - 1);
      }
      return v;
    });

/** Returns a required env value, throwing if it is missing/empty. */
export function requiredEnv(value: string | undefined, key: string): string {
  if (isBlank(value)) {
    throw new Error(`Missing required env variable ${key}`);
  }
  return value;
}

/** Optional string; blank becomes undefined. */
export const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v): string | undefined => (isBlank(v) ? undefined : v));
