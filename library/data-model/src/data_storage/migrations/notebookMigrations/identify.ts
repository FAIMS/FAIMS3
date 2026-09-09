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
 * @file Path finder for the notebook schema migration harness — the
 * counterpart of `identifyMigrations` in `migrationService.ts` and the
 * tile-DB runner.
 */

import {
  compareNotebookSchemaSemver,
  isNotebookSchemaSemver,
  type NotebookSchemaSemver,
} from '../../../uiSpecification/schemaVersion';
import {
  NOTEBOOK_UI_SCHEMA_MIGRATIONS,
  NOTEBOOK_UI_SCHEMA_TARGET_VERSION,
} from './registry';
import {
  NOTEBOOK_SCHEMA_LEGACY,
  NotebookSchemaMigrationError,
  type NotebookSchemaMigrationDetails,
  type NotebookSchemaMigrationFrom,
} from './types';

/**
 * Map a raw `schemaVersion` value onto a harness start point: a strict semver
 * is used as-is; everything else (missing, `null`, `'7.0'`, garbage) is the
 * {@link NOTEBOOK_SCHEMA_LEGACY} sentinel.
 */
export function resolveNotebookSchemaMigrationStart(
  version: unknown
): NotebookSchemaMigrationFrom {
  return isNotebookSchemaSemver(version) ? version : NOTEBOOK_SCHEMA_LEGACY;
}

/**
 * Compute the ordered list of steps needed to bring a notebook at `from` up to
 * `to` (default: {@link NOTEBOOK_UI_SCHEMA_TARGET_VERSION}).
 *
 * Rules (same as the Couch / tile harnesses, with semver ids):
 * - `from === to` → `[]`
 * - `from > to` → throws (no downgrade; forward compatibility is the
 *   classifier's job, not migration's)
 * - each hop must match exactly one registered step whose `from` equals the
 *   current version; zero → missing path, more than one → ambiguous
 * - a step whose `to` overshoots the target, or a revisited version, throws
 *
 * @throws {NotebookSchemaMigrationError}
 */
export function identifyNotebookSchemaMigrations({
  from,
  to = NOTEBOOK_UI_SCHEMA_TARGET_VERSION,
  registry = NOTEBOOK_UI_SCHEMA_MIGRATIONS,
}: {
  from: NotebookSchemaMigrationFrom;
  to?: NotebookSchemaSemver;
  /** Override for tests; production callers use the shared registry. */
  registry?: NotebookSchemaMigrationDetails[];
}): NotebookSchemaMigrationDetails[] {
  if (from !== NOTEBOOK_SCHEMA_LEGACY) {
    const cmp = compareNotebookSchemaSemver(from, to);
    if (cmp === 0) {
      return [];
    }
    if (cmp > 0) {
      throw new NotebookSchemaMigrationError(
        `Cannot downgrade notebook schema from ${from} to ${to}`,
        {from, to}
      );
    }
  }

  const steps: NotebookSchemaMigrationDetails[] = [];
  const visited = new Set<NotebookSchemaMigrationFrom>([from]);
  let current: NotebookSchemaMigrationFrom = from;

  while (current !== to) {
    const candidates = registry.filter(step => step.from === current);

    if (candidates.length === 0) {
      throw new NotebookSchemaMigrationError(
        `Missing notebook schema migration from ${current} (target ${to})`,
        {from: current, to}
      );
    }
    if (candidates.length > 1) {
      throw new NotebookSchemaMigrationError(
        `Ambiguous notebook schema migration from ${current}: ${candidates
          .map(step => step.to)
          .join(', ')}`,
        {from: current, to}
      );
    }

    const [next] = candidates;

    if (compareNotebookSchemaSemver(next.to, to) > 0) {
      throw new NotebookSchemaMigrationError(
        `Notebook schema migration ${next.from} → ${next.to} overshoots target ${to}`,
        {from: next.from, to: next.to}
      );
    }
    if (visited.has(next.to)) {
      throw new NotebookSchemaMigrationError(
        `Notebook schema migration registry has a cycle at ${next.to}`,
        {from: next.from, to: next.to}
      );
    }

    steps.push(next);
    visited.add(next.to);
    current = next.to;
  }

  return steps;
}
