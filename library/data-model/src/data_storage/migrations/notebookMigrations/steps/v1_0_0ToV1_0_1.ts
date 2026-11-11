// SPDX-License-Identifier: Apache-2.0

/**
 * @file `1.0.0 → 1.0.1` — require `exportName` on every field.
 *
 * Existing `uiSpec.fields` keys stay as the storage id. Missing or blank
 * `exportName` is copied from that key. Historical `revision.avps` keys are
 * not rewritten.
 */

import {
  NotebookDefinitionV1_0_1Schema,
  type NotebookDefinitionV1,
  type NotebookDefinitionV1_0_1,
} from '../../../../uiSpecification/types';
import {NotebookSchemaMigrationError} from '../types';

/** Output version of this step. */
export const V1_0_0_TO_V1_0_1_TARGET = '1.0.1' as const;

/**
 * Clone the 1.0.0 notebook, stamp `exportName` on each field, set schema 1.0.1.
 */
export function migrateV1_0_0ToV1_0_1(
  input: unknown
): NotebookDefinitionV1_0_1 {
  const inputDoc = input as NotebookDefinitionV1;
  if (!inputDoc || typeof inputDoc !== 'object' || Array.isArray(inputDoc)) {
    throw new NotebookSchemaMigrationError('1.0.0 notebook must be an object', {
      from: '1.0.0',
      to: V1_0_0_TO_V1_0_1_TARGET,
    });
  }

  const cloned = structuredClone(inputDoc);

  if (!cloned.uiSpec || typeof cloned.uiSpec !== 'object') {
    throw new NotebookSchemaMigrationError(
      '1.0.0 notebook is missing a uiSpec object',
      {from: '1.0.0', to: V1_0_0_TO_V1_0_1_TARGET}
    );
  }

  stampMissingExportNames(cloned.uiSpec.fields);
  cloned.uiSpec.schemaVersion = V1_0_0_TO_V1_0_1_TARGET;
  return cloned as NotebookDefinitionV1_0_1;
}

/** Copy a missing or blank `exportName` from the `uiSpec.fields` key. */
function stampMissingExportNames(
  fields: NotebookDefinitionV1['uiSpec']['fields']
): void {
  for (const [id, raw] of Object.entries(fields)) {
    if (!raw || typeof raw !== 'object') continue;
    const field = raw as Record<string, unknown>;
    if (
      typeof field.exportName !== 'string' ||
      field.exportName.trim() === ''
    ) {
      field.exportName = id;
    }
  }
}

/** Validate the 1.0.1 output against {@link NotebookDefinitionV1_0_1Schema}. */
export function validateV1_0_1(output: unknown): void {
  const parsed = NotebookDefinitionV1_0_1Schema.parse(output);
  if (parsed.uiSpec.schemaVersion !== V1_0_0_TO_V1_0_1_TARGET) {
    throw new Error(
      `expected schemaVersion ${V1_0_0_TO_V1_0_1_TARGET}, got ${parsed.uiSpec.schemaVersion}`
    );
  }
}
