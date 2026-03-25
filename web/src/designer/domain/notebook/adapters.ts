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
 * @file Convert between flat notebooks, undo history shape, and designer id stripping.
 */

import {v4 as uuidv4} from 'uuid';
import type {Notebook, NotebookWithHistory} from '../../state/initial';

/** Deep clone via JSON so exported notebooks stay plain serialisable objects. */
const cloneNotebook = (notebook: Notebook): Notebook =>
  JSON.parse(JSON.stringify(notebook)) as Notebook;

/**
 * Wraps a flat notebook in redux-undo's present/past/future structure.
 *
 * @param notebook - Notebook with flat `ui-specification`.
 * @returns Same data in `NotebookWithHistory` form with empty undo stacks.
 */
export const toNotebookWithHistory = (
  notebook: Notebook
): NotebookWithHistory => ({
  metadata: notebook.metadata,
  'ui-specification': {
    present: notebook['ui-specification'],
    past: [],
    future: [],
  },
});

/**
 * Strips undo history for export or API payloads.
 *
 * @param notebook - Designer store slice shape.
 * @returns Flat `Notebook` (present UI spec only).
 */
export const toNotebook = (notebook: NotebookWithHistory): Notebook => ({
  metadata: notebook.metadata,
  'ui-specification': notebook['ui-specification'].present,
});

/**
 * Ensures every field has a stable in-memory `designerIdentifier` (for React keys).
 *
 * @param notebook - Flat notebook to mutate (cloned first).
 * @returns Cloned notebook with UUIDs filled in where missing.
 */
export const attachMissingDesignerIdentifiers = (
  notebook: Notebook
): Notebook => {
  const cloned = cloneNotebook(notebook);
  Object.values(cloned['ui-specification'].fields).forEach(field => {
    if (!field.designerIdentifier) {
      field.designerIdentifier = uuidv4();
    }
  });
  return cloned;
};

/**
 * Remove designerIdentifier keys just before export so the external schema stays clean.
 *
 * @param notebook - Flat notebook (cloned first).
 * @returns Cloned notebook without `designerIdentifier` on fields.
 */
export const stripDesignerIdentifiers = (notebook: Notebook): Notebook => {
  const cloned = cloneNotebook(notebook);
  Object.values(cloned['ui-specification'].fields).forEach(field => {
    delete field.designerIdentifier;
  });
  return cloned;
};
