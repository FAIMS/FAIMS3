// SPDX-License-Identifier: Apache-2.0
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
 * @file Registry of notebook JSON schema migration steps — the counterpart of
 * `DB_MIGRATIONS` / `DB_TARGET_VERSIONS` for Couch databases.
 *
 * To add a format change:
 * 1. Add (or alias) a `V<semver>` Zod block in `uiSpecification/types.ts`
 *    (`V1` = `1.0.0`, `V1_0_1` = `1.0.1`, …) and re-point the current aliases.
 * 2. Add `steps/<from>To<to>.ts` exporting a pure `migrationFunction` and a
 *    `validateFunction` that parses with the new version's schema.
 * 3. Append `{from, to, description, migrationFunction, validateFunction}`
 *    below and bump {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}.
 * 4. Add a table-driven case to `steps/<step>.test.ts`.
 *
 * Semver policy for the bump: **patch** = additive / safe (older apps render
 * silently), **minor** = significant but non-mission-critical (older apps
 * render with a warning), **major** = older apps cannot safely interpret the
 * form graph.
 */

import type {NotebookSchemaSemver} from '../../../uiSpecification/schemaVersion';
import {migrateLegacyToV1, validateV1} from './steps/legacyToV1';
import {migrateV1_0_0ToV1_0_1, validateV1_0_1} from './steps/v1_0_0ToV1_0_1';
import {
  NOTEBOOK_SCHEMA_LEGACY,
  type NotebookSchemaMigrationDetails,
} from './types';

/**
 * Latest notebook JSON schema version this build understands and writes.
 * Strict `MAJOR.MINOR.PATCH`; the epoch started at `1.0.0` when the deprecated
 * two-part `1.0`…`7.0` ladder was collapsed.
 */
export const CURRENT_NOTEBOOK_UI_SCHEMA_VERSION: NotebookSchemaSemver = '1.0.1';

/** Alias of {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} in harness terminology. */
export const NOTEBOOK_UI_SCHEMA_TARGET_VERSION =
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;

/** All registered steps. Order is irrelevant; the path finder links them by `from`/`to`. */
export const NOTEBOOK_UI_SCHEMA_MIGRATIONS: NotebookSchemaMigrationDetails[] = [
  {
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: '1.0.0',
    description:
      'Collapse pre-semver notebook JSON (missing version or deprecated 1.0–7.0) to epoch 1.0.0',
    migrationFunction: migrateLegacyToV1,
    validateFunction: validateV1,
  },
  {
    from: '1.0.0',
    to: '1.0.1',
    description:
      'Require exportName on every field (stamped from the fields key when missing)',
    migrationFunction: migrateV1_0_0ToV1_0_1,
    validateFunction: validateV1_0_1,
  },
];
