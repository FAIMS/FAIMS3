// SPDX-License-Identifier: Apache-2.0

import {NotebookDefinitionV2} from './migrateV2';

/**
 * @file Notebook migration to schema 3.0 — removes legacy `project_status` from metadata.
 * Archive state for templates now lives on the template document, not notebook JSON.
 */

export type NotebookDefinitionV3 = NotebookDefinitionV2;

/**
 * Migrate a notebook from schema 2.0 to 3.0.
 *
 * @param notebook - notebook with metadata.schema_version '2.0' (or v2-shaped body)
 * @returns deep-cloned notebook with `project_status` removed and schema_version '3.0'
 */
export const migrateToV3 = (
  notebook: NotebookDefinitionV2
): NotebookDefinitionV3 => {
  const notebookCopy = JSON.parse(
    JSON.stringify(notebook)
  ) as NotebookDefinitionV3;

  if ('project_status' in notebookCopy.metadata) {
    delete notebookCopy.metadata.project_status;
  }
  notebookCopy.metadata.schema_version = '3.0';

  return notebookCopy;
};
