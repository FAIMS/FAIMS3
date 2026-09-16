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

import {NotebookDefinitionV6} from './migrateV6';

/**
 * @file Notebook migration to schema 7.0 - removes the `displayParent` field
 * property. Nothing has read it since the form refactor; display of parent
 * values is now configured on the child via the ParentFieldDisplay field
 * (#31), so the flag is stripped from existing notebooks.
 *
 * Self-contained per the migration convention (see migrateV5): types are
 * duplicated rather than imported from the live application model so this
 * transform stays frozen as the schema evolves.
 */

/** Notebook shape produced by this migration (schema 7.0). Identical layout to
 * v6 apart from the schema version. */
export type NotebookDefinitionV7 = Omit<NotebookDefinitionV6, 'uiSpec'> & {
  uiSpec: Omit<NotebookDefinitionV6['uiSpec'], 'schemaVersion'> & {
    schemaVersion: string;
  };
};

const REMOVED_PROPERTY = 'displayParent';

/**
 * Migrate a notebook from schema 6.0 to 7.0.
 *
 * @param notebook - v6 notebook
 * @returns notebook with the `displayParent` property removed from all fields
 * and `uiSpec.schemaVersion` `'7.0'`
 */
export const migrateToV7 = (
  notebook: NotebookDefinitionV6
): NotebookDefinitionV7 => {
  const notebookCopy = JSON.parse(
    JSON.stringify(notebook)
  ) as NotebookDefinitionV6;

  for (const fieldDef of Object.values(notebookCopy.uiSpec.fields)) {
    if (fieldDef && typeof fieldDef === 'object') {
      delete (fieldDef as Record<string, unknown>)[REMOVED_PROPERTY];
    }
  }

  return {
    ...notebookCopy,
    uiSpec: {
      ...notebookCopy.uiSpec,
      schemaVersion: '7.0',
    },
  };
};
