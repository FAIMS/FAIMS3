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
 * @file Runner for the notebook schema migration harness: read the version,
 * find the path, apply each step's migrate + validate in order.
 */

import type {NotebookDefinition} from '../../../uiSpecification/types';
import {
  identifyNotebookSchemaMigrations,
  resolveNotebookSchemaMigrationStart,
} from './identify';
import {NOTEBOOK_UI_SCHEMA_TARGET_VERSION} from './registry';
import {
  NotebookSchemaMigrationError,
  type NotebookSchemaMigrationContext,
  type NotebookSchemaMigrationLog,
} from './types';
import {
  getNotebookSchemaVersion,
  type NotebookWithSchemaVersion,
} from './version';

export type MigrateNotebookResult = {
  /** True when at least one step ran. */
  changed: boolean;
  /** Notebook at {@link NOTEBOOK_UI_SCHEMA_TARGET_VERSION}. */
  migrated: NotebookDefinition;
  /** Steps applied, in order (empty when already current). */
  applied: NotebookSchemaMigrationLog[];
};

/**
 * Migrate a notebook JSON value to the current schema version.
 *
 * - Legacy input (no version, deprecated `1.0`…`7.0`, or unparseable) is
 *   collapsed by the `legacy → 1.0.0` step.
 * - Input already at the target is returned unchanged (`changed: false`).
 * - Input **newer** than the target throws — callers should classify forward
 *   compatibility with `assessNotebookSchemaCompatibility` before migrating.
 *
 * Each step's `migrationFunction` is followed by its `validateFunction`; any
 * failure is wrapped in {@link NotebookSchemaMigrationError} with the step's
 * `from`/`to` for diagnostics.
 *
 * @param notebook possibly a notebook, at any historical shape
 * @param context optional provenance for logging
 */
export const migrateNotebook = (
  notebook: unknown,
  context?: NotebookSchemaMigrationContext
): MigrateNotebookResult => {
  const start = resolveNotebookSchemaMigrationStart(
    getNotebookSchemaVersion((notebook ?? {}) as NotebookWithSchemaVersion)
  );

  const steps = identifyNotebookSchemaMigrations({
    from: start,
    to: NOTEBOOK_UI_SCHEMA_TARGET_VERSION,
  });

  if (steps.length === 0) {
    return {
      changed: false,
      migrated: notebook as NotebookDefinition,
      applied: [],
    };
  }

  let current: unknown = notebook;
  const applied: NotebookSchemaMigrationLog[] = [];

  for (const step of steps) {
    try {
      current = step.migrationFunction(current, context);
    } catch (cause) {
      if (cause instanceof NotebookSchemaMigrationError) throw cause;
      throw new NotebookSchemaMigrationError(
        `Notebook schema migration ${step.from} → ${step.to} failed: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        {from: step.from, to: step.to, cause}
      );
    }

    try {
      step.validateFunction(current);
    } catch (cause) {
      throw new NotebookSchemaMigrationError(
        `Notebook schema migration ${step.from} → ${step.to} produced an invalid document: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        {from: step.from, to: step.to, cause}
      );
    }

    applied.push({from: step.from, to: step.to, description: step.description});
  }

  return {changed: true, migrated: current as NotebookDefinition, applied};
};
