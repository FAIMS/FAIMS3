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
 * @file Test helpers for the notebook schema migration harness — the
 * counterpart of the table-driven `MigrationTestCase` in
 * `tests/migrations.test.ts` and `runMigrationForTest` in the tile-DB
 * `versions/testUtils.ts`. Not exported from the package barrel.
 */

import type {NotebookSchemaSemver} from '../../../uiSpecification/schemaVersion';
import {NOTEBOOK_UI_SCHEMA_MIGRATIONS} from './registry';
import type {
  NotebookSchemaMigrationDetails,
  NotebookSchemaMigrationFrom,
} from './types';

/** One table-driven case for a registered step, looked up by `(from, to)`. */
export type NotebookSchemaMigrationTestCase = {
  /** Descriptive name. */
  name: string;
  from: NotebookSchemaMigrationFrom;
  to: NotebookSchemaSemver;
  /** Input notebook JSON at the `from` shape. */
  input: unknown;
  /** Assertions on the migrated output (throw / `expect` inside). */
  assert: (output: any) => void;
};

/** Find the registered step for `(from, to)` or throw a clear test error. */
export function findNotebookSchemaMigration(
  from: NotebookSchemaMigrationFrom,
  to: NotebookSchemaSemver,
  registry: NotebookSchemaMigrationDetails[] = NOTEBOOK_UI_SCHEMA_MIGRATIONS
): NotebookSchemaMigrationDetails {
  const step = registry.find(m => m.from === from && m.to === to);
  if (!step) {
    throw new Error(
      `No notebook schema migration registered for ${from} → ${to}`
    );
  }
  return step;
}

/**
 * Apply one step's `migrationFunction` then `validateFunction` to `input`
 * (exactly what the runner does per hop) and return the output.
 */
export function runNotebookSchemaMigrationForTest(
  step: NotebookSchemaMigrationDetails,
  input: unknown
): unknown {
  const output = step.migrationFunction(input);
  step.validateFunction(output);
  return output;
}
