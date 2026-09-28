import {z} from 'zod';

/**
 * @file Strict semantic version primitives for the notebook JSON
 * `uiSpec.schemaVersion` field.
 *
 * The notebook schema uses a **strict `MAJOR.MINOR.PATCH`** epoch that started at
 * `1.0.0`. Anything that does not match this shape (missing, `null`, the
 * deprecated two-part `1.0`…`7.0` ladder, or garbage) is treated as *legacy* and
 * is collapsed by the migration harness rather than compared numerically.
 *
 * Compatibility tiers (see `schemaCompatibility.ts`):
 * - **patch** differences are silent
 * - a newer **minor** is degraded (render with a warning)
 * - a newer **major** is incompatible (reject the form graph)
 *
 * This module is a leaf: it must only depend on `zod` so that both the
 * `uiSpecification` types and the migration harness can import it without
 * creating an import cycle.
 */

/** Strict `MAJOR.MINOR.PATCH` — no leading zeros, no pre-release, no build metadata. */
export const NOTEBOOK_SCHEMA_SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Compile-time shape for schema version literals (`'1.0.0'`). Runtime values
 * that flow through Zod are plain `string`s validated by
 * {@link NotebookSchemaSemverSchema}.
 */
export type NotebookSchemaSemver = `${number}.${number}.${number}`;

/** Zod schema for a strict notebook schema semver string. */
export const NotebookSchemaSemverSchema = z
  .string()
  .regex(
    NOTEBOOK_SCHEMA_SEMVER_PATTERN,
    'schemaVersion must be a strict MAJOR.MINOR.PATCH version (e.g. 1.0.0)'
  );

/** Parsed numeric components of a strict schema version. */
export type ParsedNotebookSchemaSemver = {
  major: number;
  minor: number;
  patch: number;
};

/** True when `value` is a strict `MAJOR.MINOR.PATCH` string. */
export function isNotebookSchemaSemver(
  value: unknown
): value is NotebookSchemaSemver {
  return (
    typeof value === 'string' && NOTEBOOK_SCHEMA_SEMVER_PATTERN.test(value)
  );
}

/**
 * Parse a strict schema version into its numeric parts.
 *
 * @returns the parsed components, or `undefined` when `value` is not a strict
 * `MAJOR.MINOR.PATCH` string (legacy two-part versions return `undefined`).
 */
export function parseNotebookSchemaSemver(
  value: unknown
): ParsedNotebookSchemaSemver | undefined {
  if (!isNotebookSchemaSemver(value)) {
    return undefined;
  }
  const [major, minor, patch] = value.split('.').map(part => Number(part));
  return {major, minor, patch};
}

/** Format parsed components back into a strict semver string. */
export function formatNotebookSchemaSemver({
  major,
  minor,
  patch,
}: ParsedNotebookSchemaSemver): NotebookSchemaSemver {
  return `${major}.${minor}.${patch}`;
}

/**
 * Compare two strict schema versions numerically.
 *
 * @returns negative when `a < b`, `0` when equal, positive when `a > b`
 * @throws when either input is not a strict `MAJOR.MINOR.PATCH` string
 */
export function compareNotebookSchemaSemver(
  a: NotebookSchemaSemver | string,
  b: NotebookSchemaSemver | string
): number {
  const pa = parseNotebookSchemaSemver(a);
  const pb = parseNotebookSchemaSemver(b);
  if (!pa || !pb) {
    throw new Error(
      `Cannot compare notebook schema versions: '${String(a)}' vs '${String(b)}' (both must be strict MAJOR.MINOR.PATCH)`
    );
  }
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}
