// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Types shared by the notebook JSON schema migration harness.
 *
 * This harness mirrors the Couch database migration framework
 * (`migrations/types.ts`, `migrationService.ts`) and the map-tile IndexedDB
 * framework (`library/forms/.../maps/migrations`): a declarative registry of
 * `{from, to, migrationFunction, validateFunction}` steps, a path finder that
 * walks the registry from the document's version to the target, and a runner
 * that applies migrate + validate per step.
 *
 * Unlike those harnesses the version ids are **strict semver strings**
 * (`1.0.0`), plus one sentinel {@link NOTEBOOK_SCHEMA_LEGACY} for every
 * pre-epoch shape (missing version, the deprecated `1.0`…`7.0` ladder, or
 * anything else that is not `MAJOR.MINOR.PATCH`).
 */

import type {NotebookSchemaSemver} from '../../../uiSpecification/schemaVersion';

/**
 * Sentinel "version" for every notebook JSON that predates the strict-semver
 * epoch. The harness collapses all of them with a single `legacy → 1.0.0` step.
 */
export const NOTEBOOK_SCHEMA_LEGACY = 'legacy' as const;
export type NotebookSchemaLegacy = typeof NOTEBOOK_SCHEMA_LEGACY;

/** A version a migration step may start from: the legacy sentinel or a strict semver. */
export type NotebookSchemaMigrationFrom =
  | NotebookSchemaLegacy
  | NotebookSchemaSemver;

/** Optional context passed to every step (logging / provenance only; steps are pure). */
export type NotebookSchemaMigrationContext = {
  /** Source that triggered the migration (e.g. `api-put`, `app-ingest`, `designer`). */
  launchedBy?: string;
};

/**
 * Transform a notebook JSON value from the step's `from` shape to its `to`
 * shape. Must not mutate `input`; return a new value.
 */
export type NotebookSchemaMigrationFunction = (
  input: unknown,
  context?: NotebookSchemaMigrationContext
) => unknown;

/**
 * Assert that `output` matches the shape introduced by the step's `to` version.
 * Throws on failure (typically a Zod `parse` against that version's schema).
 */
export type NotebookSchemaValidateFunction = (output: unknown) => void;

/** One registered migration step. */
export type NotebookSchemaMigrationDetails = {
  /** Schema version (or legacy sentinel) this step consumes. */
  from: NotebookSchemaMigrationFrom;
  /** Strict schema version this step produces. */
  to: NotebookSchemaSemver;
  /** Short description of what the step changes. */
  description: string;
  /** Pure transform `from → to`. */
  migrationFunction: NotebookSchemaMigrationFunction;
  /** Validates the `to` shape after {@link migrationFunction} runs. */
  validateFunction: NotebookSchemaValidateFunction;
};

/** Record of one applied step, returned by the runner for logging / UI. */
export type NotebookSchemaMigrationLog = {
  from: NotebookSchemaMigrationFrom;
  to: NotebookSchemaSemver;
  description: string;
};

/** Thrown when a step cannot be identified, applied, or validated. */
export class NotebookSchemaMigrationError extends Error {
  readonly from?: NotebookSchemaMigrationFrom;
  readonly to?: NotebookSchemaSemver;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      from?: NotebookSchemaMigrationFrom;
      to?: NotebookSchemaSemver;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'NotebookSchemaMigrationError';
    this.from = options.from;
    this.to = options.to;
    this.cause = options.cause;
  }
}
