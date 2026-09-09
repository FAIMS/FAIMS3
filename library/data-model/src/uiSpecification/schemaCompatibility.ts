import {z, ZodError} from 'zod';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
  NOTEBOOK_SCHEMA_LEGACY,
  resolveNotebookSchemaMigrationStart,
  type NotebookSchemaMigrationContext,
} from '../data_storage/migrations/notebookMigrations';
import {
  compareNotebookSchemaSemver,
  parseNotebookSchemaSemver,
} from './schemaVersion';
import {
  NotebookDefinitionSchema,
  NotebookInformationSchema,
  NotebookSettingsSchema,
  type NotebookDefinition,
} from './types';

/**
 * @file Notebook schema compatibility classifier and the app **read path**
 * (`ingestNotebookUiSpecification`).
 *
 * The write path (`normalizeNotebookUiSpecification`) is strict: migrate to
 * current, then exact Zod, then assert the version equals `CURRENT`. The read
 * path is *fail-soft*: it never throws for a version mismatch; instead it
 * returns a {@link NotebookSchemaCompatibility} tier the UI can act on:
 *
 * | notebook vs app `CURRENT`            | tier           | behaviour                              |
 * |--------------------------------------|----------------|----------------------------------------|
 * | legacy (non `X.Y.Z`) or older epoch  | `compatible`   | migrate + strict Zod                   |
 * | equal, or same major.minor / patch ≠ | `compatible`   | strict Zod, no migration               |
 * | same major, newer minor              | `degraded`     | relaxed parse, render with a warning   |
 * | newer major                          | `incompatible` | form graph not parsed; skeleton only   |
 * | migration / validation failure       | `incompatible` | skeleton + diagnostic                  |
 */

/** Rendering tier for a notebook relative to this build. */
export type NotebookSchemaCompatibilityTier =
  | 'compatible'
  | 'degraded'
  | 'incompatible';

/** How the notebook's version relates to the app's `CURRENT`. */
export type NotebookSchemaVersionRelation =
  /** Not a strict `X.Y.Z` (missing, deprecated `1.0`…`7.0`, garbage). Needs the collapse. */
  | 'legacy'
  /** Strict semver lower than `CURRENT`. Needs a path migration. */
  | 'older'
  /** Exactly `CURRENT`. */
  | 'current'
  /** Same major.minor, higher patch. */
  | 'newer-patch'
  /** Same major, higher minor. */
  | 'newer-minor'
  /** Higher major. */
  | 'newer-major';

/** Result of classifying a notebook's schema version against the app. */
export type NotebookSchemaCompatibility = {
  tier: NotebookSchemaCompatibilityTier;
  relation: NotebookSchemaVersionRelation;
  /** Raw `schemaVersion` as found on the document (may be legacy or missing). */
  notebookSchemaVersion?: string;
  /** The `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION` used for the comparison. */
  appSchemaVersion: string;
  /** True when the document must be migrated before strict validation. */
  requiresMigration: boolean;
  /** Human readable explanation suitable for a diagnostic report. */
  reason: string;
};

/**
 * Pure version classifier. Does not look at the document body and does not
 * run migrations; `legacy` / `older` are reported as `compatible` *contingent
 * on migration succeeding* (`requiresMigration: true`).
 */
export function assessNotebookSchemaCompatibility(
  notebookVersion: unknown,
  appVersion: string = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
): NotebookSchemaCompatibility {
  const raw =
    notebookVersion === undefined || notebookVersion === null
      ? undefined
      : String(notebookVersion);
  const start = resolveNotebookSchemaMigrationStart(notebookVersion);

  if (start === NOTEBOOK_SCHEMA_LEGACY) {
    return {
      tier: 'compatible',
      relation: 'legacy',
      notebookSchemaVersion: raw,
      appSchemaVersion: appVersion,
      requiresMigration: true,
      reason:
        raw === undefined
          ? 'Notebook has no schemaVersion; it will be migrated to the current schema.'
          : `Notebook schemaVersion '${raw}' predates the semantic-versioning epoch; it will be migrated to ${appVersion}.`,
    };
  }

  const nb = parseNotebookSchemaSemver(start)!;
  const app = parseNotebookSchemaSemver(appVersion);
  if (!app) {
    throw new Error(
      `App notebook schema version '${appVersion}' is not a strict MAJOR.MINOR.PATCH`
    );
  }

  const cmp = compareNotebookSchemaSemver(start, appVersion);
  const base = {notebookSchemaVersion: raw, appSchemaVersion: appVersion};

  if (cmp === 0) {
    return {
      ...base,
      tier: 'compatible',
      relation: 'current',
      requiresMigration: false,
      reason: `Notebook schemaVersion ${start} matches this app.`,
    };
  }

  if (cmp < 0) {
    return {
      ...base,
      tier: 'compatible',
      relation: 'older',
      requiresMigration: true,
      reason: `Notebook schemaVersion ${start} is older than this app (${appVersion}); it will be migrated.`,
    };
  }

  if (nb.major > app.major) {
    return {
      ...base,
      tier: 'incompatible',
      relation: 'newer-major',
      requiresMigration: false,
      reason: `Notebook schemaVersion ${start} has a newer major version than this app understands (${appVersion}). Update the app to open this notebook.`,
    };
  }

  if (nb.minor > app.minor) {
    return {
      ...base,
      tier: 'degraded',
      relation: 'newer-minor',
      requiresMigration: false,
      reason: `Notebook schemaVersion ${start} is newer than this app (${appVersion}). Some features may not display correctly; update the app for full support.`,
    };
  }

  return {
    ...base,
    tier: 'compatible',
    relation: 'newer-patch',
    requiresMigration: false,
    reason: `Notebook schemaVersion ${start} is a newer patch of the app schema (${appVersion}); no impact expected.`,
  };
}

/** Thrown / returned when a notebook cannot be safely interpreted by this build. */
export class IncompatibleNotebookSchemaError extends Error {
  readonly compatibility: NotebookSchemaCompatibility;
  readonly cause?: unknown;

  constructor(
    compatibility: NotebookSchemaCompatibility,
    options?: {cause?: unknown; message?: string}
  ) {
    super(options?.message ?? compatibility.reason);
    this.name = 'IncompatibleNotebookSchemaError';
    this.compatibility = compatibility;
    this.cause = options?.cause;
  }
}

/**
 * Relaxed shape for **degraded** (newer-minor) notebooks: require only the
 * graph containers and pass everything else through. Missing `settings` /
 * `information` are defaulted so downstream readers do not crash. The result
 * is cast to {@link NotebookDefinition} as a best-effort render.
 */
const RelaxedNotebookDefinitionSchema = z
  .object({
    uiSpec: z
      .object({
        fields: z.record(z.string(), z.any()),
        views: z.record(z.string(), z.any()),
        viewsets: z.record(z.string(), z.any()),
        visible_types: z.array(z.string()).default([]),
        settings: NotebookSettingsSchema.partial()
          .passthrough()
          .default({})
          .transform(s => ({showQrCodeButton: false, ...s})),
        schemaVersion: z.string(),
      })
      .passthrough(),
    metadata: z
      .object({
        information: NotebookInformationSchema.partial()
          .passthrough()
          .optional()
          .transform(i => ({
            notebookVersion: '',
            purposeMarkdown: '',
            projectLeadLabel: '',
            leadInstitution: '',
            ...(i ?? {}),
          })),
        custom: z.record(z.string(), z.any()).optional(),
      })
      .passthrough()
      .optional()
      .transform(
        m =>
          m ?? {
            information: {
              notebookVersion: '',
              purposeMarkdown: '',
              projectLeadLabel: '',
              leadInstitution: '',
            },
          }
      ),
  })
  .passthrough();

export type IngestNotebookUiSpecificationResult =
  | {
      ok: true;
      definition: NotebookDefinition;
      compatibility: NotebookSchemaCompatibility;
      error?: undefined;
    }
  | {
      ok: false;
      definition?: undefined;
      compatibility: NotebookSchemaCompatibility;
      error: IncompatibleNotebookSchemaError;
    };

function describeError(cause: unknown): string {
  if (cause instanceof ZodError) {
    return cause.issues
      .map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'uiSpec';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
  }
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

function incompatible(
  compatibility: NotebookSchemaCompatibility,
  reason: string,
  cause?: unknown
): IngestNotebookUiSpecificationResult {
  const downgraded: NotebookSchemaCompatibility = {
    ...compatibility,
    tier: 'incompatible',
    reason,
  };
  return {
    ok: false,
    compatibility: downgraded,
    error: new IncompatibleNotebookSchemaError(downgraded, {cause}),
  };
}

/**
 * App read path: classify, migrate when needed, parse at the strictness the
 * tier allows, and never throw for a version mismatch.
 *
 * @param raw the `uiSpecification` value from the API / local store
 * @param options.appSchemaVersion override `CURRENT` (tests)
 * @param options.context provenance passed to migration steps
 */
export function ingestNotebookUiSpecification(
  raw: unknown,
  options: {
    appSchemaVersion?: string;
    context?: NotebookSchemaMigrationContext;
  } = {}
): IngestNotebookUiSpecificationResult {
  const appSchemaVersion =
    options.appSchemaVersion ?? CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    const compat = assessNotebookSchemaCompatibility(
      undefined,
      appSchemaVersion
    );
    return incompatible(
      compat,
      'Notebook uiSpecification is missing or is not a JSON object.'
    );
  }

  const rawVersion = getNotebookSchemaVersion(raw as any);
  const compatibility = assessNotebookSchemaCompatibility(
    rawVersion,
    appSchemaVersion
  );

  // Newer major: do not attempt to interpret the form graph.
  if (compatibility.tier === 'incompatible') {
    return {
      ok: false,
      compatibility,
      error: new IncompatibleNotebookSchemaError(compatibility),
    };
  }

  // Newer minor: relaxed parse, best-effort render.
  if (compatibility.tier === 'degraded') {
    const relaxed = RelaxedNotebookDefinitionSchema.safeParse(raw);
    if (!relaxed.success) {
      return incompatible(
        compatibility,
        `${compatibility.reason} The notebook could not be read even in compatibility mode: ${describeError(relaxed.error)}`,
        relaxed.error
      );
    }
    return {
      ok: true,
      definition: relaxed.data as unknown as NotebookDefinition,
      compatibility,
    };
  }

  // Legacy / older: migrate first. Current / newer patch: parse as-is.
  let candidate: unknown = raw;
  if (compatibility.requiresMigration) {
    try {
      candidate = migrateNotebook(raw, options.context).migrated;
    } catch (cause) {
      return incompatible(
        compatibility,
        `Notebook could not be migrated to schema ${appSchemaVersion}: ${describeError(cause)}`,
        cause
      );
    }
  }

  const parsed = NotebookDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    return incompatible(
      compatibility,
      `Notebook failed validation against schema ${appSchemaVersion}: ${describeError(parsed.error)}`,
      parsed.error
    );
  }

  return {ok: true, definition: parsed.data, compatibility};
}
