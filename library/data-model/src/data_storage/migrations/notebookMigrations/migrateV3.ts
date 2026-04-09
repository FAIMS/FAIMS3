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
 * @file Notebook migration to schema 3.0 — removes legacy `project_status` from metadata.
 * Archive state for templates now lives on the template document, not notebook JSON.
 */

import type {NotebookV1} from './migrateV2';

/**
 * Migrate a notebook from schema 2.0 to 3.0.
 *
 * @param notebook - notebook with metadata.schema_version '2.0' (or v2-shaped body)
 * @returns deep-cloned notebook with `project_status` removed and schema_version '3.0'
 */
export const migrateToV3 = (notebook: any): NotebookV1 => {
  const notebookCopy = JSON.parse(JSON.stringify(notebook)) as NotebookV1;

  if ('project_status' in notebookCopy.metadata) {
    delete notebookCopy.metadata.project_status;
  }
  notebookCopy.metadata.schema_version = '3.0';

  return notebookCopy;
};
