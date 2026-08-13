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

import {NotebookDefinitionV5} from './migrateV5';

/**
 * @file Notebook migration to schema 6.0 - renames the ComputedField component
 * to ComputedNumber, following the split of the computed field into
 * ComputedNumber and ComputedText (#2197). The old component returned
 * faims-core::Number, so the rename is the whole change; expressions and all
 * other parameters are preserved.
 *
 * Self-contained per the migration convention (see migrateV5): types are
 * duplicated rather than imported from the live application model so this
 * transform stays frozen as the schema evolves.
 */

/** Notebook shape produced by this migration (schema 6.0). Identical layout to
 * v5 apart from the schema version. */
export type NotebookDefinitionV6 = Omit<NotebookDefinitionV5, 'uiSpec'> & {
  uiSpec: Omit<NotebookDefinitionV5['uiSpec'], 'schemaVersion'> & {
    schemaVersion: string;
  };
};

const OLD_COMPONENT_NAME = 'ComputedField';
const NEW_COMPONENT_NAME = 'ComputedNumber';

/**
 * Migrate a notebook from schema 5.0 to 6.0.
 *
 * @param notebook - v5 notebook
 * @returns notebook with ComputedField fields renamed to ComputedNumber and
 * `uiSpec.schemaVersion` `'6.0'`
 */
export const migrateToV6 = (
  notebook: NotebookDefinitionV5
): NotebookDefinitionV6 => {
  const notebookCopy = JSON.parse(
    JSON.stringify(notebook)
  ) as NotebookDefinitionV5;

  for (const fieldDef of Object.values(notebookCopy.uiSpec.fields)) {
    if (
      fieldDef &&
      typeof fieldDef === 'object' &&
      (fieldDef as Record<string, unknown>)['component-name'] ===
        OLD_COMPONENT_NAME
    ) {
      (fieldDef as Record<string, unknown>)['component-name'] =
        NEW_COMPONENT_NAME;
    }
  }

  return {
    ...notebookCopy,
    uiSpec: {
      ...notebookCopy.uiSpec,
      schemaVersion: '6.0',
    },
  };
};
