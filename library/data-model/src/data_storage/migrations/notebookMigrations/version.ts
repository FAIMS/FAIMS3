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
 * @file Leaf helper: read the raw schema version from a notebook JSON value.
 * Kept separate from the runner so migration steps can import it without
 * creating a `registry → steps → runner → registry` cycle.
 */

/** Loose carrier for the two places a schema version has ever lived. */
export type NotebookWithSchemaVersion = {
  metadata?: {schema_version?: string | null};
  uiSpec?: {schemaVersion?: string | null};
};

/**
 * Read the raw schema version from legacy `metadata.schema_version` or current
 * `uiSpec.schemaVersion`. Returns the string as stored (which may be a
 * deprecated two-part value such as `'7.0'`); use
 * `resolveNotebookSchemaMigrationStart` to classify it.
 */
export function getNotebookSchemaVersion(
  notebook: NotebookWithSchemaVersion
): string | undefined {
  const legacy = notebook?.metadata?.schema_version;
  if (legacy != null) {
    return legacy;
  }
  const fromUiSpec = notebook?.uiSpec?.schemaVersion;
  if (fromUiSpec != null) {
    return fromUiSpec;
  }
  return undefined;
}
